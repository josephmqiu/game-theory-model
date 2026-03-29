import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import { useAIStore } from "@/stores/ai-store";
import { useThreadStore } from "@/stores/thread-store";
import { CHAT_STREAM_THINKING_CONFIG } from "@/services/ai/ai-runtime-config";
import type { AIProviderType } from "@/types/agent-settings";
import type { WorkspaceRuntimeEventByTopic } from "../../../shared/types/workspace-runtime";
import { workspaceRuntimeClient } from "@/services/ai/workspace-runtime-client";

// ---------------------------------------------------------------------------
// Normalized internal chunk for workspace runtime chat events before the
// handler processes them.
// ---------------------------------------------------------------------------

type NormalizedChunk =
  | { kind: "text"; content: string }
  | { kind: "thinking"; content: string }
  | { kind: "tool_start"; toolName: string }
  | { kind: "tool_result"; toolName: string; output: unknown }
  | { kind: "tool_error"; toolName: string; error: string }
  | { kind: "complete"; messageId?: string; correlationId: string }
  | { kind: "error"; content: string };

/**
 * Normalizes a workspace runtime chat event into a NormalizedChunk.
 * Unknown shapes are silently skipped (returns null).
 */
function normalizeChunk(
  raw: WorkspaceRuntimeEventByTopic["chat"],
): NormalizedChunk | null {
  const t = raw.kind;

  if (t === "chat.message.delta") {
    return {
      kind: raw.contentKind === "reasoning" ? "thinking" : "text",
      content: raw.content,
    };
  }
  if (t === "chat.message.complete") {
    return {
      kind: "complete",
      messageId: raw.messageId,
      correlationId: raw.correlationId,
    };
  }
  if (t === "chat.message.error") {
    return { kind: "error", content: raw.error.message };
  }
  if (t === "chat.tool.start") {
    return { kind: "tool_start", toolName: raw.toolName };
  }
  if (t === "chat.tool.result") {
    return { kind: "tool_result", toolName: raw.toolName, output: raw.output };
  }
  if (t === "chat.tool.error") {
    return { kind: "tool_error", toolName: raw.toolName, error: raw.error };
  }

  return null;
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

      const correlationId = `chat-${nanoid()}`;
      const userMsgId = nanoid();
      const assistantMsgId = nanoid();

      threadState.startPendingTurn(
        correlationId,
        { id: userMsgId, content: messageText, timestamp: Date.now() },
        {
          id: assistantMsgId,
          content: "",
          timestamp: Date.now(),
          isStreaming: true,
        },
      );
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
      const pendingToolQueues = new Map<string, string[]>();

      try {
        let chatThinking = "";

        for await (const rawChunk of workspaceRuntimeClient.streamChatTurn(
          {
            workspaceId: threadState.workspaceId ?? "workspace-local-default",
            threadId: threadState.activeThreadId,
            correlationId,
            message: {
              content: messageText,
            },
            provider: currentProvider === "codex" ? "codex" : "claude",
            model,
            thinkingMode: CHAT_STREAM_THINKING_CONFIG.thinkingMode,
            effort: CHAT_STREAM_THINKING_CONFIG.effort,
          },
          {
            signal: abortController.signal,
            onResolvedThread: (identity) => {
              useThreadStore.getState().setActiveThreadIdentity(identity);
            },
          },
        )) {
          const chunk = normalizeChunk(rawChunk);
          if (!chunk) continue;

          // Guard: if the pending turn was cleared (e.g. thread switch), stop updating.
          const currentTurn = useThreadStore.getState().pendingTurn;
          if (!currentTurn || currentTurn.correlationId !== correlationId) {
            break;
          }

          switch (chunk.kind) {
            case "thinking": {
              chatThinking += chunk.content;
              const thinkingStep = `<step title="Thinking">${chatThinking}</step>`;
              useThreadStore
                .getState()
                .updatePendingTurnAssistant(
                  thinkingStep + (accumulated ? `\n${accumulated}` : ""),
                );
              break;
            }
            case "text": {
              accumulated += chunk.content;
              const thinkingPrefix = chatThinking
                ? `<step title="Thinking">${chatThinking}</step>\n`
                : "";
              useThreadStore
                .getState()
                .updatePendingTurnAssistant(thinkingPrefix + accumulated);
              break;
            }
            case "tool_start": {
              const toolMsgId = `tool-${chunk.toolName}-${nanoid(6)}`;
              const queue = pendingToolQueues.get(chunk.toolName) ?? [];
              queue.push(toolMsgId);
              pendingToolQueues.set(chunk.toolName, queue);
              useThreadStore.getState().addPendingToolCall({
                id: toolMsgId,
                toolName: chunk.toolName,
                status: "running",
                content: `Using ${chunk.toolName}`,
              });
              break;
            }
            case "tool_result": {
              const queue = pendingToolQueues.get(chunk.toolName);
              const msgId = queue?.shift();
              if (queue?.length === 0) pendingToolQueues.delete(chunk.toolName);
              if (msgId) {
                useThreadStore.getState().updatePendingToolCall(msgId, {
                  status: "done",
                  content: `Used ${chunk.toolName}`,
                });
              }
              break;
            }
            case "tool_error": {
              const queue = pendingToolQueues.get(chunk.toolName);
              const msgId = queue?.shift();
              if (queue?.length === 0) pendingToolQueues.delete(chunk.toolName);
              if (msgId) {
                useThreadStore.getState().updatePendingToolCall(msgId, {
                  status: "error",
                  content: `Tool ${chunk.toolName} failed: ${chunk.error}`,
                });
              }
              break;
            }
            case "error": {
              terminalErrorMessage = chunk.content;
              break;
            }
            case "complete": {
              useThreadStore.getState().completePendingTurn(chunk.messageId);
              break;
            }
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errMsg =
            error instanceof Error ? error.message : "Unknown error";
          console.error("[chat] stream-error:", errMsg);
          accumulated = `**Error:** ${errMsg}`;
          terminalErrorMessage = errMsg;
          useThreadStore.getState().updatePendingTurnAssistant(accumulated);
        }
      } finally {
        useAIStore.getState().setAbortController(null);
        setStreaming(false);

        // Mark any tool calls still running as terminal so stale
        // spinners never survive a completed or aborted turn.
        for (const msgIds of pendingToolQueues.values()) {
          for (const msgId of msgIds) {
            useThreadStore.getState().updatePendingToolCall(msgId, {
              status: "done",
            });
          }
        }
      }

      if (terminalErrorMessage && !abortController.signal.aborted) {
        useThreadStore
          .getState()
          .updatePendingTurnAssistant(`**Error:** ${terminalErrorMessage}`);
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
