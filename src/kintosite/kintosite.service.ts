import { HttpService } from "@nestjs/axios";
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AxiosError, type AxiosRequestConfig, type Method } from "axios";
import { promises as fs } from "fs";
import { Agent as HttpAgent } from "http";
import { Agent } from "https";
import jwt, { type Algorithm, type JwtPayload } from "jsonwebtoken";
import path from "path";
import { firstValueFrom } from "rxjs";
import { kintoEndpoints } from "./kintosite.endpoints";
import { HttpEndpointDefinition } from "./kintosite.types";
import { buildUrl } from "./kintosite.utils";

type KintositeExecutionContext = {
  input: Record<string, unknown>;
};

@Injectable()
export class KintositeService {
  private readonly logger = new Logger(KintositeService.name);
  private readonly endpointById = new Map<string, HttpEndpointDefinition>(
    kintoEndpoints.map((e) => [e.id, e]),
  );

  private readonly baseUrl: string;
  private readonly baseUrlProtocol: string;
  private readonly httpAgent: HttpAgent | undefined;
  private readonly httpsAgent: Agent | undefined;
  private readonly timeout: number;
  private readonly allowHttp: boolean;
  private jwt: string = "";

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {
    const url = process.env[`DRUPAL_REST_URL`];
    if (!url) {
      throw new Error(`DRUPAL_REST_URL is not configured`);
    }

    const parsedUrl = new URL(url);
    this.baseUrlProtocol = parsedUrl.protocol;

    this.allowHttp =
      (
        this.config.get<string>("DRUPAL_ALLOW_HTTP") ?? "false"
      ).toLowerCase() === "true";
    if (this.baseUrlProtocol === "http:" && !this.allowHttp) {
      throw new Error(
        "DRUPAL_REST_URL uses HTTP. Set DRUPAL_ALLOW_HTTP=true to allow non-TLS connections.",
      );
    }

    this.baseUrl = url;
    this.timeout = this.config.get<number>("HTTP_TIMEOUT_MS") ?? 10000;
    const rejectUnauthorizedSetting =
      this.config.get<string>("DRUPAL_TLS_REJECT_UNAUTHORIZED") ?? "true";
    this.httpAgent = new HttpAgent({
      keepAlive: true,
    });
    this.httpsAgent = new Agent({
      keepAlive: true,
      rejectUnauthorized: rejectUnauthorizedSetting.toLowerCase() !== "false",
    });
    this.invalidateJwt();
  }

  async executeById(
    endpointId: string,
    input: Record<string, unknown> = {},
  ): Promise<unknown> {
    const endpoint = this.endpointById.get(endpointId);
    if (!endpoint) {
      throw new InternalServerErrorException(
        `Endpoint "${endpointId}" not found`,
      );
    }
    const context: KintositeExecutionContext = { input };
    return this.executeEndpoint(endpoint, context);
  }

