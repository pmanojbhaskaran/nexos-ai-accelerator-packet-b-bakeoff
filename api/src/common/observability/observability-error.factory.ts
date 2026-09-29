type ObsErrorPayload = {
  code: string;
  message: string;
  correlationId?: string;
  details?: Record<string, unknown>;
};

export function observabilityErrorPayload(input: ObsErrorPayload): {
  errorCode: string;
  message: string;
  correlationId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
} {
  return {
    errorCode: input.code,
    message: input.message,
    correlationId: input.correlationId,
    timestamp: new Date().toISOString(),
    details: input.details,
  };
}
