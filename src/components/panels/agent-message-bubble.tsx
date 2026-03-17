/**
 * AgentMessageBubble and ThinkingBlock components.
 * Extracted from ai-chat-panel.tsx to keep file size manageable.
 */

import { useState } from "react";
import { Bot, ChevronDown, ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentToolCall } from "@/components/panels/agent-tool-call";
import { AgentProposalCard } from "@/components/panels/agent-proposal-card";
import type { ProposalData } from "@/components/panels/agent-proposal-card";
import { sendAgentMessage } from "@/services/agent-chat-handler";
import type { AgentChatMessage } from "@/stores/ai-store";

interface ThinkingBlockProps {
  thinking: string;
}

function ThinkingBlock({ thinking }: ThinkingBlockProps) {
  const [open, setOpen] = useState(false);

  if (!thinking) return null;

  return (
    <div className="rounded-md border border-border bg-background/60">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-accent/50 transition-colors rounded-md"
        aria-expanded={open}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="font-medium text-muted-foreground">Thinking</span>
      </button>
      {open && (
        <div className="border-t border-border px-2.5 pb-2.5 pt-2">
          <p className="whitespace-pre-wrap text-xs text-muted-foreground">
            {thinking}
          </p>
        </div>
      )}
    </div>
  );
}

export function AgentMessageBubble({ message }: { message: AgentChatMessage }) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-row-reverse gap-2">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <User className="h-3.5 w-3.5" />
        </div>
        <div className="max-w-[80%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasThinking = message.thinking.length > 0;
  const hasToolCalls = message.toolCalls.length > 0;
  const hasContent = message.content.length > 0;

  return (
    <div className="flex flex-row gap-2">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Bot className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        {hasThinking && <ThinkingBlock thinking={message.thinking} />}

        {hasToolCalls && (
          <div className="space-y-1">
            {message.toolCalls.map((tc) =>
              tc.name === "propose_revision" ? (
                <AgentProposalCard
                  key={tc.id}
                  toolCall={tc}
                  onAccept={(_proposal: ProposalData) => {
                    // Acceptance is handled inside the card (command dispatch).
                    // Nothing extra needed here.
                  }}
                  onReject={(proposalData: ProposalData, reason: string) => {
                    const text = reason
                      ? `Proposal ${proposalData.proposal_id} rejected: ${reason}`
                      : `Proposal ${proposalData.proposal_id} rejected.`;
                    void sendAgentMessage(text);
                  }}
                />
              ) : (
                <AgentToolCall key={tc.id} toolCall={tc} />
              ),
            )}
          </div>
        )}

        {(hasContent || message.isStreaming) && (
          <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
            <p
              className={cn(
                "whitespace-pre-wrap break-words",
                message.isStreaming &&
                  "after:animate-pulse after:content-['▌']",
              )}
            >
              {message.content}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
