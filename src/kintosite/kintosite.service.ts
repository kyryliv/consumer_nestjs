import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig, Method } from 'axios';
import { promises as fs } from 'fs';
import { Agent } from 'https';
import jwt, { type Algorithm, type JwtPayload } from 'jsonwebtoken';
import path from 'path';
import { firstValueFrom } from 'rxjs';
import { kintoEndpoints } from './kintosite.endpoints';
import { HttpEndpointDefinition } from './kintosite.types';
import { buildUrl, resolveTemplate } from './kintosite.utils';

@Injectable()
export class KintositeService {
  private readonly endpointById = new Map<string, HttpEndpointDefinition>(
    kintoEndpoints.map((e) => [e.id, e]),
  );

  private readonly baseUrl: string;
  private readonly httpsAgent: Agent | undefined;
  private readonly timeout: number;
  private jwt: string = '';

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const url = process.env[`DRUPAL_REST_URL`];
    if (!url) {
      throw new Error(`DRUPAL_REST_URL is not configured`);
    }
    this.baseUrl = url;
    this.timeout = this.config.get<number>('HTTP_TIMEOUT_MS') ?? 10000;
    const rejectUnauthorizedSetting =
      this.config.get<string>('DRUPAL_TLS_REJECT_UNAUTHORIZED') ?? 'true';
    this.httpsAgent = new Agent({
      keepAlive: true,
      rejectUnauthorized: rejectUnauthorizedSetting.toLowerCase() !== 'false',
    });
    this.invalidateJwt();
  }

  async executeById(
    endpointId: string,
    input: Record<string, unknown> = {},
  ): Promise<unknown> {
    const endpoint = this.endpointById.get(endpointId);
    if (!endpoint) {
      throw new InternalServerErrorException(`Endpoint "${endpointId}" not found`);
    }
    const context: Record<string, unknown> = { input };
    return this.executeEndpoint(endpoint, context);
  }

  private async executeEndpoint(
    endpoint: HttpEndpointDefinition,
    context: Record<string, unknown>,
  ): Promise<unknown> {

    if (!endpoint.path) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" has no path defined.`,
      );
    }

    const resolvedPath = resolveTemplate(endpoint.path, context);

    const url = buildUrl(
      this.baseUrl,
      typeof resolvedPath === 'string' ? resolvedPath : endpoint.path,
    );

    if (!url.toLowerCase().startsWith('https://')) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" resolved to a non-HTTPS URL. Only HTTPS is allowed.`,
      );
    }

    const resolvedData = resolveTemplate(endpoint.params, context);

    const sendRequest = async (jwt: string) => {
      const requestConfig: AxiosRequestConfig = {
        method: endpoint.method as Method,
        url,
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        httpsAgent: this.httpsAgent,
        data: resolvedData,
      };
      return firstValueFrom(
        this.http.request({ ...requestConfig, maxRedirects: 0, validateStatus: () => true }),
      );
    };

    let jwt = await this.getJwt();

    let response = await sendRequest(jwt);
    if (response.status === 301 || response.status === 401) {
      this.invalidateJwt();
      jwt = await this.getJwt();
      response = await sendRequest(jwt);
    }

    if (response.status === 301 || response.status === 401) {
      throw new InternalServerErrorException(
        `Authorization failed on endpoint "${endpoint.id}"`,
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new InternalServerErrorException(
        `Remote method:"${endpoint.method}" endpoint:"${endpoint.id}" returned HTTP ${response.status}`,
      );
    }

    return {
      endpointId: endpoint.id,
      status: response.status,
      data: response.data,
    };
  }

  private async getJwt(): Promise<string> {
    if (this.jwt) {
      return this.jwt;
    }

    const userNameSetting = process.env.DRUPAL_USERNAME;
    const privateKeySetting = process.env.DRUPAL_PRIVATEKEY;
    const keyId = process.env.DRUPAL_KEYID;
    const algorithmSetting = (process.env.DRUPAL_ALGORITHM ?? 'RSA').toUpperCase();

    if (!userNameSetting) {
      throw new Error('DRUPAL_USERNAME is not configured');
    }

    if (!privateKeySetting) {
      throw new Error('DRUPAL_PRIVATEKEY is not configured');
    }

    if (!keyId) {
      throw new Error('DRUPAL_KEYID is not configured');
    }

    if (algorithmSetting !== 'RSA') {
      throw new Error(`Unsupported DRUPAL_ALGORITHM "${algorithmSetting}". Expected "RSA".`);
    }

    const privateKeyPem = privateKeySetting.includes('BEGIN PRIVATE KEY')
      ? privateKeySetting
      : await this.readPrivateKeyFromPath(privateKeySetting);

    const iat = Math.floor(Date.now() / 1000);

    const payload: JwtPayload = {
      iat: iat,
      drupal: {
        name: userNameSetting,
      }
    };

    this.jwt = jwt.sign(payload, privateKeyPem, {
      algorithm: 'RS256' as Algorithm,
      expiresIn: '2h',
      keyid: keyId,
    });

    return this.jwt;
  }

  private async readPrivateKeyFromPath(privateKeyPath: string): Promise<string> {
    const normalizedPath = privateKeyPath.trim();
    const candidatePaths = [
      normalizedPath,
      path.resolve(process.cwd(), normalizedPath),
      path.resolve(
        process.cwd(),
        'src/kintosite',
        normalizedPath.replace(/^\.\//, ''),
      ),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        return await fs.readFile(candidatePath, 'utf-8');
      } catch {
        // Try next candidate path
      }
    }

    throw new Error(
      `Unable to read DRUPAL_PRIVATEKEY from "${privateKeyPath}". Checked: ${candidatePaths.join(', ')}`,
    );
  }

  private invalidateJwt(): void {
    this.jwt = '';
  }

}