  private async executeEndpoint(
    endpoint: HttpEndpointDefinition,
    context: KintositeExecutionContext,
  ): Promise<unknown> {

    if (!endpoint.path) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" has no path defined.`,
      );
    }

    const resolvedPath = this.resolvePathTemplate(endpoint.path, context.input);
    const url = buildUrl(this.baseUrl, resolvedPath);
    const requestData = this.resolveDataTemplate(endpoint.data, context.input);
    const isHttps = url.toLowerCase().startsWith("https://");
    const isHttp = url.toLowerCase().startsWith("http://");

    if (!isHttps && !isHttp) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" resolved to an invalid URL protocol. Expected http or https.`,
      );
    }
    if (isHttp && !this.allowHttp) {
      throw new InternalServerErrorException(
        `Endpoint "${endpoint.id}" resolved to HTTP but DRUPAL_ALLOW_HTTP is not enabled.`,
      );
    }
    const sendRequest = async (jwt: string) => {
      const requestConfig: AxiosRequestConfig = {
        method: endpoint.method,
        url,
        timeout: this.timeout,
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          ...(jwt ? { Authorization: `UsersJwt ${jwt}` } : {}),
        },
        httpAgent: isHttp ? this.httpAgent : undefined,
        httpsAgent: this.httpsAgent,
        data: requestData,
      };

      let response;

      try {
        response = await firstValueFrom(
          this.http.request({
            ...requestConfig,
            maxRedirects: 0,
            validateStatus: () => true,
          }),
        );
      } catch (error) {
        if (error instanceof AxiosError && error.code === "EPROTO") {
          throw new InternalServerErrorException(
            `TLS handshake failed for URL "${url}". This usually means the protocol/port is mismatched (for example https:// against a plain HTTP port). Check DRUPAL_REST_URL and upstream TLS settings.`,
          );
        }
        throw error;
      }

      return response;
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
        `Remote url: "${url}" method:"${endpoint.method}" endpoint:"${endpoint.id}" returned HTTP ${response.status} error: ${response.data.error}`);
    }

    return {
      endpointId: endpoint.id,
      status: response.status,
      data: response.data,
    };
  }

  private resolvePathTemplate(
    pathTemplate: string,
    input: Record<string, unknown>,
  ): string {
    return pathTemplate.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = this.getInputValue(input, key);
      return encodeURIComponent(String(value));
    });
  }

  private resolveDataTemplate(
    template: unknown,
    input: Record<string, unknown>,
  ): unknown {
    if (template === undefined || template === null) {
      return undefined;
    }

    if (Array.isArray(template)) {
      return template.map((item) => this.resolveDataTemplate(item, input));
    }

    if (typeof template === "object") {
      const resolved: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        template as Record<string, unknown>,
      )) {
        resolved[key] = this.resolveDataTemplate(value, input);
      }
      return resolved;
    }

    if (typeof template !== "string") {
      return template;
    }

    const fullMatch = template.match(/^\{\{\s*([\w.]+)\s*\}\}$/);
    if (fullMatch) {
      return this.getInputValue(input, fullMatch[1]);
    }

    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = this.getInputValue(input, key);
      return String(value);
    });
  }

  private getInputValue(input: Record<string, unknown>, keyPath: string): unknown {
    const parts = keyPath.split(".");
    let current: unknown = input;

    for (const part of parts) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object" ||
        !(part in (current as Record<string, unknown>))
      ) {
        throw new InternalServerErrorException(
          `Missing value for template key "${keyPath}"`,
        );
      }

      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  private async getJwt(): Promise<string> {
    if (this.jwt) {
      return this.jwt;
    }

    const userNameSetting = process.env.DRUPAL_USERNAME;
    const privateKeySetting = process.env.DRUPAL_PRIVATEKEY;
    const keyId = process.env.DRUPAL_KEYID;
    const algorithmSetting = (
      process.env.DRUPAL_ALGORITHM ?? "RSA"
    ).toUpperCase();

    if (!userNameSetting) {
      throw new Error("DRUPAL_USERNAME is not configured");
    }

    if (!privateKeySetting) {
      throw new Error("DRUPAL_PRIVATEKEY is not configured");
    }

    if (!keyId) {
      throw new Error("DRUPAL_KEYID is not configured");
    }

    if (algorithmSetting !== "RSA") {
      throw new Error(
        `Unsupported DRUPAL_ALGORITHM "${algorithmSetting}". Expected "RSA".`,
      );
    }

    const privateKeyPem = privateKeySetting.includes("BEGIN PRIVATE KEY")
      ? privateKeySetting
      : await this.readPrivateKeyFromPath(privateKeySetting);

    const iat = Math.floor(Date.now() / 1000);

    const payload: JwtPayload = {
      iat: iat,
      drupal: {
        name: userNameSetting,
      },
    };

    const algorithm = "RS256" as Algorithm;
    this.jwt = jwt.sign(payload, privateKeyPem, {
      algorithm: algorithm,
      expiresIn: "2h",
      keyid: keyId,
    });

    return this.jwt;
  }

  private async readPrivateKeyFromPath(
    privateKeyPath: string,
  ): Promise<string> {
    const normalizedPath = privateKeyPath.trim();
    const candidatePaths = [
      normalizedPath,
      path.resolve(process.cwd(), normalizedPath),
      path.resolve(
        process.cwd(),
        "src/kintosite",
        normalizedPath.replace(/^\.\//, ""),
      ),
    ];

    for (const candidatePath of candidatePaths) {
      try {
        return await fs.readFile(candidatePath, "utf-8");
      } catch {
        // Try next candidate path
      }
    }

    throw new Error(
      `Unable to read DRUPAL_PRIVATEKEY from "${privateKeyPath}". Checked: ${candidatePaths.join(", ")}`,
    );
  }

  private invalidateJwt(): void {
    this.jwt = "";
  }
}
