// adapter-types.ts — shared contracts for AI provider adapters.
// Both the Claude and Codex adapters satisfy these shapes; new providers
// (e.g. the OpenAI-compatible "custom" BYOK adapter) implement them too.

import type { ChatEvent } from "../../../shared/types/events";
import type { AnalysisActivityCallback } from "./analysis-activity";
import type { StartedSessionTurn } from "./chat-sessions";

/**
 * Options accepted by a chat adapter's streamChat(). Fields are optional and
 * union across providers: Claude uses resumeSessionId/onSessionId, Codex uses
 * existingThreadId/onThreadId. An adapter reads only the fields it understands.
 */
export interface ChatAdapterOptions {
  runId?: string;
  /** Wall-clock timeout per chat turn in ms. */
  timeoutMs?: number;
  /** Abort signal — when aborted, the adapter tears down the turn. */
  signal?: AbortSignal;
  /** Claude Agent SDK session id to resume for this turn. */
  resumeSessionId?: string;
  /** Called once when the runtime reports the Claude session id. */
  onSessionId?: (id: string) => void;
  /** Existing Codex app-server thread id to reuse for this session. */
  existingThreadId?: string;
  /** Called with the Codex app-server thread id used for this turn. */
  onThreadId?: (id: string) => void;
}

/** Interactive streaming chat contract. */
export interface ChatAdapter {
  streamChat(
    prompt: string,
    systemPrompt: string,
    model: string,
    options?: ChatAdapterOptions,
  ): AsyncGenerator<ChatEvent>;
}

/** Options accepted by an analysis adapter's runAnalysisPhase(). */
export interface AnalysisAdapterOptions {
  signal?: AbortSignal;
  runId?: string;
  maxTurns?: number;
  webSearch?: boolean;
  onActivity?: AnalysisActivityCallback;
}

/** Structured single-phase analysis contract. */
export interface AnalysisAdapter {
  runAnalysisPhase<T = unknown>(
    prompt: string,
    systemPrompt: string,
    model: string,
    schema: Record<string, unknown>,
    options?: AnalysisAdapterOptions,
  ): Promise<T>;
}

/** Prompt/system parts prepared for a single chat turn. */
export interface PreparedChatTurn {
  prompt: string;
  systemPrompt: string;
}

/** Minimal shape prepare() needs from the request body. ChatBody satisfies it. */
export interface ChatPromptSource {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  sessionKey?: string;
}

/**
 * One provider's entry in the chat routing table.
 *
 * - `prepare` builds the prompt/system parts for a turn (shared prompt-shaping
 *   logic; the hook point for provider-specific prompt handling).
 * - `adapter` is the streaming adapter the turn is dispatched to.
 * - `stream` wraps the adapter into an SSE Response and owns the remaining
 *   provider-specific glue (session resume / thread reuse, thread-expiry
 *   recovery, attachment temp files).
 *
 * Generic over the stream context so this module stays decoupled from the
 * H3/route types defined in the chat handler.
 */
export interface ChatProviderEntry<TStreamContext> {
  adapter: ChatAdapter;
  prepare: (
    body: ChatPromptSource,
    sessionResult: StartedSessionTurn | null,
  ) => PreparedChatTurn;
  stream: (ctx: TStreamContext) => Response;
}
