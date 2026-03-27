import { describe, expect, it } from "vitest";
import {
  buildTokenBudgetedChatHistory,
  estimateTokenCount,
} from "../chat-history-budget";

describe("chat-history-budget", () => {
  it("prefers recent messages and only includes the earliest user message if it still fits", () => {
    const messages = [
      {
        role: "user",
        content: "A".repeat(40_000),
      },
      {
        role: "assistant",
        content: "B".repeat(70_000),
      },
      {
        role: "user",
        content: "recent question",
      },
      {
        role: "assistant",
        content: "recent answer",
      },
    ];

    const selected = buildTokenBudgetedChatHistory({
      messages,
      provider: "codex",
      model: "tiny-context-model",
      systemPrompt: "short system prompt",
      nextUserMessage: "next question",
    });

    expect(selected).toEqual(
      expect.arrayContaining([
        {
          role: "user",
          content: "recent question",
        },
        {
          role: "assistant",
          content: "recent answer",
        },
      ]),
    );
    expect(selected).not.toContainEqual({
      role: "user",
      content: "A".repeat(40_000),
    });
  });

  it("uses a deterministic fallback token estimator", () => {
    expect(estimateTokenCount("")).toBe(0);
    expect(estimateTokenCount("hello world")).toBe(4);
    expect(estimateTokenCount("hello world")).toBe(estimateTokenCount("hello world"));
  });
});
