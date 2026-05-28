export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'flow';

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
  data?: TemplateValue;  
}

export type EndpointDefinition = HttpEndpointDefinition;
