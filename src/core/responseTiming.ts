export const RESPONSE_TIMEOUT_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_RESPONSE_TIMEOUT_SECONDS = 15;

export function getResponseTimeoutSeconds(value: unknown): number {
  return typeof value === 'number' && RESPONSE_TIMEOUT_OPTIONS.some(seconds => seconds === value)
    ? value : DEFAULT_RESPONSE_TIMEOUT_SECONDS;
}

export function timestampMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    const result = (value as { toMillis: () => number }).toMillis();
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

export function responseDeadlineMillis(room: { responseStartedAt?: unknown; responseTimeoutSeconds?: unknown }): number | null {
  const start = timestampMillis(room.responseStartedAt);
  return start === null ? null : start + getResponseTimeoutSeconds(room.responseTimeoutSeconds) * 1000;
}

export function getResponseSecondsLeft(room: Parameters<typeof responseDeadlineMillis>[0], now = Date.now()): number | null {
  const deadline = responseDeadlineMillis(room);
  return deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
}
