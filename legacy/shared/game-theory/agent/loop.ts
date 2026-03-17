import type { AgentEvent, AgentLoopConfig, ToolResult } from "../types/agent";

export interface AgentLoopDeps {
  callProvider: (iteration: number) => AsyncGenerator<AgentEvent>;
  executeTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<ToolResult>;
  onEvent: (event: AgentEvent) => void;
  config: AgentLoopConfig;
}

interface PendingToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export async function runAgentLoop(
  deps: AgentLoopDeps,
  abortSignal: AbortSignal,
): Promise<void> {
  const { callProvider, executeTool, onEvent, config } = deps;

  let iteration = 0;
  let lastActivityTime = Date.now();

  while (!abortSignal.aborted) {
    if (iteration >= config.maxIterations) {
      onEvent({
        type: "text",
        content:
          "Pausing — reached iteration limit. Send another message to continue.",
      });
      onEvent({ type: "done", content: "" });
      return;
    }

    const pendingToolCalls: PendingToolCall[] = [];
    const stream = callProvider(iteration);

    for await (const event of stream) {
      if (abortSignal.aborted) {
        break;
      }

      lastActivityTime = Date.now();

      if (event.type === "tool_call") {
        pendingToolCalls.push({
          id: event.id,
          name: event.name,
          input: event.input,
        });
      }

      onEvent(event);
    }

    if (abortSignal.aborted) {
      onEvent({ type: "done", content: "" });
      return;
    }

    if (Date.now() - lastActivityTime > config.inactivityTimeoutMs) {
      onEvent({
        type: "error",
        content: `Agent loop aborted: inactivity timeout (${config.inactivityTimeoutMs}ms exceeded with no activity)`,
      });
      onEvent({ type: "done", content: "" });
      return;
    }

    if (pendingToolCalls.length > 0) {
      for (const toolCall of pendingToolCalls) {
        if (abortSignal.aborted) {
          break;
        }

        const startTime = Date.now();
        let result: ToolResult;
        try {
          result = await executeTool(toolCall.name, toolCall.input);
        } catch (error) {
          result = {
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Tool execution failed unexpectedly",
          };
        }
        const duration_ms = Date.now() - startTime;
        lastActivityTime = Date.now();

        onEvent({
          type: "tool_result",
          id: toolCall.id,
          result: result,
          duration_ms,
        });
      }

      iteration++;
      continue;
    }

    // No tool calls — agent is done
    onEvent({ type: "done", content: "" });
    return;
  }

  // Loop exited due to abort at the while-check
  onEvent({ type: "done", content: "" });
}
