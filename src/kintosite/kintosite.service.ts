import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { Agent } from 'https';
import { firstValueFrom } from 'rxjs';
import { KintoAuthService } from './kintosite.auth.service';
import { buildHttpsAgent } from '../common/https-agent.util';
import { kintoAuthLoginEndpointId, kintoEndpoints } from './kintosite.endpoints';
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
    private readonly authService: KintoAuthService,
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
    // Flow endpoints are orchestration methods, not HTTP endpoints
    if (endpoint.method === 'flow') {
      throw new InternalServerErrorException(
        `Flow endpoint "${endpoint.id}" cannot be executed directly. Use executeById instead.`,
      );
    }

    if (!endpoint.path) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" has no path defined.`,
      );
    }

    const isAuthLoginEndpoint = endpoint.id === kintoAuthLoginEndpointId;

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

    const params = resolveTemplate(endpoint.params, context);
    const data = resolveTemplate(endpoint.params, context);

    const usesAuth = !isAuthLoginEndpoint;

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
        params: isObject(params) ? params : undefined,
        data,
      };
      return firstValueFrom(
        this.http.request({ ...requestConfig, maxRedirects: 0, validateStatus: () => true }),
      );
    };

    let jwt = usesAuth ? await this.authService.getJwt() : '';
    let response = await sendRequest(jwt);
    if (usesAuth && (response.status === 301 || response.status === 401)) {
      this.authService.invalidateJwt();
      jwt = await this.authService.getJwt();
      response = await sendRequest(jwt);
    }

    if (usesAuth && (response.status === 301 || response.status === 401)) {
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

  /**
   * Sends an HTTP request with Kinto JWT authentication.
   * Acquires a JWT, attaches it as a Bearer token, and retries once on 401/301
   * by invalidating and refreshing the token.
   */
  async sendAuthenticated(
    config: AxiosRequestConfig,
    endpointId: string,
  ): Promise<AxiosResponse> {
    const send = async (jwt: string): Promise<AxiosResponse> =>
      firstValueFrom(
        this.http.request({
          ...config,
          maxRedirects: 0,
          validateStatus: () => true,
          headers: {
            ...config.headers,
            Authorization: `Bearer ${jwt}`,
          },
        }),
      );

    let jwt = await this.authService.getJwt();
    let response = await send(jwt);

    if (response.status === 301 || response.status === 401) {
      this.authService.invalidateJwt();
      jwt = await this.authService.getJwt();
      response = await send(jwt);
    }

    if (response.status === 301 || response.status === 401) {
      throw new InternalServerErrorException(
        `Authorization failed for "${REMOTE_ID}" on endpoint "${endpointId}"`,
      );
    }

    return response;
  }
}
