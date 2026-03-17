import type {
  AgentEvent,
  ContextManagementConfig,
  NormalizedContentBlock,
  NormalizedMessage,
  ProviderAdapter,
  ToolDefinition,
  ToolResult,
} from "../types/agent";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 16384;

// ── Anthropic-specific types ──

interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicWebSearchTool {
  type: "web_search_20250305";
  name: "web_search";
}

interface AnthropicTextBlock {
  type: "text";
  text: string;
}

interface AnthropicThinkingBlock {
  type: "thinking";
  thinking: string;
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type AnthropicContentBlock =
  | AnthropicTextBlock
  | AnthropicThinkingBlock
  | AnthropicToolUseBlock
  | AnthropicToolResultBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

// ── Mapping helpers ──

function mapToolDefinitions(tools: ToolDefinition[]): AnthropicTool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

function mapContentBlock(block: NormalizedContentBlock): AnthropicContentBlock {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text ?? "" };
    case "thinking":
      return { type: "thinking", thinking: block.text ?? "" };
    case "tool_use":
      return {
        type: "tool_use",
        id: block.id ?? "",
        name: block.name ?? "",
        input: block.input ?? {},
      };
    case "tool_result":
      return {
        type: "tool_result",
        tool_use_id: block.tool_use_id ?? "",
        content: block.content ?? "",
      };
  }
}

function mapMessage(msg: NormalizedMessage): AnthropicMessage {
  // Anthropic requires tool_result messages to arrive under role: 'user'
  const role: "user" | "assistant" =
    msg.role === "assistant" ? "assistant" : "user";

  if (typeof msg.content === "string") {
    return { role, content: msg.content };
  }

  return {
    role,
    content: msg.content.map(mapContentBlock),
  };
}

// ── Stream chunk parsing ──

function parseChunk(chunk: unknown): AgentEvent | null {
  if (!chunk || typeof chunk !== "object") return null;

  const event = chunk as Record<string, unknown>;
  const eventType = event.type as string | undefined;

  if (!eventType) return null;

  if (eventType === "message_stop") {
    return { type: "done", content: "" };
  }

  if (eventType === "content_block_start") {
    const contentBlock = event.content_block as
      | Record<string, unknown>
      | undefined;
    if (contentBlock?.type === "tool_use") {
      return {
        type: "tool_call",
        id: (contentBlock.id as string) ?? "",
        name: (contentBlock.name as string) ?? "",
        input: (contentBlock.input as Record<string, unknown>) ?? {},
      };
    }
    return null;
  }

  if (eventType === "content_block_delta") {
    const delta = event.delta as Record<string, unknown> | undefined;
    if (!delta) return null;

    const deltaType = delta.type as string | undefined;

    if (deltaType === "text_delta") {
      return { type: "text", content: (delta.text as string) ?? "" };
    }

    if (deltaType === "thinking_delta") {
      return { type: "thinking", content: (delta.thinking as string) ?? "" };
    }

    if (deltaType === "input_json_delta") {
      // Tool input is accumulated by the caller; nothing to emit
      return null;
    }
  }

  return null;
}

// ── Factory ──

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    name: "anthropic",

    capabilities: {
      toolUse: true,
      webSearch: true,
      compaction: true,
    },

    formatRequest(
      messages: NormalizedMessage[],
      tools: ToolDefinition[],
      options?: Record<string, unknown>,
    ): Record<string, unknown> {
      const system = (options?.system as string) ?? "";
      const enableWebSearch = (options?.enableWebSearch as boolean) ?? false;
      const contextManagement = options?.contextManagement as
        | ContextManagementConfig
        | undefined;

      const anthropicTools: Array<AnthropicTool | AnthropicWebSearchTool> =
        mapToolDefinitions(tools);

      if (enableWebSearch) {
        anthropicTools.push({
          type: "web_search_20250305",
          name: "web_search",
        });
      }

      const request: Record<string, unknown> = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system,
        messages: messages.map(mapMessage),
        tools: anthropicTools,
      };

      if (contextManagement?.enabled) {
        request.context_management = { edits: ["compact_20260112"] };
      }

      return request;
    },

    parseStreamChunk(chunk: unknown): AgentEvent | null {
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
