import { describe, expect, it } from "vitest";
import {
  enqueuePendingToolMessage,
  dequeuePendingToolMessage,
  updateToolStatusMessage,
  type PendingToolMsgIds,
} from "../ai-chat-handlers";
import type { ChatMessage } from "@/services/ai/ai-types";

describe("chat handler helpers", () => {
  describe("pending tool message queue", () => {
    it("enqueues and dequeues in FIFO order", () => {
      const pending: PendingToolMsgIds = new Map();

      enqueuePendingToolMessage(pending, "search", "msg-1");
      enqueuePendingToolMessage(pending, "search", "msg-2");

      expect(dequeuePendingToolMessage(pending, "search")).toBe("msg-1");
      expect(dequeuePendingToolMessage(pending, "search")).toBe("msg-2");
      expect(dequeuePendingToolMessage(pending, "search")).toBeUndefined();
    });

    it("returns undefined for unknown tools", () => {
      const pending: PendingToolMsgIds = new Map();

      expect(dequeuePendingToolMessage(pending, "unknown")).toBeUndefined();
    });
  });

  describe("updateToolStatusMessage", () => {
    it("marks a tool message as done", () => {
      const messages: ChatMessage[] = [
        {
          id: "tool-search-abc",
          role: "assistant",
          content: "Using search",
          timestamp: 1,
          isStreaming: true,
          toolName: "search",
          toolStatus: "running",
        },
        { id: "msg-1", role: "assistant", content: "Hello", timestamp: 2 },
      ];

      const updated = updateToolStatusMessage(
        messages,
        "tool-search-abc",
        "search",
        "done",
      );

      expect(updated[0]).toMatchObject({
        id: "tool-search-abc",
        content: "Used search",
        isStreaming: false,
        toolStatus: "done",
      });
      expect(updated[1]).toBe(messages[1]);
    });

    it("marks a tool message as error with detail", () => {
      const messages: ChatMessage[] = [
        {
          id: "tool-calc-xyz",
          role: "assistant",
          content: "Using calc",
          timestamp: 1,
          isStreaming: true,
          toolName: "calc",
          toolStatus: "running",
        },
      ];

      const updated = updateToolStatusMessage(
        messages,
        "tool-calc-xyz",
        "calc",
        "error",
        "timeout",
      );

      expect(updated[0]).toMatchObject({
        content: "Tool calc failed: timeout",
        toolStatus: "error",
      });
    });
  });
});
