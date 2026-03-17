import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent, ProviderAdapter } from "../types/agent";

export async function* streamAnthropicChat(
  request: Record<string, unknown>,
  adapter: ProviderAdapter,
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic();

  const stream = client.messages.stream(
    request as Parameters<typeof client.messages.stream>[0],
    {
      signal: abortSignal,
    },
  );

  for await (const event of stream) {
    if (abortSignal?.aborted) {
      break;
    }

    for (const agentEvent of adapter.parseStreamChunk(event)) {
      yield agentEvent;
    }
  }
}
