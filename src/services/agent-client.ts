/**
 * SSE client for the agent loop endpoint (/api/ai/agent).
 *
 * Currently unused by the chat panel (which uses chat-client.ts → /api/ai/chat).
 * Reserved for future use when the agent endpoint supports external tool calling
 * or when the chat panel is wired to use native tool_use.
 */

import type { AgentEvent } from "shared/game-theory/types/agent";

export async function* streamAgentChat(
  params: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    provider: string;
    model?: string;
    enableWebSearch?: boolean;
    maxIterations?: number;
    canonical?: unknown;
    eventLogCursor?: number;
  },
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  let response: Response;
  try {
    response = await fetch("/api/ai/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: abortSignal,
    });
  } catch (error) {
    if (isBrowserAbortError(error)) return;
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    if (response.status === 401) {
      throw new Error(
        "API key not configured. Check Settings to connect a provider.",
      );
    }
    if (response.status === 429) {
      throw new Error("Rate limited. Please wait a moment and try again.");
    }
    if (response.status >= 500) {
      throw new Error(
        `Server error (${response.status}). The AI provider may be experiencing issues.`,
      );
    }

    throw new Error(
      `Request failed (${response.status}): ${body.slice(0, 200)}`,
    );
  }

  if (!response.body) {
    throw new Error("Response body is not readable");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      let result: ReadableStreamReadResult<Uint8Array>;
      try {
        result = await reader.read();
      } catch (error) {
        if (isBrowserAbortError(error)) return;
        throw error;
      }

      const { done, value } = result;
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        let event: AgentEvent;
        try {
          event = JSON.parse(line.slice(6)) as AgentEvent;
        } catch {
          continue;
        }

        if (event.type === "ping") continue;

        yield event;

        if (event.type === "done") return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// DOMException does not extend Error in all jsdom environments, so we
// duck-type on the .name property rather than relying on instanceof alone.
function isBrowserAbortError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const name = (error as { name?: unknown }).name;
  return name === "AbortError";
}
