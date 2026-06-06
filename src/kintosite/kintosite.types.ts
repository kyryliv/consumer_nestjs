export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpEndpointDefinition {
  id: string;
  method: HttpMethod;
  path?: string;
  data?: Record<string, unknown>;
}

export type EndpointDefinition = HttpEndpointDefinition;
