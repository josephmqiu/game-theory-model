import type { AIStreamChunk } from "./ai-types";
import type { AIProviderType } from "@/types/agent-settings";
import {
  DEFAULT_STREAM_HARD_TIMEOUT_MS,
  DEFAULT_STREAM_NO_TEXT_TIMEOUT_MS,
  STREAM_TIMEOUT_MIN_MS,
} from "./ai-runtime-config";

export interface StreamChatOptions {
  hardTimeoutMs?: number;
  noTextTimeoutMs?: number;
  /**
   * Whether thinking events should reset the no-text timeout.
   * Default: true (backward compatible). Set to false for fast calls
   * where thinking should NOT prevent the no-text timeout from firing.
   */
  thinkingResetsTimeout?: boolean;
  /**
   * Whether keep-alive ping events reset the no-text timeout.
   * Default: true (backward compatible). Set to false to avoid endless
   * waiting when the server only emits pings.
   */
  pingResetsTimeout?: boolean;
  /**
   * Max time to wait for the first non-empty text token.
   * This timeout is independent from keep-alive pings/thinking chunks.
   */
  firstTextTimeoutMs?: number;
  /**
   * Controls provider thinking mode.
   * - adaptive: model decides thinking depth
   * - disabled: disable extended thinking for faster first text
   * - enabled: explicitly enable extended thinking
   */
  thinkingMode?: "adaptive" | "disabled" | "enabled";
  /** Thinking budget (used when thinkingMode === 'enabled'). */
  thinkingBudgetTokens?: number;
  /** Model effort level (low is usually faster). */
  effort?: "low" | "medium" | "high" | "max";
}

export interface StreamChatThreadContext {
  workspaceId?: string;
  threadId?: string;
  threadTitle?: string;
  onResolvedThread?: (identity: {
    workspaceId?: string;
    threadId?: string;
  }) => void;
}

/**
 * Streams a chat response from the server-side AI endpoint.
 * The server routes to the appropriate provider SDK (no client-side key needed).
 */
