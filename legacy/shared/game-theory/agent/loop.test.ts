import { describe, it, expect, vi } from "vitest";
import { runAgentLoop, type AgentLoopDeps } from "./loop";
import type { AgentEvent, AgentLoopConfig, ToolResult } from "../types/agent";

// ── Mock factory ──

interface MockResponse {
  textChunks?: string[];
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }>;
}

function makeMockDeps(responses: MockResponse[]): AgentLoopDeps & {
  emittedEvents: AgentEvent[];
  executeToolMock: ReturnType<typeof vi.fn>;
} {
  let callCount = 0;
  const emittedEvents: AgentEvent[] = [];
  const executeToolMock = vi.fn<
    [string, Record<string, unknown>],
    Promise<ToolResult>
  >(async () => ({ success: true, data: "ok" }));

  async function* callProvider(iteration: number): AsyncGenerator<AgentEvent> {
    const response = responses[iteration] ?? responses[responses.length - 1];

    if (response.textChunks) {
      for (const chunk of response.textChunks) {
        yield { type: "text", content: chunk };
      }
    }

    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        yield { type: "tool_call", id: tc.id, name: tc.name, input: tc.input };
      }
    }

    callCount++;
  }

  const config: AgentLoopConfig = {
    maxIterations: 10,
    inactivityTimeoutMs: 60_000,
    enableWebSearch: false,
  };

  return {
    callProvider,
    executeTool: executeToolMock,
    onEvent: (event: AgentEvent) => emittedEvents.push(event),
    config,
    emittedEvents,
    executeToolMock,
  };
}

// ── Tests ──

describe("runAgentLoop", () => {
  it("streams text when no tool calls", async () => {
    const deps = makeMockDeps([{ textChunks: ["Hello", " world"] }]);
    const controller = new AbortController();

    await runAgentLoop(deps, controller.signal);

    const types = deps.emittedEvents.map((e) => e.type);
    expect(types).toEqual(["text", "text", "done"]);

    const textEvents = deps.emittedEvents.filter(
      (e) => e.type === "text",
    ) as Array<{
      type: "text";
      content: string;
    }>;
    expect(textEvents[0].content).toBe("Hello");
    expect(textEvents[1].content).toBe(" world");
  });

  it("executes tool calls and continues", async () => {
    const deps = makeMockDeps([
      { toolCalls: [{ id: "tc1", name: "my_tool", input: { arg: 42 } }] },
      { textChunks: ["Done"] },
    ]);
    const controller = new AbortController();

    await runAgentLoop(deps, controller.signal);

    // executeTool called with correct args
    expect(deps.executeToolMock).toHaveBeenCalledOnce();
    expect(deps.executeToolMock).toHaveBeenCalledWith("my_tool", { arg: 42 });

    const types = deps.emittedEvents.map((e) => e.type);
    // tool_call, tool_result, text, done
    expect(types).toEqual(["tool_call", "tool_result", "text", "done"]);

    const toolResult = deps.emittedEvents.find(
      (e) => e.type === "tool_result",
    ) as {
      type: "tool_result";
      id: string;
      result: unknown;
      duration_ms: number;
    };
    expect(toolResult.id).toBe("tc1");
    expect(toolResult.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("respects maxIterations", async () => {
    // Every response returns a tool call so the loop would run forever
    const deps = makeMockDeps([
      { toolCalls: [{ id: "tc-a", name: "looping_tool", input: {} }] },
    ]);
    deps.config.maxIterations = 3;
    const controller = new AbortController();

    await runAgentLoop(deps, controller.signal);

    // Should have called executeTool 3 times (iterations 0, 1, 2)
    expect(deps.executeToolMock).toHaveBeenCalledTimes(3);

    // Last events should be the pause text and done
    const lastEvents = deps.emittedEvents.slice(-2);
    expect(lastEvents[0].type).toBe("text");
    const pauseEvent = lastEvents[0] as { type: "text"; content: string };
    expect(pauseEvent.content).toContain("Pausing");
    expect(lastEvents[1].type).toBe("done");
  });

  it("stops on abort signal", async () => {
    const controller = new AbortController();

    // executeTool aborts after first execution
    const deps = makeMockDeps([
      { toolCalls: [{ id: "tc-abort", name: "slow_tool", input: {} }] },
      { toolCalls: [{ id: "tc-never", name: "never_called", input: {} }] },
    ]);

    const originalExecute = deps.executeTool;
    deps.executeToolMock.mockImplementationOnce(async () => {
      controller.abort();
      return { success: true, data: "aborted after this" };
    });

    await runAgentLoop(deps, controller.signal);

    // Second tool should never be called
    expect(deps.executeToolMock).toHaveBeenCalledTimes(1);

    // done should be emitted
    const doneEvents = deps.emittedEvents.filter((e) => e.type === "done");
    expect(doneEvents.length).toBeGreaterThanOrEqual(1);
  });

  it("aborts on inactivity timeout", async () => {
    const controller = new AbortController();
    const emittedEvents: AgentEvent[] = [];

    const config: AgentLoopConfig = {
      maxIterations: 10,
      inactivityTimeoutMs: 50,
      enableWebSearch: false,
    };

    // callProvider yields nothing, then waits longer than the timeout before returning
    async function* silentProvider(
      _iteration: number,
    ): AsyncGenerator<AgentEvent> {
      await new Promise<void>((resolve) => setTimeout(resolve, 200));
      // never yields any events
    }

    await runAgentLoop(
      {
        callProvider: silentProvider,
        executeTool: vi.fn(async () => ({ success: true, data: "ok" })),
        onEvent: (event) => emittedEvents.push(event),
        config,
      },
      controller.signal,
    );

    const errorEvents = emittedEvents.filter(
      (e) => e.type === "error",
    ) as Array<{ type: "error"; content: string }>;
    expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    const errorContent = errorEvents[0].content.toLowerCase();
    expect(
      errorContent.includes("inactivity") || errorContent.includes("timeout"),
    ).toBe(true);

    const lastEvent = emittedEvents[emittedEvents.length - 1];
    expect(lastEvent.type).toBe("done");
  });

  it("handles multiple tool calls in one response", async () => {
    const deps = makeMockDeps([
      {
        toolCalls: [
          { id: "tc1", name: "tool_a", input: { x: 1 } },
          { id: "tc2", name: "tool_b", input: { y: 2 } },
        ],
      },
      { textChunks: ["All done"] },
    ]);
    const controller = new AbortController();

    await runAgentLoop(deps, controller.signal);

    // Both tools executed
    expect(deps.executeToolMock).toHaveBeenCalledTimes(2);
    expect(deps.executeToolMock).toHaveBeenCalledWith("tool_a", { x: 1 });
    expect(deps.executeToolMock).toHaveBeenCalledWith("tool_b", { y: 2 });

    const types = deps.emittedEvents.map((e) => e.type);
    // tool_call x2, tool_result x2, text, done
    expect(types).toEqual([
      "tool_call",
      "tool_call",
      "tool_result",
      "tool_result",
      "text",
      "done",
    ]);

    const results = deps.emittedEvents.filter(
      (e) => e.type === "tool_result",
    ) as Array<{
      type: "tool_result";
      id: string;
      result: unknown;
      duration_ms: number;
    }>;
    expect(results[0].id).toBe("tc1");
    expect(results[1].id).toBe("tc2");
  });
});
