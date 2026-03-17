/**
 * AI chat panel.
 * Message list with user/AI bubbles, input box, and send button.
 * Reads from conversation store, sends messages via /api/ai/chat.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronUp,
  MessageSquare,
  Minus,
  Send,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { sendChatCommand } from "@/services/app-command-runner";
import { useConversationStore } from "@/stores/conversation-store";
import { conversationStore } from "@/stores/conversation-store";
import { aiStore, useAiStore } from "@/stores/ai-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import type { ConversationMessage } from "shared/game-theory/types/conversation";
import type { AIProviderType } from "@/types/agent-settings";

function MessageBubble({ message }: { message: ConversationMessage }) {
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
  const messages = useConversationStore((s) => s.messages);
  const provider = useAiStore((s) => s.provider);
  const lastError = useAiStore((s) => s.lastError);
  const settingsHydrated = useAgentSettingsStore((s) => s.hydrated);
  const connectedProviders = useAgentSettingsStore((s) => s.providers);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamedAssistant, setStreamedAssistant] = useState("");
  const [thinkingMessages, setThinkingMessages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, sending, streamedAssistant, thinkingMessages.length, scrollToBottom]);

  const connectedModels = useMemo(
    () =>
      (Object.keys(connectedProviders) as AIProviderType[]).flatMap((providerType) =>
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
    selectedProviderState.models.some((model) => model.value === provider.modelId);

  useEffect(() => {
    if (!settingsHydrated || connectedModels.length === 0) return;
    const currentModel = connectedModels.find(
      (model) =>
        model.value === provider.modelId && model.provider === provider.provider,
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
    if (!trimmed || sending || !currentProviderReady) return;

    conversationStore.getState().appendMessage({
      role: "user",
      content: trimmed,
    });

    setInput("");
    setSending(true);
    setStreamedAssistant("");
    setThinkingMessages([]);
    aiStore.getState().setStreaming(true);
    aiStore.getState().setError(null);
    scrollToBottom();

    try {
      const priorMessages = conversationStore
        .getState()
        .messages.filter((m) => m.role === "user" || m.role === "ai")
        .map((m) => ({
          role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));

      await sendChatCommand(
        {
          system: "You are a game theory analysis assistant.",
          messages: priorMessages,
          provider: provider.provider,
          model: provider.modelId,
        },
        {
          onChunk(parsed, snapshot) {
            if (parsed.type === "text") {
              setStreamedAssistant(snapshot.content);
            } else if (parsed.type === "thinking") {
              setThinkingMessages(snapshot.thinking);
            }
            if (parsed.type !== "ping") {
              scrollToBottom();
            }
          },
        },
      );
    } catch (error) {
      aiStore.getState().setError(
        error instanceof Error ? error.message : "An unexpected error occurred",
      );
      conversationStore.getState().appendMessage({
        role: "ai",
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "An unexpected error occurred",
      });
    } finally {
      setSending(false);
      setStreamedAssistant("");
      setThinkingMessages([]);
      aiStore.getState().setStreaming(false);
      scrollToBottom();
    }
  }, [
    currentProviderReady,
    input,
    provider.modelId,
    provider.provider,
    sending,
    scrollToBottom,
  ]);

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
                  value={provider.modelId}
                  onChange={(event) => {
                    const next = connectedModels.find(
                      (model) => model.value === event.target.value,
                    );
                    if (!next) return;
                    aiStore.getState().setProvider({
                      provider: next.provider,
                      modelId: next.value,
                    });
                  }}
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
                >
                  {connectedModels.map((model) => (
                    <option key={model.value} value={model.value}>
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
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
            <Bot className="h-8 w-8 opacity-50" />
            <p className="px-8 text-center text-xs">
              Ask the model to explore the analysis, challenge assumptions, or
              suggest the next phase.
            </p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {sending && thinkingMessages.length > 0 && (
          <div className="rounded-lg border border-border bg-background/70 px-3 py-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bot className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Thinking
              </span>
            </div>
            <div className="mt-2 space-y-1">
              {thinkingMessages.map((message, index) => (
                <p key={`${message}-${index}`} className="text-xs text-muted-foreground">
                  {message}
                </p>
              ))}
            </div>
          </div>
        )}
        {sending && streamedAssistant && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Bot className="h-3.5 w-3.5" />
            </div>
            <div className="max-w-[80%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              <p className="whitespace-pre-wrap break-words">{streamedAssistant}</p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        {lastError && (
          <p className="mb-2 text-xs text-red-500">
            {lastError}
          </p>
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
            disabled={sending || !currentProviderReady}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-md border border-border bg-background px-3 py-2",
              "text-sm text-foreground placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-1 focus:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending || !currentProviderReady}
            aria-label={sending ? "Sending message" : "Send message"}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              "bg-primary text-primary-foreground",
              "transition-opacity hover:opacity-90",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
