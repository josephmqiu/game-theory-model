import type {
  RuntimeAdapter,
  RuntimeStructuredTurnInput,
} from "./adapter-contract";
import { getRuntimeAdapter } from "./adapter-contract";

/**
 * Load a RuntimeAdapter for analysis or synthesis use.
 * In test mode (GAME_THEORY_ANALYSIS_TEST_MODE=1), returns a lightweight stub
 * backed by the test-adapter module. In production, delegates to getRuntimeAdapter.
 *
 * @param testStubLabel — session ID label used in test-mode diagnostics
 * @param supportsChatTurns — when false, streamChatTurn throws; when true, it yields nothing
 * @param forwardActivity — when true, passes onActivity through to the test adapter
 */
export async function loadRuntimeAdapter(opts: {
  provider?: string;
  testStubLabel: string;
  supportsChatTurns?: boolean;
  forwardActivity?: boolean;
}): Promise<RuntimeAdapter> {
  if (process.env.GAME_THEORY_ANALYSIS_TEST_MODE === "1") {
    const mod = await import("./test-adapter");
    return {
      provider: "claude",
      createSession(key) {
        return {
          provider: "claude",
          context: key,
          streamChatTurn: async function* () {
            if (!opts.supportsChatTurns) {
              throw new Error("Test adapter does not support chat turns");
            }
          },
          runStructuredTurn<T = unknown>(input: RuntimeStructuredTurnInput) {
            return mod.runAnalysisPhase<T>(
              input.prompt,
              input.systemPrompt,
              input.model,
              input.schema,
              {
                signal: input.signal,
                ...(opts.forwardActivity && input.onActivity
                  ? { onActivity: input.onActivity }
                  : {}),
              },
            );
          },
          getDiagnostics() {
            return {
              provider: "claude",
              sessionId: opts.testStubLabel,
              details: { threadId: key.threadId },
            };
          },
          getBinding() {
            return null;
          },
          async dispose() {},
        };
      },
      async listModels() {
        return [];
      },
      async checkHealth() {
        return {
          provider: "claude",
          status: "healthy",
          reason: null,
          checkedAt: Date.now(),
          checks: [],
        };
      },
    };
  }

  return getRuntimeAdapter(opts.provider);
}
