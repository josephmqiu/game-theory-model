import { aiStore } from "@/stores/ai-store";
import { streamChat } from "./chat-client";

const CHAT_SYSTEM_PROMPT = `You are a game theory analysis copilot. Help the user explore, question, and refine their analysis. You can discuss strategic situations, explain game theory concepts, challenge assumptions, and suggest next analytical steps. Be specific — use numbers, dates, names. Cite evidence when possible.`;

/**
 * Orchestrates the agent chat send flow: appends messages to the store,
 * drives the SSE stream, and writes all results back through store actions.
 * Errors are surfaced via the store — this function never rejects.
 */
export async function sendAgentMessage(
  text: string,
  _options?: { enableWebSearch?: boolean },
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
    const stream = streamChat(
      {
        system: CHAT_SYSTEM_PROMPT,
        messages: priorMessages,
        provider: provider.provider,
        model: provider.modelId,
      },
      controller.signal,
    );

    let accumulatedContent = "";
    let accumulatedThinking = "";

    for await (const event of stream) {
      if (controller.signal.aborted) break;
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

        case "error":
          aiStore.getState().setError(event.content);
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
