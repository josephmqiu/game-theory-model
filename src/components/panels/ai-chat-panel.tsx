/**
 * AI chat panel.
 * Message list with user/AI bubbles, input box, send/stop button.
 * Reads from ai-store agentMessages, sends messages via sendAgentMessage.
 */

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  Bot,
  ChevronUp,
  MessageSquare,
  Minus,
  Send,
  Square,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendAgentMessage } from "@/services/agent-chat-handler";
import { aiStore, useAiStore } from "@/stores/ai-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import { AgentMessageBubble } from "@/components/panels/agent-message-bubble";
import type { AIProviderType } from "@/types/agent-settings";

// Kept for pipeline conversation rendering (different store).
import type { ConversationMessage } from "shared/game-theory/types/conversation";

export function MessageBubble({ message }: { message: ConversationMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
      >
        {isUser ? (
          <User className="h-3.5 w-3.5" />
        ) : (
          <Bot className="h-3.5 w-3.5" />
        )}
      </div>

      <div
        className={cn(
          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.phase != null && (
          <span className="mt-1 block text-[10px] opacity-70">
            Phase {message.phase}
          </span>
        )}
      </div>
    </div>
  );
}

const PROVIDER_LABELS = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  opencode: "OpenCode",
  copilot: "Copilot",
} as const;

interface AiChatPanelProps {
  onClose?: () => void;
  onMinimize?: () => void;
}

interface AiChatMinimizedBarProps {
  onExpand: () => void;
  onClose: () => void;
}

