import { TemplateValue } from './kintosite.types';

export function buildUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  if (!path || path === '/') {
    return trimmedBase;
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${trimmedBase}${normalizedPath}`;
}

export function resolveTemplate(
  value: TemplateValue | undefined,
  context: Record<string, unknown>,
): unknown {

  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (_m, token: string) => {
      const resolved = getByPath(context, token);
      if (resolved === undefined || resolved === null) {
        return '';
      }
      if (
        typeof resolved === 'string' ||
        typeof resolved === 'number' ||
        typeof resolved === 'boolean'
      ) {
        return String(resolved);
      }
      return JSON.stringify(resolved);
    });
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveTemplate(item, context));
  }

  if (isObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = resolveTemplate(child as TemplateValue, context);
    }
    return out;
  }

  return value;
}

export function getByPath(source: unknown, path: string): unknown {
  if (!path) {
    return source;
  }
  return path.split('.').reduce<unknown>((acc, part) => {
    if (!isObject(acc) && !Array.isArray(acc)) {
      return undefined;
    }
    return (acc as Record<string, unknown>)[part];
  }, source);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toRecord(value: unknown): Record<string, unknown> {
  if (isObject(value)) {
    return value;
  }
  return {};
}
