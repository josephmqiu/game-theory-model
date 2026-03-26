import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { useAIStore } from "@/stores/ai-store";
import { useThreadStore } from "@/stores/thread-store";
import { streamChat } from "@/services/ai/ai-service";
import type { ChatMessage as ChatMessageType } from "@/services/ai/ai-types";
import type { AIStreamChunk } from "@/services/ai/ai-types";
import { CHAT_STREAM_THINKING_CONFIG } from "@/services/ai/ai-runtime-config";
import type { AIProviderType } from "@/types/agent-settings";
import type { ChatEvent } from "@/services/ai/chat-events";

// ---------------------------------------------------------------------------
// Normalized internal chunk — both legacy AIStreamChunk and new ChatEvent
// get mapped into this before the handler processes them.
// ---------------------------------------------------------------------------

type NormalizedChunk =
  | { kind: "text"; content: string }
  | { kind: "thinking"; content: string }
  | { kind: "tool_start"; toolName: string }
  | { kind: "tool_result"; toolName: string; output: unknown }
  | { kind: "tool_error"; toolName: string; error: string }
  | { kind: "done" }
  | { kind: "error"; content: string };

export type PendingToolMsgIds = Map<string, string[]>;

/**
 * Normalizes either a legacy AIStreamChunk or a new ChatEvent into a
 * NormalizedChunk.  Unknown shapes are silently skipped (returns null).
 */
function normalizeChunk(
  raw: AIStreamChunk | ChatEvent,
): NormalizedChunk | null {
  const t = (raw as { type: string }).type;

  // --- Legacy AIStreamChunk types ---
  if (t === "text" && "content" in raw) {
    return { kind: "text", content: (raw as AIStreamChunk).content };
  }
  if (t === "thinking" && "content" in raw) {
    return { kind: "thinking", content: (raw as AIStreamChunk).content };
  }
  if (t === "done") {
    return { kind: "done" };
  }
  if (t === "ping") {
    return null; // handled by streamChat internally
  }

  // --- New ChatEvent types ---
  if (t === "text_delta" && "content" in raw) {
    return {
      kind: "text",
      content: (raw as ChatEvent & { type: "text_delta" }).content,
    };
  }
  if (t === "tool_call_start" && "toolName" in raw) {
    const ev = raw as ChatEvent & { type: "tool_call_start" };
    return { kind: "tool_start", toolName: ev.toolName };
  }
  if (t === "tool_call_result" && "toolName" in raw) {
    const ev = raw as ChatEvent & { type: "tool_call_result" };
    return { kind: "tool_result", toolName: ev.toolName, output: ev.output };
  }
  if (t === "tool_call_error" && "toolName" in raw) {
    const ev = raw as ChatEvent & { type: "tool_call_error" };
    return { kind: "tool_error", toolName: ev.toolName, error: ev.error };
  }
  if (t === "turn_complete") {
    return { kind: "done" };
  }

  // error — legacy uses `content`, ChatEvent uses `message`
  if (t === "error") {
    const content =
      "error" in raw
        ? (raw as ChatEvent & { type: "error" }).error.message
        : "content" in raw
          ? (raw as AIStreamChunk).content
          : "Unknown error";
    return { kind: "error", content };
  }

  return null;
}

export function enqueuePendingToolMessage(
  pendingToolMsgIds: PendingToolMsgIds,
  toolName: string,
  messageId: string,
): void {
  const queue = pendingToolMsgIds.get(toolName) ?? [];
  queue.push(messageId);
  pendingToolMsgIds.set(toolName, queue);
}

export function dequeuePendingToolMessage(
  pendingToolMsgIds: PendingToolMsgIds,
  toolName: string,
): string | undefined {
  const queue = pendingToolMsgIds.get(toolName);
  if (!queue || queue.length === 0) return undefined;

  const messageId = queue.shift();
  if (queue.length === 0) {
    pendingToolMsgIds.delete(toolName);
  } else {
    pendingToolMsgIds.set(toolName, queue);
  }
  return messageId;
}

export function updateToolStatusMessage(
  messages: ChatMessageType[],
  messageId: string,
  toolName: string,
  toolStatus: NonNullable<ChatMessageType["toolStatus"]>,
  error?: string,
): ChatMessageType[] {
  return messages.map((message) =>
    message.id === messageId
      ? {
          ...message,
          content:
            toolStatus === "error"
              ? `Tool ${toolName} failed: ${error ?? "Unknown error"}`
              : `Used ${toolName}`,
          isStreaming: false,
          toolName,
          toolStatus,
        }
      : message,
  );
}

