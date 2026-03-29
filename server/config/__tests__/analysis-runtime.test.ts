import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const ENV_PREFIX = "GAME_THEORY_ANALYSIS_RUNTIME_";

function resetAnalysisRuntimeEnv(): void {
  process.env = { ...ORIGINAL_ENV };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith(ENV_PREFIX)) {
      delete process.env[key];
    }
  }
}

async function importAnalysisRuntime() {
  vi.resetModules();
  return import("../analysis-runtime");
}

describe("analysis-runtime config", () => {
  afterEach(() => {
    resetAnalysisRuntimeEnv();
    vi.resetModules();
  });

  it("returns the exact current defaults when no env vars are set", async () => {
    resetAnalysisRuntimeEnv();

    const { analysisRuntimeConfig } = await importAnalysisRuntime();

    expect(analysisRuntimeConfig).toEqual({
      orchestrator: {
        maxRetries: 2,
        maxLoopbackPasses: 4,
        phaseTimeoutMs: 20 * 60 * 1000,
        runTimeoutMs: 30 * 60 * 1000,
        maxResultSnapshots: 10,
      },
      claude: {
        chatTimeoutMs: 5 * 60 * 1000,
        analysisMaxTurns: 12,
      },
      codex: {
        analysisIdleTimeoutMs: 3 * 60 * 1000,
        initializeTimeoutMs: 15_000,
        gracefulShutdownTimeoutMs: 2000,
        chatTimeoutMs: 5 * 60 * 1000,
        maxToolCallsPerTurn: 50,
        analysisWebSearchEnabled: true,
        chatPollIntervalMs: 1000,
        analysisPollIntervalMs: 200,
      },
      codexMcp: {
        startupTimeoutSec: 10,
        toolTimeoutSec: 120,
      },
      revalidation: {
        debounceMs: 2000,
      },
    });
  });

  it("applies env var overrides across the full config", async () => {
    resetAnalysisRuntimeEnv();
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_RETRIES = "7";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_LOOPBACK_PASSES =
      "8";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_PHASE_TIMEOUT_MS =
      "1234";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_RUN_TIMEOUT_MS =
      "5678";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_RESULT_SNAPSHOTS =
      "9";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CLAUDE_CHAT_TIMEOUT_MS = "444";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CLAUDE_ANALYSIS_MAX_TURNS = "5";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_IDLE_TIMEOUT_MS =
      "666";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_INITIALIZE_TIMEOUT_MS =
      "777";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_GRACEFUL_SHUTDOWN_TIMEOUT_MS =
      "888";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_CHAT_TIMEOUT_MS = "999";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MAX_TOOL_CALLS_PER_TURN =
      "10";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_WEB_SEARCH_ENABLED =
      "false";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_CHAT_POLL_INTERVAL_MS = "11";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_POLL_INTERVAL_MS =
      "12";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_STARTUP_TIMEOUT_SEC =
      "13";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_TOOL_TIMEOUT_SEC = "14";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_REVALIDATION_DEBOUNCE_MS = "15";

    const { analysisRuntimeConfig } = await importAnalysisRuntime();

    expect(analysisRuntimeConfig).toEqual({
      orchestrator: {
        maxRetries: 7,
        maxLoopbackPasses: 8,
        phaseTimeoutMs: 1234,
        runTimeoutMs: 5678,
        maxResultSnapshots: 9,
      },
      claude: {
        chatTimeoutMs: 444,
        analysisMaxTurns: 5,
      },
      codex: {
        analysisIdleTimeoutMs: 666,
        initializeTimeoutMs: 777,
        gracefulShutdownTimeoutMs: 888,
        chatTimeoutMs: 999,
        maxToolCallsPerTurn: 10,
        analysisWebSearchEnabled: false,
        chatPollIntervalMs: 11,
        analysisPollIntervalMs: 12,
      },
      codexMcp: {
        startupTimeoutSec: 13,
        toolTimeoutSec: 14,
      },
      revalidation: {
        debounceMs: 15,
      },
    });
  });

  it("falls back to defaults for invalid numeric and boolean env vars", async () => {
    resetAnalysisRuntimeEnv();
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_RETRIES = "NaN";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_LOOPBACK_PASSES =
      " ";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_PHASE_TIMEOUT_MS =
      "nope";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_RUN_TIMEOUT_MS =
      "still-nope";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_ORCHESTRATOR_MAX_RESULT_SNAPSHOTS =
      "";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CLAUDE_CHAT_TIMEOUT_MS = "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CLAUDE_ANALYSIS_MAX_TURNS = "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_IDLE_TIMEOUT_MS =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_INITIALIZE_TIMEOUT_MS =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_GRACEFUL_SHUTDOWN_TIMEOUT_MS =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_CHAT_TIMEOUT_MS = "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MAX_TOOL_CALLS_PER_TURN =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_WEB_SEARCH_ENABLED =
      "maybe";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_CHAT_POLL_INTERVAL_MS =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_ANALYSIS_POLL_INTERVAL_MS =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_STARTUP_TIMEOUT_SEC =
      "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_TOOL_TIMEOUT_SEC = "bad";
    process.env.GAME_THEORY_ANALYSIS_RUNTIME_REVALIDATION_DEBOUNCE_MS = "bad";

    const { analysisRuntimeConfig } = await importAnalysisRuntime();

    expect(analysisRuntimeConfig).toEqual({
      orchestrator: {
        maxRetries: 2,
        maxLoopbackPasses: 4,
        phaseTimeoutMs: 20 * 60 * 1000,
        runTimeoutMs: 30 * 60 * 1000,
        maxResultSnapshots: 10,
      },
      claude: {
        chatTimeoutMs: 5 * 60 * 1000,
        analysisMaxTurns: 12,
      },
      codex: {
        analysisIdleTimeoutMs: 3 * 60 * 1000,
        initializeTimeoutMs: 15_000,
        gracefulShutdownTimeoutMs: 2000,
        chatTimeoutMs: 5 * 60 * 1000,
        maxToolCallsPerTurn: 50,
        analysisWebSearchEnabled: true,
        chatPollIntervalMs: 1000,
        analysisPollIntervalMs: 200,
      },
      codexMcp: {
        startupTimeoutSec: 10,
        toolTimeoutSec: 120,
      },
      revalidation: {
        debounceMs: 2000,
      },
    });
  });
});
