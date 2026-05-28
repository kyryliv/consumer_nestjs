import { Agent } from 'https';

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value === 1;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
  }
  return false;
}

export function buildHttpsAgent(allowWeakTls: unknown): Agent | undefined {
  if (!toBoolean(allowWeakTls)) {
    return undefined;
  }

  return new Agent({ rejectUnauthorized: false });
}
