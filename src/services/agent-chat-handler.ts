import { aiStore } from "@/stores/ai-store";
import { analysisStore } from "@/stores/analysis-store";
import { streamAgentChat } from "./agent-client";

/**
 * Orchestrates the agent chat send flow: appends messages to the store,
 * drives the SSE stream, and writes all results back through store actions.
 * Errors are surfaced via the store — this function never rejects.
 */
export async function sendAgentMessage(
  text: string,
  options?: { enableWebSearch?: boolean },
): Promise<void> {
  // 1. Append user message
  aiStore.getState().appendAgentMessage({
    role: "user",
    content: text,
    thinking: "",
    toolCalls: [],
    isStreaming: false,
  });

  // 2. Create AbortController and placeholder assistant message
  const controller = new AbortController();
  aiStore.getState().setAbortController(controller);
  aiStore.getState().setStreaming(true);
  aiStore.getState().setError(null);
  aiStore.getState().appendAgentMessage({
    role: "assistant",
    content: "",
    thinking: "",
    toolCalls: [],
    isStreaming: true,
  });

  // 3. Build prior messages from store — exclude the empty placeholder just added
  //    and only include roles the API accepts with non-empty content.
  const allMessages = aiStore.getState().agentMessages;
  const priorMessages = allMessages
    .slice(0, allMessages.length - 1) // drop the empty placeholder
    .filter((msg) => msg.content.trim().length > 0)
    .map((msg) => ({ role: msg.role, content: msg.content }));

  // 4 & 5. Call SSE client and process events
  try {
    const { provider } = aiStore.getState();
    const analysisState = analysisStore.getState();
    const stream = streamAgentChat(
      {
        messages: priorMessages,
        provider: provider.provider,
        model: provider.modelId,
        // TODO: expose a web-search toggle in ai-store so callers can control this
        enableWebSearch: options?.enableWebSearch ?? true,
        canonical: analysisState.canonical,
        eventLogCursor: analysisState.eventLog.cursor,
      },
      controller.signal,
    );

    let accumulatedContent = "";
    let accumulatedThinking = "";

    for await (const event of stream) {
      switch (event.type) {
        case "text":
          accumulatedContent += event.content;
          aiStore
            .getState()
            .updateLastAgentMessage({ content: accumulatedContent });
          break;

        case "thinking":
          accumulatedThinking += event.content;
          aiStore
            .getState()
            .updateLastAgentMessage({ thinking: accumulatedThinking });
          break;

        case "tool_call":
          aiStore.getState().addToolCallToLastMessage({
            id: event.id,
            name: event.name,
            input: event.input,
            status: "pending",
          });
          break;

        case "tool_result": {
          aiStore
            .getState()
            .updateToolCallResult(event.id, event.result, event.duration_ms);

          // Replay commands to keep client canonical store in sync
          const resultData = event.result as Record<string, unknown> | null;
          if (resultData && Array.isArray(resultData._commands)) {
            for (const command of resultData._commands) {
              try {
                analysisStore.getState().dispatch(command);
              } catch {
                // Non-fatal — the server already committed, views may be slightly out of sync
              }
            }
          }
          break;
        }

        case "error":
          aiStore.getState().setError(event.content);
          break;

        case "status":
          // Phase 3 will consume analysis_status — ignored for now
          break;

        case "compaction":
          // Ignored for now
          break;

        case "done":
          break;
      }
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred";
    aiStore.getState().setError(message);
  } finally {
    aiStore.getState().updateLastAgentMessage({ isStreaming: false });
    aiStore.getState().setStreaming(false);
    aiStore.getState().setAbortController(null);
  }
}
