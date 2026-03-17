import type {
  AgentEvent,
  FormatRequestParams,
  NormalizedMessage,
  ProviderAdapter,
  ToolResult,
} from "../types/agent";

// ── Stream chunk parsing ──

function parseChunk(chunk: unknown): AgentEvent[] {
  if (!chunk || typeof chunk !== "object") return [];

  const event = chunk as Record<string, unknown>;

  // Try to extract text content from any common chunk shape
  if (typeof event.content === "string") {
    return [{ type: "text", content: event.content }];
  }

  if (typeof event.text === "string") {
    return [{ type: "text", content: event.text }];
  }

  const delta = event.delta as Record<string, unknown> | undefined;
  if (delta && typeof delta.content === "string") {
    return [{ type: "text", content: delta.content }];
  }

  if (delta && typeof delta.text === "string") {
    return [{ type: "text", content: delta.text }];
  }

  return [];
}

// ── Factory ──

export function createGenericAdapter(providerName: string): ProviderAdapter {
  return {
    name: providerName,

    capabilities: {
      toolUse: false,
      webSearch: false,
      compaction: false,
    },

    formatRequest({
      system,
      messages,
    }: FormatRequestParams): Record<string, unknown> {
      const mappedMessages = messages.map((msg) => ({
        role: msg.role,
        content:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      }));

      return {
        messages: system
          ? [{ role: "system", content: system }, ...mappedMessages]
          : mappedMessages,
      };
    },

    parseStreamChunk(chunk: unknown): AgentEvent[] {
      return parseChunk(chunk);
    },

    formatToolResult(toolUseId: string, result: ToolResult): NormalizedMessage {
      const content = result.success
        ? JSON.stringify(result.data)
        : JSON.stringify({ error: result.error });

      return {
        role: "tool_result",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            content,
          },
        ],
      };
    },
  };
}
