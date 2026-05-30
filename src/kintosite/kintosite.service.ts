import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { Agent } from 'https';
import { firstValueFrom } from 'rxjs';
import { buildHttpsAgent } from '../common/https-agent.util';
import { kintoEndpoints } from './kintosite.endpoints';
import { HttpEndpointDefinition } from './kintosite.types';
import { buildUrl, isObject, resolveTemplate } from './kintosite.utils';

const REMOTE_ID = 'kinto';
const SYNC_FLOW_ENDPOINT_ID = 'root.fetch';

@Injectable()
export class KintositeService {
  private readonly endpointById = new Map<string, HttpEndpointDefinition>(
    kintoEndpoints.map((e) => [e.id, e]),
  );

  private readonly baseUrl: string;
  private readonly httpsAgent: Agent | undefined;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.httpsAgent = buildHttpsAgent(this.config.get('ALLOW_WEAK_TLS'));
    const url = process.env[`REMOTE_URL_${REMOTE_ID.toUpperCase()}`];
    if (!url) {
      throw new Error(`REMOTE_URL_${REMOTE_ID.toUpperCase()} is not configured`);
    }
    this.baseUrl = url;
  }

  async fetchData(input: Record<string, unknown> = {}): Promise<unknown> {
    return this.executeById(SYNC_FLOW_ENDPOINT_ID, input);
  }

  async executeById(
    endpointId: string,
    input: Record<string, unknown> = {},
  ): Promise<unknown> {
    const timeout = this.config.get<number>('HTTP_TIMEOUT_MS') ?? 10000;
    const endpoint = this.endpointById.get(endpointId);
    if (!endpoint) {
      throw new InternalServerErrorException(`Endpoint "${endpointId}" not found`);
    }
    const context: Record<string, unknown> = { input };
    return this.executeEndpoint(endpoint, timeout, context);
  }

  private async executeEndpoint(
    endpoint: HttpEndpointDefinition,
    timeout: number,
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

    const resolvedData = resolveTemplate(endpoint.data, context);

    const sendRequest = async (jwt: string) => {
      const requestConfig: AxiosRequestConfig = {
        method: endpoint.method as Method,
        url,
        timeout,
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
        `Authorization failed for "${REMOTE_ID}" on endpoint "${endpoint.id}"`,
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
    // Placeholder for JWT retrieval logic, e.g., from a cache or an auth service
    return '';
  }

  private invalidateJwt(): void {
    // Placeholder for JWT invalidation logic, e.g., clearing a cache or notifying an auth service
  }

}
