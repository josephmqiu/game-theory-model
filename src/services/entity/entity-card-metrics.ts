import type { EntityType } from "@/types/entity";

export interface EntityCardMetrics {
  width: number;
  height: number;
  titleMaxChars: number;
  metaMaxChars: number;
}

const LARGE_CARD: EntityCardMetrics = {
  width: 260,
  height: 100,
  titleMaxChars: 56,
  metaMaxChars: 34,
};

const MEDIUM_CARD: EntityCardMetrics = {
  width: 240,
  height: 85,
  titleMaxChars: 46,
  metaMaxChars: 28,
};

const SMALL_CARD: EntityCardMetrics = {
  width: 220,
  height: 75,
  titleMaxChars: 38,
  metaMaxChars: 24,
};

export const ENTITY_CARD_METRICS: Record<EntityType, EntityCardMetrics> = {
  player: LARGE_CARD,
  game: LARGE_CARD,
  "interaction-history": LARGE_CARD,
  "payoff-matrix": LARGE_CARD,
  "game-tree": LARGE_CARD,
  "equilibrium-result": LARGE_CARD,
  "cross-game-constraint-table": LARGE_CARD,
  scenario: LARGE_CARD,
  "central-thesis": LARGE_CARD,
  "meta-check": LARGE_CARD,
  "bargaining-dynamics": LARGE_CARD,
  fact: MEDIUM_CARD,
  "institutional-rule": MEDIUM_CARD,
  "repeated-game-pattern": MEDIUM_CARD,
  "trust-assessment": MEDIUM_CARD,
  "dynamic-inconsistency": MEDIUM_CARD,
  "cross-game-effect": MEDIUM_CARD,
  "signal-classification": MEDIUM_CARD,
  "option-value-assessment": MEDIUM_CARD,
  "behavioral-overlay": MEDIUM_CARD,
  "eliminated-outcome": MEDIUM_CARD,
  objective: SMALL_CARD,
  strategy: SMALL_CARD,
  payoff: SMALL_CARD,
  "escalation-rung": SMALL_CARD,
  "signaling-effect": SMALL_CARD,
  assumption: SMALL_CARD,
  "analysis-report": LARGE_CARD,
};

export const ENTITY_CARD_LAYOUT = {
  padLeft: 17,
  padRight: 14,
  padTop: 12,
  padBottom: 12,
  badgeHeight: 14,
  badgeGap: 2,
  titleHeight: 40,
  metaHeight: 16,
  cornerRadius: 6,
  verticalGap: 24,
} as const;

export function getEntityCardMetrics(
  entityType: EntityType,
): EntityCardMetrics {
  return ENTITY_CARD_METRICS[entityType] ?? SMALL_CARD;
}

export function truncateEntityCardText(text: string, maxChars: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;
  if (normalized.length <= maxChars) return normalized;
  if (maxChars <= 1) return "…";
  return `${normalized.slice(0, maxChars - 1).trimEnd()}…`;
}
