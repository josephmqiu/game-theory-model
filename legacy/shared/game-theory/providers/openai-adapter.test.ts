import { describe, it, expect } from "vitest";
import { createOpenAIAdapter } from "./openai-adapter";
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

describe("createOpenAIAdapter", () => {
  it("has correct capabilities (all true)", () => {
    const adapter = createOpenAIAdapter();
    expect(adapter.capabilities.toolUse).toBe(true);
    expect(adapter.capabilities.webSearch).toBe(true);
    expect(adapter.capabilities.compaction).toBe(true);
  });

  it("formatRequest maps tools to function format", () => {
    const adapter = createOpenAIAdapter();
    const tools = [makeToolDef("get_players")];
    const request = adapter.formatRequest({
      system: "You are a helpful assistant.",
      messages: sampleMessages,
      tools,
    }) as Record<string, unknown>;

    expect(request.model).toBe("gpt-4.1");
    expect(Array.isArray(request.tools)).toBe(true);

    const formattedTools = request.tools as Array<Record<string, unknown>>;
    expect(formattedTools).toHaveLength(1);
    expect(formattedTools[0].type).toBe("function");

    const fn = formattedTools[0].function as Record<string, unknown>;
    expect(fn.name).toBe("get_players");
    expect(fn.description).toBe("Description of get_players");
    expect(fn.parameters).toEqual(tools[0].inputSchema);
    expect(fn).not.toHaveProperty("inputSchema");
  });

  it("formatRequest adds web_search_preview when enableWebSearch is true", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "",
      messages: sampleMessages,
      tools: [],
      enableWebSearch: true,
    }) as Record<string, unknown>;

    const tools = request.tools as Array<Record<string, unknown>>;
    const webSearch = tools.find((t) => t.type === "web_search_preview");
    expect(webSearch).toBeDefined();
  });

  it("formatRequest does NOT add web_search_preview when enableWebSearch is false", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "",
      messages: sampleMessages,
      tools: [],
      enableWebSearch: false,
    }) as Record<string, unknown>;

    const tools = request.tools as Array<Record<string, unknown>>;
    expect(tools.find((t) => t.type === "web_search_preview")).toBeUndefined();
  });

  it("formatRequest adds system prompt as first message", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "You are a game theory expert.",
      messages: sampleMessages,
      tools: [],
    }) as Record<string, unknown>;

    const messages = request.messages as Array<Record<string, unknown>>;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe("You are a game theory expert.");
    expect(messages[1].role).toBe("user");
  });

  it("formatRequest does not add system message when system is empty", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "",
      messages: sampleMessages,
      tools: [],
    }) as Record<string, unknown>;

    const messages = request.messages as Array<Record<string, unknown>>;
    expect(messages[0].role).toBe("user");
  });

  it("formatRequest adds context_management when enabled", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "",
      messages: sampleMessages,
      tools: [],
      contextManagement: { enabled: true },
    }) as Record<string, unknown>;

    expect(request.context_management).toEqual({ compact_threshold: 0.8 });
  });

  it("formatRequest does NOT add context_management when disabled", () => {
    const adapter = createOpenAIAdapter();
    const request = adapter.formatRequest({
      system: "",
      messages: sampleMessages,
      tools: [],
      contextManagement: { enabled: false },
    }) as Record<string, unknown>;

    expect(request.context_management).toBeUndefined();
  });

  it("formatToolResult creates correct tool_result structure", () => {
    const adapter = createOpenAIAdapter();
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
    const adapter = createOpenAIAdapter();
    const result = adapter.formatToolResult("tc-456", {
      success: false,
      error: "Tool not found",
    });

    const blocks = result.content as unknown as Array<Record<string, unknown>>;
    expect(blocks[0].content).toBe(JSON.stringify({ error: "Tool not found" }));
  });

  it("parseStreamChunk handles text content → text event", () => {
    const adapter = createOpenAIAdapter();
    const events = adapter.parseStreamChunk({
      choices: [
        {
          delta: { content: "Hello world" },
          finish_reason: null,
        },
      ],
    });

    expect(events).toEqual([{ type: "text", content: "Hello world" }]);
  });

  it("parseStreamChunk handles finish_reason stop → done event", () => {
    const adapter = createOpenAIAdapter();
    const events = adapter.parseStreamChunk({
      choices: [
        {
          delta: {},
          finish_reason: "stop",
        },
      ],
    });

    expect(events).toEqual([{ type: "done", content: "" }]);
  });

  it("parseStreamChunk handles complete tool_call → tool_call event", () => {
    const adapter = createOpenAIAdapter();
    const events = adapter.parseStreamChunk({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                id: "call_abc",
                function: {
                  name: "get_players",
                  arguments: '{"value":"test"}',
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    expect(events).toEqual([
      {
        type: "tool_call",
        id: "call_abc",
        name: "get_players",
        input: { value: "test" },
      },
    ]);
  });

  it("parseStreamChunk returns empty array for partial tool_call with no name", () => {
    const adapter = createOpenAIAdapter();
    const events = adapter.parseStreamChunk({
      choices: [
        {
          delta: {
            tool_calls: [
              {
                id: "call_abc",
                function: {
                  arguments: '{"partial":',
                },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    expect(events).toEqual([]);
  });

  it("parseStreamChunk returns empty array for unknown chunks", () => {
    const adapter = createOpenAIAdapter();
    expect(adapter.parseStreamChunk(null)).toEqual([]);
    expect(adapter.parseStreamChunk("raw string")).toEqual([]);
    expect(adapter.parseStreamChunk({})).toEqual([]);
    expect(adapter.parseStreamChunk({ choices: [] })).toEqual([]);
  });
});
