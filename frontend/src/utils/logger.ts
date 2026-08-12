import * as Sentry from '@sentry/react';

export function logError(error: unknown, context?: Record<string, unknown>): void {
  console.error(error);
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
