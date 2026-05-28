import { HttpService } from '@nestjs/axios';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Agent } from 'https';
import { firstValueFrom } from 'rxjs';
import { buildHttpsAgent } from '../common/https-agent.util';
import { withRetry } from '../common/retry.util';

const REMOTE_ID = 'kinto';
const ENV_SUFFIX = REMOTE_ID.toUpperCase();

@Injectable()
export class KintoAuthService {
  private jwt: { token: string; expiresAt: number } | undefined;
  private readonly httpsAgent: Agent | undefined;

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    this.httpsAgent = buildHttpsAgent(this.config.get('ALLOW_WEAK_TLS'));
  }

  async getJwt(): Promise<string> {
    if (this.jwt && Date.now() < this.jwt.expiresAt) {
      return this.jwt.token;
    }
    return this.fetchFreshJwt();
  }

  invalidateJwt(): void {
    this.jwt = undefined;
  }

  private async fetchFreshJwt(): Promise<string> {
    const initToken = this.config.get<string>(`INIT_TOKEN_${ENV_SUFFIX}`);
    const authPath = this.config.get<string>(`AUTH_URL_${ENV_SUFFIX}`);
    const remoteUrl = this.config.get<string>(`REMOTE_URL_${ENV_SUFFIX}`);
    const timeout = this.config.get<number>('HTTP_TIMEOUT_MS') ?? 10000;
    const ttl = this.config.get<number>('JWT_TTL_MS') ?? 7_200_000;

    if (!initToken || !authPath || !remoteUrl) {
      throw new InternalServerErrorException(
        `INIT_TOKEN_${ENV_SUFFIX}, AUTH_URL_${ENV_SUFFIX}, or REMOTE_URL_${ENV_SUFFIX} is missing`,
      );
    }

    const authUrl = this.resolveAuthUrl(remoteUrl, authPath);

    const response = await withRetry(
      () =>
        firstValueFrom(
          this.http.get(authUrl + '/' + initToken, {
            timeout,
            headers: { 'Content-Type': 'application/json' },
            httpsAgent: this.httpsAgent,
          }),
        ),
      { attempts: 3, initialDelayMs: 300, factor: 2 },
    );

    const jwt = response.data?.token;
    if (!jwt) {
      throw new InternalServerErrorException(
        'JWT token was not found in auth response',
      );
    }

    this.jwt = { token: jwt, expiresAt: Date.now() + ttl };
    return jwt;
  }

  private resolveAuthUrl(remoteUrl: string, authPath: string): string {
    if (/^https?:\/\//i.test(authPath)) {
      return authPath;
    }
    const trimmedBase = remoteUrl.endsWith('/') ? remoteUrl.slice(0, -1) : remoteUrl;
    const normalizedPath = authPath.startsWith('/') ? authPath : `/${authPath}`;
    return `${trimmedBase}${normalizedPath}`;
  }
}
