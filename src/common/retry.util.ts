export interface RetryOptions {
  attempts: number;
  initialDelayMs: number;
  factor: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const attempts = Math.max(1, Math.trunc(options.attempts));
  const initialDelayMs = Math.max(0, Math.trunc(options.initialDelayMs));
  const factor = options.factor > 0 ? options.factor : 1;

  let delay = initialDelayMs;
  let lastError: unknown;

  for (let index = 0; index < attempts; index += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (index === attempts - 1) {
        break;
      }
      if (delay > 0) {
        await wait(delay);
      }
      delay = Math.round(delay * factor);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