export function AiChatMinimizedBar({
  onExpand,
  onClose,
}: AiChatMinimizedBarProps) {
  const provider = useAiStore((s) => s.provider);

  return (
    <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-lg">
      <button
        type="button"
        onClick={onExpand}
        className="flex items-center gap-2 rounded-full text-sm text-foreground transition-colors hover:text-primary"
      >
        <MessageSquare className="h-4 w-4 text-primary" />
        <span>AI Panel</span>
        <span className="text-xs text-muted-foreground">
          {PROVIDER_LABELS[provider.provider]} / {provider.modelId}
        </span>
        <ChevronUp className="h-4 w-4 text-muted-foreground" />
      </button>
      <button
        type="button"
        onClick={onClose}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Close AI panel"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function AiChatPanel({ onClose, onMinimize }: AiChatPanelProps) {
  const agentMessages = useAiStore((s) => s.agentMessages);
  const isStreaming = useAiStore((s) => s.isStreaming);
  const provider = useAiStore((s) => s.provider);
  const lastError = useAiStore((s) => s.lastError);
  const settingsHydrated = useAgentSettingsStore((s) => s.hydrated);
  const connectedProviders = useAgentSettingsStore((s) => s.providers);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (!el || typeof el.scrollTo !== "function") return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const lastMessageContentLength =
    agentMessages.length > 0
      ? agentMessages[agentMessages.length - 1].content.length
      : 0;

  useEffect(() => {
    scrollToBottom();
  }, [
    agentMessages.length,
    isStreaming,
    lastMessageContentLength,
    scrollToBottom,
  ]);

  const connectedModels = useMemo(
    () =>
      (Object.keys(connectedProviders) as AIProviderType[]).flatMap(
        (providerType) =>
          connectedProviders[providerType].models.map((model) => ({
            ...model,
            providerLabel: connectedProviders[providerType].displayName,
          })),
      ),
    [connectedProviders],
  );

  const selectedProviderState = connectedProviders[provider.provider];
  const currentProviderReady =
    selectedProviderState.isConnected &&
    selectedProviderState.validated &&
    selectedProviderState.models.some(
      (model) => model.value === provider.modelId,
    );

  useEffect(() => {
    if (!settingsHydrated || connectedModels.length === 0) return;
    const currentModel = connectedModels.find(
      (model) =>
        model.value === provider.modelId &&
        model.provider === provider.provider,
    );
    if (!currentModel) {
      const firstModel = connectedModels[0];
      if (!firstModel) return;
      if (
        firstModel.provider !== provider.provider ||
        firstModel.value !== provider.modelId
      ) {
        aiStore.getState().setProvider({
          provider: firstModel.provider,
          modelId: firstModel.value,
        });
      }
    }
  }, [connectedModels, provider.modelId, provider.provider, settingsHydrated]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || aiStore.getState().isStreaming || !currentProviderReady)
      return;

    setInput("");
    scrollToBottom();

    await sendAgentMessage(trimmed);
    scrollToBottom();
  }, [input, currentProviderReady, scrollToBottom]);

  const handleStop = useCallback(() => {
    aiStore.getState().stopStreaming();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              AI Analysis Copilot
            </p>
            {connectedModels.length > 0 ? (
              <label className="block">
                <span className="sr-only">AI model</span>
                <select
                  value={`${provider.provider}:${provider.modelId}`}
                  onChange={(e) => {
                    const [nextProvider, ...rest] = e.target.value.split(":");
                    const nextModelId = rest.join(":"); // handle model IDs that contain ':'
                    aiStore.getState().setProvider({
                      provider: nextProvider as AIProviderType,
                      modelId: nextModelId,
                    });
                  }}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {connectedModels.map((model) => (
                    <option
                      key={`${model.provider}:${model.value}`}
                      value={`${model.provider}:${model.value}`}
                    >
                      {PROVIDER_LABELS[model.provider]} / {model.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {PROVIDER_LABELS[provider.provider]} / {provider.modelId}
              </p>
            )}
          </div>
        </div>

        {onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Minimize AI panel"
          >
            <Minus className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label="Close AI panel"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label="Chat messages"
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {agentMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Bot className="h-8 w-8 opacity-50" />
            <p className="px-8 text-center text-xs">
              Ask the model to explore the analysis, challenge assumptions, or
              suggest the next phase.
            </p>
          </div>
        ) : (
          agentMessages.map((msg) => (
            <AgentMessageBubble key={msg.id} message={msg} />
          ))
        )}
      </div>

      <div className="border-t border-border p-3">
        {lastError && (
          <div className="mb-2 flex items-center gap-2">
            <p className="flex-1 text-xs text-red-500">{lastError}</p>
            <button
              type="button"
              onClick={() => {
                aiStore.getState().setError(null);
                const messages = aiStore.getState().agentMessages;
                const lastUserMsg = [...messages]
                  .reverse()
                  .find((m) => m.role === "user");
                if (!lastUserMsg) return;

                // Remove the failed (empty) assistant message if present
                const lastMsg = messages[messages.length - 1];
                if (
                  lastMsg?.role === "assistant" &&
                  !lastMsg.isStreaming &&
                  lastMsg.content.trim() === ""
                ) {
                  aiStore.getState().removeLastAgentMessage();
                }

                // Remove the original user message — sendAgentMessage will re-append it
                const currentMessages = aiStore.getState().agentMessages;
                const lastCurrent = currentMessages[currentMessages.length - 1];
                if (
                  lastCurrent?.role === "user" &&
                  lastCurrent.id === lastUserMsg.id
                ) {
                  aiStore.getState().removeLastAgentMessage();
                }

                void sendAgentMessage(lastUserMsg.content);
              }}
              className="shrink-0 rounded px-2 py-1 text-xs text-primary hover:bg-primary/10"
            >
              Try again
            </button>
          </div>
        )}
        {!currentProviderReady && settingsHydrated && (
          <p className="mb-2 text-xs text-muted-foreground">
            Connect and validate a provider in Settings before sending chat.
          </p>
        )}
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Chat message input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the analysis..."
            disabled={isStreaming || !currentProviderReady}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-md border border-border bg-background px-3 py-2",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          {isStreaming ? (
            <button
              type="button"
              onClick={handleStop}
              aria-label="Stop streaming"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                "bg-primary text-primary-foreground",
                "transition-opacity hover:opacity-90",
              )}
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!input.trim() || !currentProviderReady}
              aria-label="Send message"
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                "bg-primary text-primary-foreground",
                "transition-opacity hover:opacity-90",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
