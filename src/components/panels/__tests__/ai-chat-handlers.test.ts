import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  dequeuePendingToolMessage,
  enqueuePendingToolMessage,
  updateToolStatusMessage,
  type PendingToolMsgIds,
} from "@/components/panels/ai-chat-handlers";
import type { ChatMessage } from "@/services/ai/ai-types";

const aiChatHandlersPath = join(
  process.cwd(),
  "src/components/panels/ai-chat-handlers.ts",
);

function createToolMessage(id: string): ChatMessage {
  return {
    id,
    role: "assistant",
    content: "Using get_analysis_status",
    timestamp: 1,
    isStreaming: true,
    toolName: "get_analysis_status",
    toolStatus: "running",
  };
}

describe("ai-chat tool lifecycle helpers", () => {
  it("marks successful tool rows done in FIFO order for repeated tool calls", () => {
    const pendingToolMsgIds: PendingToolMsgIds = new Map();
    let messages: ChatMessage[] = [
      createToolMessage("tool-get_analysis_status-1"),
      createToolMessage("tool-get_analysis_status-2"),
    ];

    enqueuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
      "tool-get_analysis_status-1",
    );
    enqueuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
      "tool-get_analysis_status-2",
    );

    const firstResolved = dequeuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
    );
    messages = updateToolStatusMessage(
      messages,
      firstResolved!,
      "get_analysis_status",
      "done",
    );

    const secondResolved = dequeuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
    );
    messages = updateToolStatusMessage(
      messages,
      secondResolved!,
      "get_analysis_status",
      "done",
    );

    expect(firstResolved).toBe("tool-get_analysis_status-1");
    expect(secondResolved).toBe("tool-get_analysis_status-2");
    expect(messages.map((message) => message.toolStatus)).toEqual([
      "done",
      "done",
    ]);
    expect(pendingToolMsgIds.size).toBe(0);
  });

  it("keeps failed tool rows visible after resolving the oldest pending call", () => {
    const pendingToolMsgIds: PendingToolMsgIds = new Map();
    const messageId = "tool-get_analysis_status-1";
    let messages: ChatMessage[] = [createToolMessage(messageId)];

    enqueuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
      messageId,
    );

    const resolved = dequeuePendingToolMessage(
      pendingToolMsgIds,
      "get_analysis_status",
    );
    messages = updateToolStatusMessage(
      messages,
      resolved!,
      "get_analysis_status",
      "error",
      "timeout",
    );

    expect(messages).toEqual([
      {
        id: messageId,
        role: "assistant",
        content: "Tool get_analysis_status failed: timeout",
        timestamp: 1,
        isStreaming: false,
        toolName: "get_analysis_status",
        toolStatus: "error",
      },
    ]);
    expect(pendingToolMsgIds.size).toBe(0);
  });

  it("does not import renderer-local context optimization or system prompt building", () => {
    const source = readFileSync(aiChatHandlersPath, "utf8");

    // The renderer should not build system prompts or trim history locally.
    // These responsibilities moved to the server-owned chat service in Phase 6.
    expect(source).not.toContain("trimChatHistory");
    expect(source).not.toContain("buildChatSystemPrompt");
    expect(source).not.toContain("buildEntityGraphContext");
    expect(source).not.toContain("BLANK_CANVAS_CHAT_SYSTEM_PROMPT");
  });
});
