import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import { z } from "zod";
import { createProviderAdapter } from "shared/game-theory/providers/adapter-factory";
import { loadSystemPrompt } from "shared/game-theory/prompts/loader";
import { createToolRegistry } from "shared/game-theory/tools/registry";
import { createEvidenceTools } from "shared/game-theory/tools/evidence-tools";
import { createPlayerTools } from "shared/game-theory/tools/player-tools";
import { createGameTools } from "shared/game-theory/tools/game-tools";
import { createHistoryTools } from "shared/game-theory/tools/history-tools";
import { createAssumptionTools } from "shared/game-theory/tools/assumption-tools";
import { createScenarioTools } from "shared/game-theory/tools/scenario-tools";
import { createWorkflowTools } from "shared/game-theory/tools/workflow-tools";
import { createReadTools } from "shared/game-theory/tools/read-tools";
import {
  createGetAnalysisStatusTool,
  createGetMethodologyPhaseTool,
} from "shared/game-theory/tools/analysis-tools";
import { runAgentLoop } from "shared/game-theory/agent/loop";
import {
  DEFAULT_AGENT_LOOP_CONFIG,
  type AgentEvent,
  type NormalizedMessage,
  type ToolContext,
} from "shared/game-theory/types/agent";
import { emptyCanonicalStore } from "shared/game-theory/types/canonical";
import { streamAnthropicChat } from "shared/game-theory/providers/anthropic-client";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "tool_result"]),
        content: z.unknown(),
      }),
    )
    .min(1),
  provider: z.string().default("anthropic"),
  model: z.string().optional(),
  enableWebSearch: z.boolean().default(true),
  maxIterations: z.number().int().min(1).max(500).optional(),
  canonical: z.record(z.unknown()).optional(),
});

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event));

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const adapter = createProviderAdapter(body.provider);
  const systemPrompt = loadSystemPrompt();

  // Build tool registry with ALL tools
  const registry = createToolRegistry();
  for (const tool of createEvidenceTools()) registry.register(tool);
  for (const tool of createPlayerTools()) registry.register(tool);
  for (const tool of createGameTools()) registry.register(tool);
  for (const tool of createHistoryTools()) registry.register(tool);
  for (const tool of createAssumptionTools()) registry.register(tool);
  for (const tool of createScenarioTools()) registry.register(tool);
  for (const tool of createWorkflowTools()) registry.register(tool);
  for (const tool of createReadTools()) registry.register(tool);
  registry.register(createGetAnalysisStatusTool());
  registry.register(createGetMethodologyPhaseTool());

  const config = {
    ...DEFAULT_AGENT_LOOP_CONFIG,
    enableWebSearch: body.enableWebSearch,
    ...(body.maxIterations ? { maxIterations: body.maxIterations } : {}),
  };

  // Build ToolContext — placeholder for now (Phase 3 will wire to real stores)
  // Use canonical from body if provided, otherwise empty
  const toolContext: ToolContext = {
    canonical: (body.canonical ?? emptyCanonicalStore()) as any,
    dispatch: () => {
      throw new Error("Dispatch not wired — use Phase 3 to connect");
    },
    getAnalysisState: () => null,
    getDerivedState: () => ({ solverResults: {} }) as any,
  };

  const encoder = new TextEncoder();

  // Accumulated conversation messages — grows each iteration with tool results
  const conversationMessages: NormalizedMessage[] = body.messages.map(
    (m) => ({ role: m.role, content: m.content }) as NormalizedMessage,
  );

  // Per-iteration tracking for tool calls observed from the stream
  let iterationToolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
  }> = [];

  // Per-iteration accumulation of tool result messages
  let iterationToolResults: NormalizedMessage[] = [];

  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(agentEvent: AgentEvent) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(agentEvent)}\n\n`),
          );
        } catch {
          // stream closed
        }
      }

      const pingTimer = setInterval(
        () => emit({ type: "ping", content: "" }),
        15_000,
      );

      try {
        await runAgentLoop(
          {
            callProvider: async function* (iteration) {
              // Reset per-iteration tracking
              iterationToolCalls = [];
              iterationToolResults = [];

              // On iteration > 0, the previous iteration's tool calls and results
              // have already been appended to conversationMessages via onEvent.
              // conversationMessages is always up-to-date before callProvider is called.
              const request = adapter.formatRequest({
                system: systemPrompt,
                messages: conversationMessages,
                tools: registry.listAll(),
                enableWebSearch:
                  config.enableWebSearch && adapter.capabilities.webSearch,
                contextManagement: adapter.capabilities.compaction
                  ? { enabled: true }
                  : undefined,
              });

              yield* streamAnthropicChat(
                request,
                adapter,
                abortController.signal,
              );
            },
            executeTool: async (name, input) => {
              const tool = registry.get(name);
              if (!tool)
                return { success: false, error: `Unknown tool: ${name}` };
              return tool.execute(input, toolContext);
            },
            onEvent: (agentEvent) => {
              // Track tool calls so we can reconstruct the assistant message
              if (agentEvent.type === "tool_call") {
                iterationToolCalls.push({
                  id: agentEvent.id,
                  name: agentEvent.name,
                  input: agentEvent.input,
                });
              }

              // When a tool result arrives, build the tool_result message and
              // append both the assistant tool_use block and the result to conversation.
              // The loop emits one tool_result per tool call, in order.
              if (agentEvent.type === "tool_result") {
                const toolResultMsg = adapter.formatToolResult(
                  agentEvent.id,
                  agentEvent.result as Parameters<
                    typeof adapter.formatToolResult
                  >[1],
                );
                iterationToolResults.push(toolResultMsg);

                // Once all tool results for this iteration have arrived,
                // append the assistant turn (all tool_use blocks) and the
                // tool_result user turn to the conversation.
                if (iterationToolResults.length === iterationToolCalls.length) {
                  const assistantMessage: NormalizedMessage = {
                    role: "assistant",
                    content: iterationToolCalls.map((tc) => ({
                      type: "tool_use" as const,
                      id: tc.id,
                      name: tc.name,
                      input: tc.input,
                    })),
                  };
                  const toolResultsMessage: NormalizedMessage = {
                    role: "user",
                    content: iterationToolResults.flatMap((m) =>
                      Array.isArray(m.content) ? m.content : [],
                    ),
                  };

                  conversationMessages.push(assistantMessage);
                  conversationMessages.push(toolResultsMessage);
                }
              }

              emit(agentEvent);
            },
            config,
          },
          abortController.signal,
        );
      } catch (error) {
        emit({
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
});
