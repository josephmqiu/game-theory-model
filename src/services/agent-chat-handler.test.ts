import { describe, it, expect, vi, beforeEach } from "vitest";
import { aiStore } from "@/stores/ai-store";
import { sendAgentMessage } from "./agent-chat-handler";
import type { AIStreamChunk } from "shared/game-theory/types/ai-stream";

vi.mock("./chat-client", () => ({
  streamChat: vi.fn(),
}));

import { streamChat } from "./chat-client";

// Helper: create an async generator from a list of events
async function* makeStream(
  events: AIStreamChunk[],
): AsyncGenerator<AIStreamChunk> {
  for (const event of events) {
    yield event;
  }
}

// Reset store to its baseline between tests
const resetState = () =>
  aiStore.setState({
    provider: { provider: "anthropic", modelId: "claude-sonnet-4-6" },
    isStreaming: false,
    streamingPhase: null,
    lastError: null,
    agentMessages: [],
    abortController: null,
  });

beforeEach(() => {
  resetState();
  vi.clearAllMocks();
});

describe("sendAgentMessage", () => {
  it("appends user message and placeholder assistant message to the store", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([{ type: "done", content: "" }]),
    );

    await sendAgentMessage("Hello");

    const { agentMessages } = aiStore.getState();
    expect(agentMessages).toHaveLength(2);
    expect(agentMessages[0].role).toBe("user");
    expect(agentMessages[0].content).toBe("Hello");
    expect(agentMessages[1].role).toBe("assistant");
  });

  it("accumulates text events into assistant message content", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([
        { type: "text", content: "Hello" },
        { type: "text", content: ", world" },
        { type: "done", content: "" },
      ]),
    );

    await sendAgentMessage("Hi");

    const { agentMessages } = aiStore.getState();
    const assistant = agentMessages[agentMessages.length - 1];
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).toBe("Hello, world");
  });

  it("accumulates thinking events into assistant message thinking field", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([
        { type: "thinking", content: "Let me " },
        { type: "thinking", content: "think..." },
        { type: "done", content: "" },
      ]),
    );

    await sendAgentMessage("Think about this");

    const { agentMessages } = aiStore.getState();
    const assistant = agentMessages[agentMessages.length - 1];
    expect(assistant.thinking).toBe("Let me think...");
  });

  it("sets the store error on an error event", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([
        { type: "error", content: "Something went wrong" },
        { type: "done", content: "" },
      ]),
    );

    await sendAgentMessage("Cause an error");

    expect(aiStore.getState().lastError).toBe("Something went wrong");
  });

  it("marks streaming complete after done event", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([
        { type: "text", content: "Done!" },
        { type: "done", content: "" },
      ]),
    );

    await sendAgentMessage("Finish");

    const state = aiStore.getState();
    expect(state.isStreaming).toBe(false);
    expect(state.abortController).toBeNull();

    const assistant = state.agentMessages[state.agentMessages.length - 1];
    expect(assistant.isStreaming).toBe(false);
  });

  it("handles abort without setting an error in the store", async () => {
    // streamChat itself silently returns on abort (see chat-client.ts).
    // Simulate that: the generator simply finishes without yielding.
    vi.mocked(streamChat).mockReturnValue(
      (async function* () {
        // Generator ends immediately, simulating aborted fetch
      })(),
    );

    await sendAgentMessage("Abort me");

    const state = aiStore.getState();
    // No error should be set for an abort
    expect(state.lastError).toBeNull();
    expect(state.isStreaming).toBe(false);
  });

  it("sets a store error when the stream throws unexpectedly", async () => {
    vi.mocked(streamChat).mockReturnValue(
      (async function* () {
        throw new Error("Network failure");
        yield { type: "done", content: "" } as AIStreamChunk; // unreachable, keeps TS happy
      })(),
    );

    await sendAgentMessage("Fail hard");

    expect(aiStore.getState().lastError).toBe("Network failure");
    expect(aiStore.getState().isStreaming).toBe(false);
  });

  it("passes system prompt, provider, and model to streamChat", async () => {
    vi.mocked(streamChat).mockReturnValue(
      makeStream([{ type: "done", content: "" }]),
    );

    await sendAgentMessage("Test provider params");

    expect(vi.mocked(streamChat)).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("game theory"),
        provider: "anthropic",
        model: "claude-sonnet-4-6",
      }),
      expect.any(AbortSignal),
    );
  });
});
