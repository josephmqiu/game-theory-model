import type {
  AgentEvent,
  FormatRequestParams,
  NormalizedContentBlock,
  NormalizedMessage,
  ProviderAdapter,
  ToolDefinition,
  ToolResult,
} from "../types/agent";

const MODEL = "gpt-4.1";

// ── OpenAI-specific types ──

interface OpenAIFunctionTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIWebSearchTool {
  type: "web_search_preview";
}

type OpenAITool = OpenAIFunctionTool | OpenAIWebSearchTool;

interface OpenAISystemMessage {
  role: "system";
  content: string;
}

interface OpenAIUserMessage {
  role: "user";
  content: string;
}

interface OpenAIAssistantMessage {
  role: "assistant";
  content: string;
}

interface OpenAIToolMessage {
  role: "tool";
  tool_call_id: string;
  content: string;
}

type OpenAIMessage =
  | OpenAISystemMessage
  | OpenAIUserMessage
  | OpenAIAssistantMessage
  | OpenAIToolMessage;

// ── Mapping helpers ──

function mapToolDefinitions(tools: ToolDefinition[]): OpenAIFunctionTool[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

function serializeContentBlocks(blocks: NormalizedContentBlock[]): string {
  return JSON.stringify(blocks);
}

function mapMessage(msg: NormalizedMessage): OpenAIMessage {
  if (msg.role === "tool_result") {
    // Find the tool_use_id from the content block
    const block = Array.isArray(msg.content)
      ? (msg.content.find((b) => b.type === "tool_result") ?? msg.content[0])
      : null;

    const toolCallId =
      block && typeof block === "object" && "tool_use_id" in block
        ? (block.tool_use_id ?? "")
        : "";

    const content =
      block && typeof block === "object" && "content" in block
        ? (block.content ?? "")
        : typeof msg.content === "string"
          ? msg.content
          : serializeContentBlocks(msg.content as NormalizedContentBlock[]);

    return {
      role: "tool",
      tool_call_id: toolCallId,
      content,
    };
  }

  if (typeof msg.content === "string") {
    return {
      role: msg.role as "user" | "assistant",
      content: msg.content,
    };
  }

  return {
    role: msg.role as "user" | "assistant",
    content: serializeContentBlocks(msg.content),
  };
}

// ── Stream chunk parsing ──

function parseChunk(chunk: unknown): AgentEvent[] {
  if (!chunk || typeof chunk !== "object") return [];

  const event = chunk as Record<string, unknown>;

  // Check for choices array (standard streaming response)
  const choices = event.choices as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(choices) || choices.length === 0) return [];

  const choice = choices[0];
  const finishReason = choice.finish_reason as string | undefined;

  if (finishReason === "stop") {
    return [{ type: "done", content: "" }];
  }

  const delta = choice.delta as Record<string, unknown> | undefined;
  if (!delta) return [];

  // Text content
  if (typeof delta.content === "string") {
    return [{ type: "text", content: delta.content }];
  }

  // Tool calls — only emit when we have both name and complete arguments
  const toolCalls = delta.tool_calls as
    | Array<Record<string, unknown>>
    | undefined;
  if (Array.isArray(toolCalls)) {
    const events: AgentEvent[] = [];
    for (const toolCall of toolCalls) {
      const fn = toolCall.function as Record<string, unknown> | undefined;
      if (!fn) continue;

      const name = fn.name as string | undefined;
      const args = fn.arguments as string | undefined;

      if (name && args) {
        let parsedInput: Record<string, unknown> = {};
        try {
          parsedInput = JSON.parse(args) as Record<string, unknown>;
        } catch {
          // Arguments not yet complete — skip
          continue;
        }

        events.push({
          type: "tool_call",
          id: (toolCall.id as string) ?? "",
          name,
          input: parsedInput,
        });
      }
    }
    return events;
  }

  return [];
}

// ── Factory ──

export function createOpenAIAdapter(): ProviderAdapter {
  return {
    name: "openai",

    capabilities: {
      toolUse: true,
      webSearch: true,
      compaction: true,
    },

    formatRequest({
      system,
      messages,
      tools,
      contextManagement,
      enableWebSearch = false,
    }: FormatRequestParams): Record<string, unknown> {
      const openaiTools: OpenAITool[] = mapToolDefinitions(tools);

      if (enableWebSearch) {
        openaiTools.push({ type: "web_search_preview" });
      }

      const mappedMessages: OpenAIMessage[] = messages.map(mapMessage);

      // System prompt goes as first message
      const allMessages: OpenAIMessage[] = system
        ? [{ role: "system", content: system }, ...mappedMessages]
        : mappedMessages;

      const request: Record<string, unknown> = {
        model: MODEL,
        messages: allMessages,
        tools: openaiTools,
      };

      if (contextManagement?.enabled) {
        request.context_management = { compact_threshold: 0.8 };
      }

      return request;
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
