import { describe, it, expect } from "vitest";
import { createAnthropicAdapter } from "./anthropic-adapter";
import type { NormalizedMessage, ToolDefinition } from "../types/agent";

function makeToolDef(name: string): ToolDefinition {
  return {
    name,
    description: `Description of ${name}`,
    inputSchema: {
      type: "object",
      properties: { value: { type: "string" } },
    },
    execute: async () => ({ success: true, data: null }),
  };
}

const sampleMessages: NormalizedMessage[] = [
  { role: "user", content: "Hello" },
];

describe("createAnthropicAdapter", () => {
  it("has correct capabilities (all true)", () => {
    const adapter = createAnthropicAdapter();
    expect(adapter.capabilities.toolUse).toBe(true);
    expect(adapter.capabilities.webSearch).toBe(true);
    expect(adapter.capabilities.compaction).toBe(true);
  });

  it("formatRequest includes system, messages, tools with input_schema", () => {
    const adapter = createAnthropicAdapter();
    const tools = [makeToolDef("get_players")];
    const request = adapter.formatRequest(sampleMessages, tools, {
      system: "You are a helpful assistant.",
    }) as Record<string, unknown>;

    expect(request.system).toBe("You are a helpful assistant.");
    expect(Array.isArray(request.messages)).toBe(true);
    expect(Array.isArray(request.tools)).toBe(true);

    const formattedTools = request.tools as Array<Record<string, unknown>>;
    expect(formattedTools).toHaveLength(1);
    expect(formattedTools[0].name).toBe("get_players");
    expect(formattedTools[0].description).toBe("Description of get_players");
    expect(formattedTools[0].input_schema).toEqual(tools[0].inputSchema);
    expect(formattedTools[0]).not.toHaveProperty("inputSchema");
  });

  it("formatRequest adds web_search tool when enableWebSearch is true", () => {
    const adapter = createAnthropicAdapter();
    const request = adapter.formatRequest(sampleMessages, [], {
      enableWebSearch: true,
    }) as Record<string, unknown>;

    const tools = request.tools as Array<Record<string, unknown>>;
    const webSearch = tools.find((t) => t.name === "web_search");
    expect(webSearch).toBeDefined();
    expect(webSearch?.type).toBe("web_search_20250305");
  });

  it("formatRequest does NOT add web_search when enableWebSearch is false", () => {
    const adapter = createAnthropicAdapter();
    const request = adapter.formatRequest(sampleMessages, [], {
      enableWebSearch: false,
    }) as Record<string, unknown>;

    const tools = request.tools as Array<Record<string, unknown>>;
    expect(tools.find((t) => t.name === "web_search")).toBeUndefined();
  });

  it("formatRequest adds context_management when enabled", () => {
    const adapter = createAnthropicAdapter();
    const request = adapter.formatRequest(sampleMessages, [], {
      contextManagement: { enabled: true },
    }) as Record<string, unknown>;

    expect(request.context_management).toEqual({
      edits: ["compact_20260112"],
    });
  });

  it("formatRequest does NOT add context_management when disabled", () => {
    const adapter = createAnthropicAdapter();
    const request = adapter.formatRequest(sampleMessages, [], {
      contextManagement: { enabled: false },
    }) as Record<string, unknown>;

    expect(request.context_management).toBeUndefined();
  });

  it("formatToolResult creates tool_result content block with correct tool_use_id for success", () => {
    const adapter = createAnthropicAdapter();
    const result = adapter.formatToolResult("tc-123", {
      success: true,
      data: { players: ["Alice", "Bob"] },
    });

    expect(result.role).toBe("tool_result");
    expect(Array.isArray(result.content)).toBe(true);

    const blocks = result.content as unknown as Array<Record<string, unknown>>;
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe("tool_result");
    expect(blocks[0].tool_use_id).toBe("tc-123");
    expect(blocks[0].content).toBe(
      JSON.stringify({ players: ["Alice", "Bob"] }),
    );
  });

  it("formatToolResult stringifies error for failure result", () => {
    const adapter = createAnthropicAdapter();
    const result = adapter.formatToolResult("tc-456", {
      success: false,
      error: "Tool not found",
    });

    const blocks = result.content as unknown as Array<Record<string, unknown>>;
    expect(blocks[0].content).toBe(JSON.stringify({ error: "Tool not found" }));
  });

  it("parseStreamChunk handles text_delta → text event", () => {
    const adapter = createAnthropicAdapter();
    const event = adapter.parseStreamChunk({
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Hello world" },
    });

    expect(event).toEqual({ type: "text", content: "Hello world" });
  });

  it("parseStreamChunk handles thinking_delta → thinking event", () => {
    const adapter = createAnthropicAdapter();
    const event = adapter.parseStreamChunk({
      type: "content_block_delta",
      index: 0,
      delta: { type: "thinking_delta", thinking: "I am reasoning..." },
    });

    expect(event).toEqual({ type: "thinking", content: "I am reasoning..." });
  });

  it("parseStreamChunk handles content_block_start with tool_use → tool_call event", () => {
    const adapter = createAnthropicAdapter();
    const event = adapter.parseStreamChunk({
      type: "content_block_start",
      index: 1,
      content_block: {
        type: "tool_use",
        id: "toolu_01",
        name: "get_players",
        input: {},
      },
    });

    expect(event).toEqual({
      type: "tool_call",
      id: "toolu_01",
      name: "get_players",
      input: {},
    });
  });

  it("parseStreamChunk handles message_stop → done event", () => {
    const adapter = createAnthropicAdapter();
    const event = adapter.parseStreamChunk({ type: "message_stop" });

    expect(event).toEqual({ type: "done", content: "" });
  });

  it("parseStreamChunk returns null for input_json_delta", () => {
    const adapter = createAnthropicAdapter();
    const event = adapter.parseStreamChunk({
      type: "content_block_delta",
      index: 1,
      delta: { type: "input_json_delta", partial_json: '{"key":' },
    });

    expect(event).toBeNull();
  });

  it("parseStreamChunk returns null for unknown event types", () => {
    const adapter = createAnthropicAdapter();
    expect(adapter.parseStreamChunk({ type: "message_start" })).toBeNull();
    expect(adapter.parseStreamChunk({ type: "ping" })).toBeNull();
    expect(adapter.parseStreamChunk(null)).toBeNull();
    expect(adapter.parseStreamChunk("raw string")).toBeNull();
  });

  it("formatRequest maps tool_result NormalizedMessage to role user", () => {
    const adapter = createAnthropicAdapter();
    const messages: NormalizedMessage[] = [
      {
        role: "tool_result",
        content: [
          { type: "tool_result", tool_use_id: "tc-1", content: '{"ok":true}' },
        ],
      },
    ];

    const request = adapter.formatRequest(messages, []) as Record<
      string,
      unknown
    >;
    const formattedMessages = request.messages as Array<
      Record<string, unknown>
    >;

    expect(formattedMessages[0].role).toBe("user");
  });

  it("formatRequest sets model and max_tokens", () => {
    const adapter = createAnthropicAdapter();
    const request = adapter.formatRequest(sampleMessages, []) as Record<
      string,
      unknown
    >;

    expect(request.model).toBe("claude-sonnet-4-6");
    expect(request.max_tokens).toBe(16384);
  });
});
