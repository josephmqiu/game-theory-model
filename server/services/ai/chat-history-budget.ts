import type { RuntimeProvider } from "./adapter-contract";

export interface ChatHistoryMessage {
  role: string;
  content: string;
}

interface HistoryBudgetProfile {
  contextWindowTokens: number;
  responseHeadroomTokens: number;
  systemPromptReserveTokens: number;
}

const DEFAULT_PROFILE: HistoryBudgetProfile = {
  contextWindowTokens: 32_000,
  responseHeadroomTokens: 4_000,
  systemPromptReserveTokens: 2_000,
};

function resolveBudgetProfile(
  provider: RuntimeProvider,
  model: string,
): HistoryBudgetProfile {
  const normalizedModel = model.toLowerCase();

  if (provider === "claude") {
    return {
      contextWindowTokens:
        normalizedModel.includes("haiku") ? 64_000 : 200_000,
      responseHeadroomTokens: 8_000,
      systemPromptReserveTokens: 3_000,
    };
  }

  if (
    normalizedModel.includes("gpt-5") ||
    normalizedModel.includes("gpt-4.1") ||
    normalizedModel.includes("gpt-4o")
  ) {
    return {
      contextWindowTokens: 128_000,
      responseHeadroomTokens: 8_000,
      systemPromptReserveTokens: 3_000,
    };
  }

  return DEFAULT_PROFILE;
}

export function estimateTokenCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  // Conservative approximation that stays deterministic without a provider-
  // specific tokenizer. This intentionally overestimates slightly so the
  // server leaves response headroom instead of packing the full context.
  return Math.ceil(trimmed.length / 4) + Math.ceil(trimmed.split(/\s+/).length / 12);
}

function estimateMessageTokens(message: ChatHistoryMessage): number {
  return estimateTokenCount(message.content) + 8;
}

export function buildTokenBudgetedChatHistory(input: {
  messages: ChatHistoryMessage[];
  provider: RuntimeProvider;
  model: string;
  systemPrompt: string;
  nextUserMessage: string;
}): ChatHistoryMessage[] {
  if (input.messages.length === 0) {
    return [];
  }

  const profile = resolveBudgetProfile(input.provider, input.model);
  const reservedTokens =
    Math.max(
      estimateTokenCount(input.systemPrompt),
      profile.systemPromptReserveTokens,
    ) +
    estimateTokenCount(input.nextUserMessage) +
    profile.responseHeadroomTokens;

  const availableHistoryTokens = Math.max(
    0,
    profile.contextWindowTokens - reservedTokens,
  );

  if (availableHistoryTokens === 0) {
    return [];
  }

  const selected: ChatHistoryMessage[] = [];
  let usedTokens = 0;

  for (const message of [...input.messages].reverse()) {
    const messageTokens = estimateMessageTokens(message);
    if (usedTokens + messageTokens > availableHistoryTokens) {
      continue;
    }

    selected.push(message);
    usedTokens += messageTokens;
  }

  const earliestUser = input.messages.find((message) => message.role === "user");
  if (
    earliestUser &&
    !selected.includes(earliestUser)
  ) {
    const earliestUserTokens = estimateMessageTokens(earliestUser);
    if (usedTokens + earliestUserTokens <= availableHistoryTokens) {
      selected.push(earliestUser);
    }
  }

  const selectedSet = new Set(selected);
  return input.messages.filter((message) => selectedSet.has(message));
}
