/**
 * Phase mapping constants and buildPhaseProgress function.
 * Extracted from analysis-tools.ts so this can be imported in browser
 * contexts without pulling in Node.js dependencies (fs, import.meta.url).
 *
 * No Node.js imports. Pure logic only.
 */

import type { PhaseProgress } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";

export const PHASE_NAMES: Record<number, string> = {
  1: "Situational Grounding",
  2: "Player Identification",
  3: "Baseline Game Modelling",
  4: "Historical Game & Repeated Interaction",
  5: "Revalidation Loop",
  6: "Formal Representation",
  7: "Assumption & Sensitivity Extraction",
  8: "Outcome Elimination",
  9: "Scenario Generation",
  10: "Meta-Check",
};

export type PhaseEntityMap = Record<number, Array<keyof CanonicalStore>>;

export const PHASE_ENTITY_MAP: PhaseEntityMap = {
  1: ["sources", "observations", "claims", "inferences"],
  2: ["players"],
  3: ["games", "formalizations"],
  4: [
    "trust_assessments",
    "repeated_game_patterns",
    "dynamic_inconsistency_risks",
  ],
  5: ["revalidation_events"],
  6: ["formalizations", "signal_classifications"],
  7: ["assumptions", "contradictions", "latent_factors"],
  8: ["eliminated_outcomes"],
  9: ["scenarios", "tail_risks", "central_theses"],
  10: [],
};

/**
 * Derives a PhaseProgress object for a single phase from the canonical store.
 * Accepts a loosely typed canonical so it can be called from contexts where
 * the full CanonicalStore type is not available (e.g. browser hooks).
 */
export function buildPhaseProgress(
  phase: number,
  canonical: Record<string, Record<string, unknown>>,
): PhaseProgress {
  const entityKeys = PHASE_ENTITY_MAP[phase] ?? [];
  const entity_counts: Record<string, number> = {};

  for (const key of entityKeys) {
    const collection = canonical[key] ?? {};
    entity_counts[key] = Object.keys(collection).length;
  }

  const has_entities =
    entityKeys.length === 0
      ? false
      : Object.values(entity_counts).some((count) => count > 0);

  const coverage_warnings: string[] = [];

  if (phase === 2) {
    const playerCount = Object.keys(canonical["players"] ?? {}).length;
    const sourceCount = Object.keys(canonical["sources"] ?? {}).length;

    if (playerCount > 0 && sourceCount === 0) {
      coverage_warnings.push(
        "Players exist but no evidence has been gathered. The methodology says facts first.",
      );
    }

    if (playerCount === 1) {
      coverage_warnings.push(
        "Only 1 player identified. Most strategic situations involve at least 2 players.",
      );
    }
  }

  if (phase === 3) {
    const gameCount = Object.keys(canonical["games"] ?? {}).length;
    const formalizationCount = Object.keys(
      canonical["formalizations"] ?? {},
    ).length;

    if (gameCount > 0 && formalizationCount === 0) {
      coverage_warnings.push("Games exist but none have formalizations.");
    }
  }

  return {
    phase,
    name: PHASE_NAMES[phase] ?? `Phase ${phase}`,
    has_entities,
    entity_counts,
    coverage_warnings,
  };
}

/**
 * Builds PhaseProgress for all 10 phases from the canonical store.
 *
 * Phase 10 is a meta-check — it has no dedicated entities.
 * It's considered "has_entities" when all prior phases have entities.
 */
export function buildAllPhaseProgress(
  canonical: Record<string, Record<string, unknown>>,
): PhaseProgress[] {
  const phases = Array.from({ length: 10 }, (_, i) =>
    buildPhaseProgress(i + 1, canonical),
  );

  // Apply Phase 10 heuristic: has_entities = true only when phases 1-9 all have entities
  const priorPhasesComplete = phases.slice(0, 9).every((p) => p.has_entities);
  const phase10 = phases[9];
  if (phase10) {
    phases[9] = { ...phase10, has_entities: priorPhasesComplete };
  }

  return phases;
}