export async function* streamChat(
  _systemPrompt: string,
  messages: Array<{
    role: "user" | "assistant";
    content: string;
    attachments?: Array<{ name: string; mediaType: string; data: string }>;
  }>,
  model?: string,
  options?: StreamChatOptions,
  provider?: AIProviderType,
  abortSignal?: AbortSignal,
  runId?: string,
  threadContext?: StreamChatThreadContext,
): AsyncGenerator<AIStreamChunk> {
  const hardTimeoutMs = Math.max(
    STREAM_TIMEOUT_MIN_MS,
    options?.hardTimeoutMs ?? DEFAULT_STREAM_HARD_TIMEOUT_MS,
  );
  const noTextTimeoutMs = Math.max(
    STREAM_TIMEOUT_MIN_MS,
    options?.noTextTimeoutMs ?? DEFAULT_STREAM_NO_TEXT_TIMEOUT_MS,
  );
  const thinkingResetsTimeout = options?.thinkingResetsTimeout ?? true;
  const pingResetsTimeout = options?.pingResetsTimeout ?? true;
  const firstTextTimeoutMs = options?.firstTextTimeoutMs
    ? Math.max(STREAM_TIMEOUT_MIN_MS, options.firstTextTimeoutMs)
    : null;

  const controller = new AbortController();
  let abortReason:
    | "hard_timeout"
    | "no_text_timeout"
    | "first_text_timeout"
    | null = null;
  let noTextTimeout: ReturnType<typeof setTimeout> | null = null;
  let firstTextTimeout: ReturnType<typeof setTimeout> | null = null;
  let sawText = false;

  const clearNoTextTimeout = () => {
    if (noTextTimeout) {
      clearTimeout(noTextTimeout);
      noTextTimeout = null;
    }
  };

  const clearFirstTextTimeout = () => {
    if (firstTextTimeout) {
      clearTimeout(firstTextTimeout);
      firstTextTimeout = null;
    }
  };

  const resetActivityTimeout = () => {
    clearNoTextTimeout();
    noTextTimeout = setTimeout(() => {
      abortReason = "no_text_timeout";
      controller.abort();
    }, noTextTimeoutMs);
  };

  const hardTimeout = setTimeout(() => {
    abortReason = "hard_timeout";
    controller.abort();
  }, hardTimeoutMs);

  if (firstTextTimeoutMs) {
    firstTextTimeout = setTimeout(() => {
      if (sawText) return;
      abortReason = "first_text_timeout";
      controller.abort();
    }, firstTextTimeoutMs);
  }

  resetActivityTimeout();

  try {
    const fetchSignal = abortSignal
      ? AbortSignal.any([controller.signal, abortSignal])
      : controller.signal;

    const response = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(runId ? { "X-Run-Id": runId } : {}),
      },
      body: JSON.stringify({
        workspaceId: threadContext?.workspaceId,
        threadId: threadContext?.threadId,
        threadTitle: threadContext?.threadTitle,
        message: {
          content: messages[messages.length - 1]?.content ?? "",
          attachments: messages[messages.length - 1]?.attachments,
        },
        model,
        provider,
        thinkingMode: options?.thinkingMode,
        thinkingBudgetTokens: options?.thinkingBudgetTokens,
        effort: options?.effort,
      }),
      signal: fetchSignal,
    });

    threadContext?.onResolvedThread?.({
      workspaceId:
        response.headers.get("X-Workspace-Id") ?? threadContext.workspaceId,
      threadId: response.headers.get("X-Thread-Id") ?? threadContext.threadId,
    });

    if (!response.ok) {
      const errBody = await response.text();
      yield {
        type: "error",
        content: `Server error: ${response.status} ${errBody}`,
      };
      clearTimeout(hardTimeout);
      clearNoTextTimeout();
      clearFirstTextTimeout();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      yield { type: "error", content: "No response stream available" };
      clearTimeout(hardTimeout);
      clearNoTextTimeout();
      clearFirstTextTimeout();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from the buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6).trim();
          if (!data) continue;
          try {
            const chunk = JSON.parse(data);

            // Handle both legacy ("done") and new ChatEvent ("turn_complete") formats
            if (chunk.type === "done" || chunk.type === "turn_complete") {
              clearTimeout(hardTimeout);
              clearNoTextTimeout();
              clearFirstTextTimeout();
              return;
            }

            // Keep-alive pings from server — reset activity timeout but don't yield
            if (chunk.type === "ping") {
              if (pingResetsTimeout) {
                resetActivityTimeout();
              }
              continue;
            }

            // Normalize new ChatEvent "text_delta" to legacy "text" format
            if (chunk.type === "text_delta") {
              chunk.type = "text";
            }

            if (chunk.type === "thinking" && !chunk.content) {
              continue;
            }

            // Any non-empty text counts as activity; thinking only resets
            // the timeout when thinkingResetsTimeout is true (default).
            if (chunk.type === "text" && chunk.content?.trim().length > 0) {
              sawText = true;
              clearFirstTextTimeout();
              resetActivityTimeout();
            } else if (
              chunk.type === "thinking" &&
              chunk.content?.trim().length > 0 &&
              thinkingResetsTimeout
            ) {
              resetActivityTimeout();
            }

            // MCP tool activity keeps the connection alive
            if (
              chunk.type === "tool_call_start" ||
              chunk.type === "tool_call_result"
            ) {
              resetActivityTimeout();
            }

            // Normalize error: new ChatEvent uses "message", legacy uses "content"
            if (chunk.type === "error") {
              const normalized: AIStreamChunk = {
                type: "error",
                content:
                  chunk.content || chunk.error?.message || "Unknown error",
              };
              yield normalized;
              clearTimeout(hardTimeout);
              clearNoTextTimeout();
              clearFirstTextTimeout();
              return;
            }

            yield chunk as AIStreamChunk;
          } catch {
            // Skip malformed lines
          }
        }
      }
    }

    // Process remaining buffer
    if (buffer.startsWith("data: ")) {
      const data = buffer.slice(6).trim();
      if (data) {
        try {
          const chunk = JSON.parse(data);
          if (chunk.type === "done" || chunk.type === "turn_complete") {
            clearTimeout(hardTimeout);
            clearNoTextTimeout();
            clearFirstTextTimeout();
            return;
          }
          // Normalize new ChatEvent "text_delta" to legacy "text" format
          if (chunk.type === "text_delta") {
            chunk.type = "text";
          }
          if (chunk.type === "thinking" && !chunk.content) {
            clearTimeout(hardTimeout);
            clearNoTextTimeout();
            clearFirstTextTimeout();
            return;
          }
          if (chunk.type === "text" && chunk.content?.trim().length > 0) {
            sawText = true;
            clearFirstTextTimeout();
          }
          clearTimeout(hardTimeout);
          clearNoTextTimeout();
          clearFirstTextTimeout();
          // Normalize error format
          if (chunk.type === "error") {
            yield {
              type: "error",
              content: chunk.content || chunk.error?.message || "Unknown error",
            } as AIStreamChunk;
            return;
          }
          yield chunk as AIStreamChunk;
        } catch {
          // Skip
        }
      }
    }
  } catch (error) {
    // User-initiated stop via external abort signal
    if (abortSignal?.aborted && !abortReason) {
      clearTimeout(hardTimeout);
      clearNoTextTimeout();
      clearFirstTextTimeout();
      return;
    }

    if (controller.signal.aborted) {
      if (abortReason === "no_text_timeout") {
        console.warn("[ai-service] no-text-timeout");
        yield {
          type: "error",
          content:
            "AI has been thinking too long without output. Request stopped, please retry.",
        };
      } else if (abortReason === "hard_timeout") {
        console.warn("[ai-service] hard-timeout");
        yield {
          type: "error",
          content: "AI request timed out. Please retry.",
        };
      } else if (abortReason === "first_text_timeout") {
        console.warn("[ai-service] first-text-timeout");
        yield {
          type: "error",
          content:
            "AI spent too long thinking without producing output. Request stopped, please retry.",
        };
      } else {
        yield {
          type: "error",
          content: "AI request was aborted.",
        };
      }
      clearTimeout(hardTimeout);
      clearNoTextTimeout();
      clearFirstTextTimeout();
      return;
    }

    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    console.error("[ai-service] fetch-error:", message);
    yield { type: "error", content: message };
  } finally {
    clearTimeout(hardTimeout);
    clearNoTextTimeout();
    clearFirstTextTimeout();
  }
}
