import { useState, useEffect, useCallback, useRef } from "react";
import { HelpCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserInputQuestion } from "../../../shared/types/user-input";

interface QuestionCardProps {
  question: UserInputQuestion;
  questionIndex: number;
  totalQuestions: number;
  isPending: boolean;
  resolvedAnswer?: string;
  onResolve: (
    questionId: string,
    answer: { selectedOptions?: number[]; customText?: string },
  ) => void;
}

export function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  isPending,
  resolvedAnswer,
  onResolve,
}: QuestionCardProps) {
  const [customText, setCustomText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleOptionClick = useCallback(
    (optionIndex: number) => {
      if (!isPending) return;
      onResolve(question.id, {
        selectedOptions: [optionIndex],
      });
    },
    [isPending, question.id, onResolve],
  );

  const handleCustomSubmit = useCallback(() => {
    if (!isPending || !customText.trim()) return;
    onResolve(question.id, { customText: customText.trim() });
    setCustomText("");
  }, [isPending, question.id, customText, onResolve]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCustomSubmit();
      }
    },
    [handleCustomSubmit],
  );

  // Keyboard shortcuts 1-9 for options (only when this card is active)
  useEffect(() => {
    if (!isPending || !question.options?.length) return;

    const handler = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLInputElement
      ) {
        return;
      }

      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= 9 && num <= (question.options?.length ?? 0)) {
        e.preventDefault();
        handleOptionClick(num - 1);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPending, question.options, handleOptionClick]);

  if (!isPending && resolvedAnswer) {
    return (
      <div className="border-l-2 border-l-zinc-600 bg-card/60 rounded-md px-3 py-2 animate-in fade-in duration-200">
        <div className="flex items-center gap-1.5 mb-1">
          <Check className="w-3 h-3 text-zinc-500" />
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {totalQuestions > 1
              ? `Question ${questionIndex + 1} of ${totalQuestions}`
              : "Question answered"}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground line-clamp-1">
          Q: {question.question}
        </p>
        <p className="text-[12px] text-foreground mt-0.5">
          A: {resolvedAnswer}
        </p>
      </div>
    );
  }

  return (
    <div className="border-l-2 border-l-blue-500 bg-card rounded-md px-3 py-3 animate-in slide-in-from-bottom-1 duration-200">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {question.header}
          {totalQuestions > 1 && ` — ${questionIndex + 1} of ${totalQuestions}`}
        </span>
      </div>

      {/* Question text */}
      <p className="text-[13px] text-foreground mb-2.5">{question.question}</p>

      {/* Option buttons */}
      {question.options && question.options.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2.5">
          {question.options.map((option, idx) => (
            <button
              key={idx}
              type="button"
              disabled={!isPending}
              onClick={() => handleOptionClick(idx)}
              className={cn(
                "flex items-start gap-2 w-full text-left px-2.5 py-1.5 rounded-md",
                "transition-colors duration-100",
                isPending
                  ? "hover:bg-secondary/50 cursor-pointer"
                  : "opacity-50 cursor-default",
              )}
            >
              <span className="text-[11px] font-mono text-blue-400 tabular-nums mt-px shrink-0">
                [{idx + 1}]
              </span>
              <div className="min-w-0">
                <span className="text-[13px] font-medium text-foreground">
                  {option.label}
                </span>
                {option.description && (
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    {option.description}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Free-text input */}
      {isPending && (
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              question.options?.length
                ? "Or type your answer..."
                : "Type your answer..."
            }
            className={cn(
              "flex-1 bg-secondary/30 text-[12px] text-foreground",
              "placeholder:text-muted-foreground/50",
              "border border-border/30 rounded px-2 py-1",
              "focus:outline-none focus:border-blue-500/50",
            )}
          />
          <button
            type="button"
            disabled={!customText.trim()}
            onClick={handleCustomSubmit}
            className={cn(
              "text-[11px] font-medium px-2 py-1 rounded",
              "transition-colors duration-100",
              customText.trim()
                ? "text-blue-400 hover:bg-blue-500/10 cursor-pointer"
                : "text-muted-foreground/30 cursor-default",
            )}
          >
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
