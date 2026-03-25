import type { RuntimeProvider } from "./analysis-runtime";

export type RuntimeErrorTag =
  | "validation"
  | "transport"
  | "provider"
  | "session"
  | "process";

export interface RuntimeErrorBase {
  tag: RuntimeErrorTag;
  provider?: RuntimeProvider;
  message: string;
  retryable: boolean;
}

export interface ValidationRuntimeError extends RuntimeErrorBase {
  tag: "validation";
}

export interface TransportRuntimeError extends RuntimeErrorBase {
  tag: "transport";
  transport: "mcp" | "http" | "sse" | "stdio" | "json-rpc" | "unknown";
  statusCode?: number;
}

export interface ProviderRuntimeError extends RuntimeErrorBase {
  tag: "provider";
  statusCode?: number;
  reason?: "rate_limit" | "unauthorized" | "unavailable" | "unknown";
}

export interface SessionRuntimeError extends RuntimeErrorBase {
  tag: "session";
  sessionState:
    | "missing"
    | "expired"
    | "aborted"
    | "conflict"
    | "unknown";
}

export interface ProcessRuntimeError extends RuntimeErrorBase {
  tag: "process";
  exitCode?: number;
  processState:
    | "not-installed"
    | "failed-to-start"
    | "terminated"
    | "unknown";
}

export type RuntimeError =
  | ValidationRuntimeError
  | TransportRuntimeError
  | ProviderRuntimeError
  | SessionRuntimeError
  | ProcessRuntimeError;

export function isRuntimeError(value: unknown): value is RuntimeError {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RuntimeError>;
  return (
    typeof candidate.tag === "string" &&
    typeof candidate.message === "string" &&
    typeof candidate.retryable === "boolean"
  );
}

export function getRuntimeErrorMessage(
  error?: RuntimeError | null,
  fallback = "Unknown error",
): string {
  return error?.message?.trim() ? error.message : fallback;
}

export function createValidationRuntimeError(
  message: string,
  options: Partial<Omit<ValidationRuntimeError, "tag" | "message">> = {},
): ValidationRuntimeError {
  return {
    tag: "validation",
    message,
    retryable: options.retryable ?? false,
    ...(options.provider ? { provider: options.provider } : {}),
  };
}

export function createTransportRuntimeError(
  message: string,
  options: Partial<Omit<TransportRuntimeError, "tag" | "message">> = {},
): TransportRuntimeError {
  return {
    tag: "transport",
    message,
    retryable: options.retryable ?? true,
    transport: options.transport ?? "unknown",
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
  };
}

export function createProviderRuntimeError(
  message: string,
  options: Partial<Omit<ProviderRuntimeError, "tag" | "message">> = {},
): ProviderRuntimeError {
  return {
    tag: "provider",
    message,
    retryable: options.retryable ?? false,
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.statusCode !== undefined ? { statusCode: options.statusCode } : {}),
    ...(options.reason ? { reason: options.reason } : {}),
  };
}

export function createSessionRuntimeError(
  message: string,
  options: Partial<Omit<SessionRuntimeError, "tag" | "message">> = {},
): SessionRuntimeError {
  return {
    tag: "session",
    message,
    retryable: options.retryable ?? false,
    sessionState: options.sessionState ?? "unknown",
    ...(options.provider ? { provider: options.provider } : {}),
  };
}

export function createProcessRuntimeError(
  message: string,
  options: Partial<Omit<ProcessRuntimeError, "tag" | "message">> = {},
): ProcessRuntimeError {
  return {
    tag: "process",
    message,
    retryable: options.retryable ?? false,
    processState: options.processState ?? "unknown",
    ...(options.provider ? { provider: options.provider } : {}),
    ...(options.exitCode !== undefined ? { exitCode: options.exitCode } : {}),
  };
}
