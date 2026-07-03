// design-tokens.ts — THE single source of design values (decision 5.1A).
//
// Both renderers consume this module: the Skia canvas (entity colors,
// canvas background) and the DOM (CSS custom properties in styles.css are
// pinned to these hex values by the design-guard tests). DESIGN.md is
// GENERATED from this file — run `bun run gen:design` after editing.

import type { EntityType } from "@/types/entity";

export const tokens = {
  surface: {
    /** Canvas background. */
    base: "#0C0C0E",
    /** Panels and cards. */
    panel: "#18181B",
    /** Raised / hover surfaces. */
    raised: "#27272A",
  },
  border: {
    subtle: "#3F3F46",
  },
  text: {
    /** Primary content (zinc-200). */
    primary: "#E4E4E7",
    /** Secondary content (zinc-300). */
    secondary: "#D4D4D8",
    /** Labels and captions (zinc-400). */
    label: "#A1A1AA",
    /** Section headers / smallest tier (zinc-500). */
    header: "#71717A",
  },
  /** Amber-500 — the single accent. */
  accent: "#F59E0B",
  state: {
    stale: "#F59E0B",
    error: "#F87171",
    success: "#34D399",
  },
  focusRing: {
    color: "#F59E0B",
    widthPx: 2,
    offsetPx: 2,
  },
  radius: {
    cardPx: 6,
    panelPx: 8,
  },
  /** All spacing derives from this 4px base. */
  spacingBasePx: 4,
  /** Type scale in px. */
  typeScale: [11, 12, 13, 14, 16],
  fonts: {
    ui: '"Geist Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    mono: '"Geist Mono", ui-monospace, Menlo, Monaco, monospace',
  },
} as const;

/**
 * Canonical entity-type palette. The Skia map won the merge (decision 5.1A:
 * "canonical = skia ENTITY_TYPE_COLOR map") — the overlay card previously
 * carried a conflicting copy.
 */
export const ENTITY_TYPE_COLOR: Record<EntityType, string> = {
  player: "#60A5FA",
  objective: "#818CF8",
  game: "#FBBF24",
  strategy: "#F59E0B",
  fact: "#94A3B8",
  payoff: "#FCD34D",
  "institutional-rule": "#A1A1AA",
  "escalation-rung": "#4ADE80",
  "interaction-history": "#60A5FA",
  "repeated-game-pattern": "#94A3B8",
  "trust-assessment": "#34D399",
  "dynamic-inconsistency": "#F472B6",
  "signaling-effect": "#F472B6",
  "payoff-matrix": "#FCD34D",
  "game-tree": "#FBBF24",
  "equilibrium-result": "#A78BFA",
  "cross-game-constraint-table": "#A1A1AA",
  "cross-game-effect": "#A1A1AA",
  "signal-classification": "#F472B6",
  "bargaining-dynamics": "#F59E0B",
  "option-value-assessment": "#FCD34D",
  "behavioral-overlay": "#F97316",
  assumption: "#CBD5E1",
  "eliminated-outcome": "#EF4444",
  scenario: "#22D3EE",
  "central-thesis": "#A78BFA",
  "meta-check": "#F97316",
  "analysis-report": "#A1A1AA",
};

export const ENTITY_TYPE_FALLBACK_COLOR = "#A1A1AA";

export function entityTypeColor(entityType: EntityType | string): string {
  return (
    ENTITY_TYPE_COLOR[entityType as EntityType] ?? ENTITY_TYPE_FALLBACK_COLOR
  );
}
