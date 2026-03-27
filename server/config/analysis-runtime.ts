const ENV_PREFIX = "GAME_THEORY_ANALYSIS_RUNTIME_";
const DEFAULT_ORCHESTRATOR_PHASE_TIMEOUT_MS = 20 * 60 * 1000;
const DEFAULT_ORCHESTRATOR_RUN_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_ANALYZE_SSE_STREAM_TIMEOUT_BUFFER_MS = 60 * 1000;

export interface AnalysisRuntimeConfig {
  orchestrator: {
    maxRetries: number;
    maxLoopbackPasses: number;
    phaseTimeoutMs: number;
    runTimeoutMs: number;
    maxResultSnapshots: number;
  };
  analyzeSse: {
    keepaliveIntervalMs: number;
    streamTimeoutMs: number;
    snapshotSettleDelayMs: number;
  };
  claude: {
    chatTimeoutMs: number;
    analysisMaxTurns: number;
  };
  codex: {
    analysisIdleTimeoutMs: number;
    initializeTimeoutMs: number;
    gracefulShutdownTimeoutMs: number;
    chatTimeoutMs: number;
    maxToolCallsPerTurn: number;
    analysisWebSearchEnabled: boolean;
    chatPollIntervalMs: number;
    analysisPollIntervalMs: number;
  };
  codexMcp: {
    startupTimeoutSec: number;
    toolTimeoutSec: number;
  };
  revalidation: {
    debounceMs: number;
  };
}

function readEnv(name: string): string | undefined {
  return process.env[`${ENV_PREFIX}${name}`];
}

function parseIntegerEnv(name: string, fallback: number): number {
  const rawValue = readEnv(name);
  if (rawValue === undefined) return fallback;

  const trimmedValue = rawValue.trim();
  if (trimmedValue.length === 0) return fallback;

  const parsedValue = Number.parseInt(trimmedValue, 10);
  return Number.isNaN(parsedValue) ? fallback : parsedValue;
}

function parseBooleanEnv(name: string, fallback: boolean): boolean {
  const rawValue = readEnv(name);
  if (rawValue === undefined) return fallback;

  const normalizedValue = rawValue.trim().toLowerCase();
  if (normalizedValue === "1" || normalizedValue === "true") return true;
  if (normalizedValue === "0" || normalizedValue === "false") return false;
  return fallback;
}

const orchestratorRunTimeoutMs = parseIntegerEnv(
  "ORCHESTRATOR_RUN_TIMEOUT_MS",
  DEFAULT_ORCHESTRATOR_RUN_TIMEOUT_MS,
);

const defaultAnalyzeSseStreamTimeoutMs =
  orchestratorRunTimeoutMs + DEFAULT_ANALYZE_SSE_STREAM_TIMEOUT_BUFFER_MS;

export const analysisRuntimeConfig: AnalysisRuntimeConfig = Object.freeze({
  orchestrator: Object.freeze({
    maxRetries: parseIntegerEnv("ORCHESTRATOR_MAX_RETRIES", 2),
    maxLoopbackPasses: parseIntegerEnv("ORCHESTRATOR_MAX_LOOPBACK_PASSES", 4),
    phaseTimeoutMs: parseIntegerEnv(
      "ORCHESTRATOR_PHASE_TIMEOUT_MS",
      DEFAULT_ORCHESTRATOR_PHASE_TIMEOUT_MS,
    ),
    runTimeoutMs: orchestratorRunTimeoutMs,
    maxResultSnapshots: parseIntegerEnv(
      "ORCHESTRATOR_MAX_RESULT_SNAPSHOTS",
      10,
    ),
  }),
  analyzeSse: Object.freeze({
    keepaliveIntervalMs: parseIntegerEnv(
      "ANALYZE_SSE_KEEPALIVE_INTERVAL_MS",
      15_000,
    ),
    streamTimeoutMs: parseIntegerEnv(
      "ANALYZE_SSE_STREAM_TIMEOUT_MS",
      defaultAnalyzeSseStreamTimeoutMs,
    ),
    snapshotSettleDelayMs: parseIntegerEnv(
      "ANALYZE_SSE_SNAPSHOT_SETTLE_DELAY_MS",
      100,
    ),
  }),
  claude: Object.freeze({
    chatTimeoutMs: parseIntegerEnv("CLAUDE_CHAT_TIMEOUT_MS", 5 * 60 * 1000),
    analysisMaxTurns: parseIntegerEnv("CLAUDE_ANALYSIS_MAX_TURNS", 12),
  }),
  codex: Object.freeze({
    analysisIdleTimeoutMs: parseIntegerEnv(
      "CODEX_ANALYSIS_IDLE_TIMEOUT_MS",
      parseIntegerEnv("CODEX_ANALYSIS_TIMEOUT_MS", 3 * 60 * 1000),
    ),
    initializeTimeoutMs: parseIntegerEnv("CODEX_INITIALIZE_TIMEOUT_MS", 15_000),
    gracefulShutdownTimeoutMs: parseIntegerEnv(
      "CODEX_GRACEFUL_SHUTDOWN_TIMEOUT_MS",
      2000,
    ),
    chatTimeoutMs: parseIntegerEnv("CODEX_CHAT_TIMEOUT_MS", 5 * 60 * 1000),
    maxToolCallsPerTurn: parseIntegerEnv("CODEX_MAX_TOOL_CALLS_PER_TURN", 50),
    analysisWebSearchEnabled: parseBooleanEnv(
      "CODEX_ANALYSIS_WEB_SEARCH_ENABLED",
      true,
    ),
    chatPollIntervalMs: parseIntegerEnv("CODEX_CHAT_POLL_INTERVAL_MS", 1000),
    analysisPollIntervalMs: parseIntegerEnv(
      "CODEX_ANALYSIS_POLL_INTERVAL_MS",
      200,
    ),
  }),
  codexMcp: Object.freeze({
    startupTimeoutSec: parseIntegerEnv("CODEX_MCP_STARTUP_TIMEOUT_SEC", 10),
    toolTimeoutSec: parseIntegerEnv("CODEX_MCP_TOOL_TIMEOUT_SEC", 120),
  }),
  revalidation: Object.freeze({
    debounceMs: parseIntegerEnv("REVALIDATION_DEBOUNCE_MS", 2000),
  }),
});
