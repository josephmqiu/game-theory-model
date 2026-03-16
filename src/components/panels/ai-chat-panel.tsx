/**
 * AI chat panel.
 * Message list with user/AI bubbles, input box, and send button.
 * Reads from conversation store, sends messages via /api/ai/chat.
 */

import { useCallback, useRef, useState } from "react";
import { Bot, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConversationStore } from "@/stores/conversation-store";
import { conversationStore } from "@/stores/conversation-store";
import type { ConversationMessage } from "shared/game-theory/types/conversation";

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

export function AiChatPanel() {
  const messages = useConversationStore((s) => s.messages);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    conversationStore.getState().appendMessage({
      role: "user",
      content: trimmed,
    });

    setInput("");
    setSending(true);
    scrollToBottom();

    try {
      const priorMessages = conversationStore
        .getState()
        .messages.filter((m) => m.role === "user" || m.role === "ai")
        .map((m) => ({
          role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));

      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: "You are a game theory analysis assistant.",
          messages: priorMessages,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is not readable");
      }

      let accumulated = "";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          let parsed: { type: string; content: string };
          try {
            parsed = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          if (parsed.type === "text") {
            accumulated += parsed.content;
          } else if (parsed.type === "error") {
            throw new Error(parsed.content || "Stream error from server");
          } else if (parsed.type === "done") {
            break;
          }
        }
      }

      conversationStore.getState().appendMessage({
        role: "ai",
        content: accumulated || "(No response)",
      });
    } catch (error) {
      conversationStore.getState().appendMessage({
        role: "ai",
        content:
          error instanceof Error
            ? `Error: ${error.message}`
            : "An unexpected error occurred",
      });
    } finally {
      setSending(false);
      scrollToBottom();
    }
  }, [input, sending, scrollToBottom]);

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
    <div className="flex h-full flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Bot className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">AI Chat</span>
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
            <p className="text-xs">Start a conversation</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        )}
        {sending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span className="animate-pulse text-xs">Thinking...</span>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Chat message input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the analysis..."
            disabled={sending}
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
            disabled={!input.trim() || sending}
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
