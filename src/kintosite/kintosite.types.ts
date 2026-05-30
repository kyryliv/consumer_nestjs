export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type TemplatePrimitive = string | number | boolean | null;

export type TemplateValue =
  | TemplatePrimitive
  | TemplateValue[]
  | { [key: string]: TemplateValue };

export interface HttpEndpointDefinition {
  id: string;
  method: HttpMethod;
  path?: string;
  params?: TemplateValue;
}

export type EndpointDefinition = HttpEndpointDefinition;
