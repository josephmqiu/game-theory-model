// Minimal logger stub for domain services.
// Will be replaced with a proper Effect-based logger in Step 3.

export interface RunLogger {
  log(category: string, event: string, data?: Record<string, unknown>): void;
  warn(category: string, event: string, data?: Record<string, unknown>): void;
  error(category: string, event: string, data?: Record<string, unknown>): void;
  capture(
    category: string,
    event: string,
    data?: Record<string, unknown>,
  ): void;
  flush(): Promise<void>;
}

export function createRunLogger(_runId: string): RunLogger {
  return {
    log(category, event, data) {
      console.log(`[${category}] ${event}`, data ?? "");
    },
    warn(category, event, data) {
      console.warn(`[${category}] ${event}`, data ?? "");
    },
    error(category, event, data) {
      console.error(`[${category}] ${event}`, data ?? "");
    },
    capture(_category, _event, _data) {
      // no-op — captures are for debug logging
    },
    async flush() {
      // no-op
    },
  };
}

export function serverLog(
  _runId: string | undefined,
  _category: string,
  _event: string,
  _data?: Record<string, unknown>,
): void {
  // no-op in domain stub — wired to real logger in Step 3
}

export function serverWarn(
  _runId: string | undefined,
  _category: string,
  _event: string,
  _data?: Record<string, unknown>,
): void {
  // no-op in domain stub — wired to real logger in Step 3
}

export function timer(): { elapsed(): number } {
  const start = Date.now();
  return {
    elapsed() {
      return Date.now() - start;
    },
  };
}
