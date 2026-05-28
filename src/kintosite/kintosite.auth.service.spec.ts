import { HttpService } from '@nestjs/axios';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { KintoAuthService } from './kintosite.auth.service';

describe('KintoAuthService', () => {
  const http = {
    get: jest.fn(),
  } as unknown as HttpService;

  const config = {
    get: jest.fn(),
  } as unknown as ConfigService;

  let service: KintoAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KintoAuthService(http, config);
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'INIT_TOKEN_KINTO') return 'init-token';
      if (key === 'AUTH_URL_KINTO') return '/auth/token';
      if (key === 'REMOTE_URL_KINTO') return 'https://auth.example.com';
      if (key === 'HTTP_TIMEOUT_MS') return 1000;
      return undefined;
    });
  });

  it('returns jwt from auth response', async () => {
    (http.get as jest.Mock).mockReturnValue(of({ data: { token: 'jwt-token' } }));

    await expect(service.getJwt()).resolves.toBe('jwt-token');
  });

  it('retries failed requests and succeeds', async () => {
    (http.get as jest.Mock)
      .mockReturnValueOnce(throwError(() => new Error('temporary')))
      .mockReturnValueOnce(of({ data: { token: 'jwt-token' } }));

    await expect(service.getJwt()).resolves.toBe('jwt-token');
    expect(http.get).toHaveBeenCalledTimes(2);
  });

  it('throws when jwt is missing in response', async () => {
    (http.get as jest.Mock).mockReturnValue(of({ data: {} }));

    await expect(service.getJwt()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('returns cached jwt without re-fetching', async () => {
    (http.get as jest.Mock).mockReturnValue(of({ data: { token: 'jwt-token' } }));

    await service.getJwt();
    await service.getJwt();

    expect(http.get).toHaveBeenCalledTimes(1);
  });

  it('re-fetches after invalidate', async () => {
    (http.get as jest.Mock).mockReturnValue(of({ data: { token: 'jwt-token' } }));

    await service.getJwt();
    service.invalidateJwt();
    await service.getJwt();

    expect(http.get).toHaveBeenCalledTimes(2);
  });
});
