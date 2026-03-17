import { describe, expect, it } from "vitest";
import { DEFAULT_AGENT_LOOP_CONFIG, type AgentEvent } from "./agent";

describe("DEFAULT_AGENT_LOOP_CONFIG", () => {
  it("has correct maxIterations", () => {
    expect(DEFAULT_AGENT_LOOP_CONFIG.maxIterations).toBe(100);
  });

  it("has correct inactivityTimeoutMs", () => {
    expect(DEFAULT_AGENT_LOOP_CONFIG.inactivityTimeoutMs).toBe(60_000);
  });

  it("has enableWebSearch set to true", () => {
    expect(DEFAULT_AGENT_LOOP_CONFIG.enableWebSearch).toBe(true);
  });
});

describe("AgentEvent union", () => {
  it("covers all 9 event types", () => {
    const allVariants: AgentEvent[] = [
      { type: "text", content: "hello" },
      { type: "thinking", content: "reasoning..." },
      { type: "tool_call", id: "tc1", name: "get_analysis_status", input: {} },
      { type: "tool_result", id: "tc1", result: { ok: true }, duration_ms: 42 },
      {
        type: "status",
        analysis_status: {
          has_analysis: true,
          description: "test event",
          phases: [],
          total_entities: 0,
          solver_ready_formalizations: [],
          warnings: [],
        },
      },
      { type: "compaction", summary: "context compacted" },
      { type: "error", content: "something went wrong" },
      { type: "done", content: "" },
      { type: "ping", content: "" },
    ];

    expect(allVariants).toHaveLength(9);
  });

  it("correctly narrows event type discriminants", () => {
    const event: AgentEvent = {
      type: "tool_call",
      id: "x",
      name: "fn",
      input: { a: 1 },
    };
    if (event.type === "tool_call") {
      expect(event.id).toBe("x");
      expect(event.name).toBe("fn");
      expect(event.input).toEqual({ a: 1 });
    }
  });
});
