export const RESPONSE_TIMEOUT_OPTIONS = [15, 30, 45, 60] as const;
export const DEFAULT_RESPONSE_TIMEOUT_SECONDS = 15;

export function getResponseTimeoutSeconds(value: unknown): number {
  return typeof value === 'number' && RESPONSE_TIMEOUT_OPTIONS.some(seconds => seconds === value)
    ? value : DEFAULT_RESPONSE_TIMEOUT_SECONDS;
}
