import { beforeEach, describe, expect, it, vi } from "vitest";
import { aiStore } from "@/stores/ai-store";
import type { AgentChatMessage, AgentToolCallEntry } from "@/stores/ai-store";

function makeMessage(
  overrides: Partial<Omit<AgentChatMessage, "id" | "timestamp">> = {},
): Omit<AgentChatMessage, "id" | "timestamp"> {
  return {
    role: "user",
    content: "hello",
    thinking: "",
    toolCalls: [],
    isStreaming: false,
    ...overrides,
  };
}

function makeToolCall(
  overrides: Partial<AgentToolCallEntry> = {},
): Omit<AgentToolCallEntry, "status"> & {
  status?: AgentToolCallEntry["status"];
} {
  return {
    id: "tc-1",
    name: "read_file",
    input: { path: "/tmp/test.txt" },
    ...overrides,
  };
}

describe("ai-store — agent conversation state", () => {
  beforeEach(() => {
    aiStore.setState({
      agentMessages: [],
      abortController: null,
      isStreaming: false,
    });
  });

  describe("appendAgentMessage", () => {
    it("adds a message with a generated id and ISO timestamp", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ content: "ping" }));

      const { agentMessages } = aiStore.getState();
      expect(agentMessages).toHaveLength(1);
      expect(agentMessages[0].id).toBeTruthy();
      expect(agentMessages[0].content).toBe("ping");
      // ISO 8601 check
      expect(() =>
        new Date(agentMessages[0].timestamp).toISOString(),
      ).not.toThrow();
    });

    it("generates unique ids for each message", () => {
      aiStore.getState().appendAgentMessage(makeMessage());
      aiStore.getState().appendAgentMessage(makeMessage());

      const { agentMessages } = aiStore.getState();
      expect(agentMessages[0].id).not.toBe(agentMessages[1].id);
    });

    it("does not mutate previously appended messages", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ content: "first" }));
      const snapshot = aiStore.getState().agentMessages[0];

      aiStore.getState().appendAgentMessage(makeMessage({ content: "second" }));

      expect(aiStore.getState().agentMessages[0]).toBe(snapshot);
    });
  });

  describe("updateLastAgentMessage", () => {
    it("updates the content of the last message immutably", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ content: "old" }));
      const before = aiStore.getState().agentMessages[0];

      aiStore.getState().updateLastAgentMessage({ content: "new" });

      const after = aiStore.getState().agentMessages[0];
      expect(after.content).toBe("new");
      // new object reference — immutable update
      expect(after).not.toBe(before);
    });

    it("does not affect earlier messages when there are multiple", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ content: "first" }));
      aiStore.getState().appendAgentMessage(makeMessage({ content: "second" }));
      const first = aiStore.getState().agentMessages[0];

      aiStore.getState().updateLastAgentMessage({ content: "updated second" });

      expect(aiStore.getState().agentMessages[0]).toBe(first);
      expect(aiStore.getState().agentMessages[1].content).toBe(
        "updated second",
      );
    });

    it("is a no-op when there are no messages", () => {
      expect(() =>
        aiStore.getState().updateLastAgentMessage({ content: "x" }),
      ).not.toThrow();
      expect(aiStore.getState().agentMessages).toHaveLength(0);
    });
  });

  describe("addToolCallToLastMessage", () => {
    it("appends a tool call to the last message with default pending status", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ role: "assistant" }));

      aiStore.getState().addToolCallToLastMessage(makeToolCall());

      const { toolCalls } = aiStore.getState().agentMessages[0];
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0].name).toBe("read_file");
      expect(toolCalls[0].status).toBe("pending");
    });

    it("respects an explicit status when provided", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ role: "assistant" }));

      aiStore
        .getState()
        .addToolCallToLastMessage(makeToolCall({ status: "complete" }));

      expect(aiStore.getState().agentMessages[0].toolCalls[0].status).toBe(
        "complete",
      );
    });

    it("is a no-op when there are no messages", () => {
      expect(() =>
        aiStore.getState().addToolCallToLastMessage(makeToolCall()),
      ).not.toThrow();
      expect(aiStore.getState().agentMessages).toHaveLength(0);
    });
  });

  describe("updateToolCallResult", () => {
    it("marks the matching tool call complete with result and duration", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ role: "assistant" }));
      aiStore
        .getState()
        .addToolCallToLastMessage(makeToolCall({ id: "tc-42" }));

      aiStore.getState().updateToolCallResult("tc-42", { ok: true }, 150);

      const tc = aiStore.getState().agentMessages[0].toolCalls[0];
      expect(tc.status).toBe("complete");
      expect(tc.result).toEqual({ ok: true });
      expect(tc.durationMs).toBe(150);
    });

    it("does not mutate other tool calls in the same message", () => {
      aiStore.getState().appendAgentMessage(makeMessage({ role: "assistant" }));
      aiStore.getState().addToolCallToLastMessage(makeToolCall({ id: "tc-1" }));
      aiStore.getState().addToolCallToLastMessage(makeToolCall({ id: "tc-2" }));
      const before = aiStore.getState().agentMessages[0].toolCalls[0];

      aiStore.getState().updateToolCallResult("tc-2", "done", 50);

      expect(aiStore.getState().agentMessages[0].toolCalls[0]).toBe(before);
    });

    it("is a no-op when there are no messages", () => {
      expect(() =>
        aiStore.getState().updateToolCallResult("tc-x", null, 0),
      ).not.toThrow();
    });
  });

  describe("clearAgentMessages", () => {
    it("resets agentMessages to an empty array", () => {
      aiStore.getState().appendAgentMessage(makeMessage());
      aiStore.getState().appendAgentMessage(makeMessage());

      aiStore.getState().clearAgentMessages();

      expect(aiStore.getState().agentMessages).toEqual([]);
    });
  });

  describe("stopStreaming", () => {
    it("calls abort on the controller and clears it", () => {
      const controller = new AbortController();
      const abortSpy = vi.spyOn(controller, "abort");
      aiStore.setState({ abortController: controller, isStreaming: true });

      aiStore.getState().stopStreaming();

      expect(abortSpy).toHaveBeenCalledOnce();
      expect(aiStore.getState().abortController).toBeNull();
      expect(aiStore.getState().isStreaming).toBe(false);
    });

    it("does not throw when abortController is null", () => {
      aiStore.setState({ abortController: null, isStreaming: true });

      expect(() => aiStore.getState().stopStreaming()).not.toThrow();
      expect(aiStore.getState().isStreaming).toBe(false);
    });
  });
});