export function useChatHandlers() {
  const [input, setInput] = useState("");
  const isStreaming = useAIStore((s) => s.isStreaming);
  const model = useAIStore((s) => s.model);
  const availableModels = useAIStore((s) => s.availableModels);
  const isLoadingModels = useAIStore((s) => s.isLoadingModels);
  const setStreaming = useAIStore((s) => s.setStreaming);

  const handleSend = useCallback(
    async (text?: string) => {
      const threadState = useThreadStore.getState();
      const messageText = text ?? input.trim();
      if (
        !messageText ||
        isStreaming ||
        isLoadingModels ||
        availableModels.length === 0
      ) {
        return;
      }

      setInput("");
      threadState.clearOverlayMessages();

      const userMsg: ChatMessageType = {
        id: nanoid(),
        role: "user",
        content: messageText,
        timestamp: Date.now(),
      };
      threadState.addOverlayMessage(userMsg);

      const assistantMsg: ChatMessageType = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };
      threadState.addOverlayMessage(assistantMsg);
      setStreaming(true);

      const currentProvider = useAIStore
        .getState()
        .modelGroups.find((g) => g.models.some((m) => m.value === model))
        ?.provider as AIProviderType | undefined;

      let accumulated = "";
      const abortController = new AbortController();
      useAIStore.getState().setAbortController(abortController);
      let terminalErrorMessage: string | null = null;

      // Track in-flight tool calls so repeated calls to the same tool
      // each get their own lifecycle in FIFO order.
      const pendingToolMsgIds: PendingToolMsgIds = new Map();

      try {
        let chatThinking = "";

        for await (const rawChunk of streamChat(
          "",
          [
            {
              role: "user",
              content: messageText,
            },
          ],
          model,
          CHAT_STREAM_THINKING_CONFIG,
          currentProvider,
          abortController.signal,
          undefined,
          {
            workspaceId: threadState.workspaceId,
            threadId: threadState.activeThreadId,
            useCanonicalThreadRequest: true,
            onResolvedThread: (identity) => {
              useThreadStore.getState().setActiveThreadIdentity(identity);
            },
          },
        )) {
          const chunk = normalizeChunk(rawChunk);
          if (!chunk) continue;

          switch (chunk.kind) {
            case "thinking": {
              chatThinking += chunk.content;
              const thinkingStep = `<step title="Thinking">${chatThinking}</step>`;
              useThreadStore.getState().updateLastOverlayAssistantMessage(
                thinkingStep + (accumulated ? `\n${accumulated}` : ""),
              );
              break;
            }
            case "text": {
              accumulated += chunk.content;
              const thinkingPrefix = chatThinking
                ? `<step title="Thinking">${chatThinking}</step>\n`
                : "";
              useThreadStore.getState().updateLastOverlayAssistantMessage(
                thinkingPrefix + accumulated,
              );
              break;
            }
            case "tool_start": {
              const toolMsgId = `tool-${chunk.toolName}-${nanoid(6)}`;
              enqueuePendingToolMessage(
                pendingToolMsgIds,
                chunk.toolName,
                toolMsgId,
              );
              useThreadStore.getState().addOverlayMessage({
                id: toolMsgId,
                role: "assistant",
                content: `Using ${chunk.toolName}`,
                timestamp: Date.now(),
                isStreaming: true,
                toolName: chunk.toolName,
                toolStatus: "running",
              });
              break;
            }
            case "tool_result": {
              const msgId = dequeuePendingToolMessage(
                pendingToolMsgIds,
                chunk.toolName,
              );
              if (msgId) {
                const store = useThreadStore.getState();
                store.replaceOverlayMessages(
                  updateToolStatusMessage(
                    store.overlayMessages,
                    msgId,
                    chunk.toolName,
                    "done",
                  ),
                );
              }
              break;
            }
            case "tool_error": {
              const msgId = dequeuePendingToolMessage(
                pendingToolMsgIds,
                chunk.toolName,
              );
              if (msgId) {
                const store = useThreadStore.getState();
                store.replaceOverlayMessages(
                  updateToolStatusMessage(
                    store.overlayMessages,
                    msgId,
                    chunk.toolName,
                    "error",
                    chunk.error,
                  ),
                );
              }
              break;
            }
            case "error": {
              accumulated += `\n\n**Error:** ${chunk.content}`;
              terminalErrorMessage = chunk.content;
              useThreadStore.getState().updateLastOverlayAssistantMessage(
                accumulated,
              );
              break;
            }
            case "done":
              // Stream finished — nothing to do here, cleanup is in finally.
              break;
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errMsg =
            error instanceof Error ? error.message : "Unknown error";
          console.error("[chat] stream-error:", errMsg);
          accumulated = `**Error:** ${errMsg}`;
          terminalErrorMessage = errMsg;
          useThreadStore.getState().updateLastOverlayAssistantMessage(
            accumulated,
          );
        }
      } finally {
        useAIStore.getState().setAbortController(null);
        setStreaming(false);

        // Mark any tool messages still pending as terminal so stale
        // spinners never survive a completed or aborted turn.
        for (const msgIds of pendingToolMsgIds.values()) {
          for (const msgId of msgIds) {
            const store = useThreadStore.getState();
            store.replaceOverlayMessages(
              store.overlayMessages.map((message) =>
                message.id === msgId
                  ? {
                      ...message,
                      content: message.toolName
                        ? `Used ${message.toolName}`
                        : message.content,
                      isStreaming: false,
                      toolStatus:
                        message.toolStatus === "running"
                          ? "done"
                          : message.toolStatus,
                    }
                  : message,
              ),
            );
          }
        }

        try {
          await useThreadStore.getState().refreshThreads();
          await useThreadStore.getState().refreshActiveThreadDetail();
        } catch (error) {
          terminalErrorMessage =
            error instanceof Error ? error.message : "Failed to refresh thread.";
        }
      }

      useThreadStore.getState().clearOverlayMessages();
      if (terminalErrorMessage && !abortController.signal.aborted) {
        useThreadStore.getState().addOverlayMessage({
          id: `overlay-error-${nanoid(6)}`,
          role: "assistant",
          content: `**Error:** ${terminalErrorMessage}`,
          timestamp: Date.now(),
        });
      }
    },
    [
      availableModels.length,
      input,
      isLoadingModels,
      isStreaming,
      model,
      setStreaming,
    ],
  );

  return { input, setInput, handleSend, isStreaming };
}
