/**
 * Canonical methodology types for the game-theory analysis domain.
 *
 * These are the source-of-truth type definitions. Both apps/web and apps/server
 * re-export from here rather than maintaining independent copies.
 */

export type MethodologyPhase =
  | "situational-grounding" // Phase 1
  | "player-identification" // Phase 2
  | "baseline-model" // Phase 3
  | "historical-game" // Phase 4
  | "revalidation" // Phase 5
  | "formal-modeling" // Phase 6
  | "assumptions" // Phase 7
  | "elimination" // Phase 8
  | "scenarios" // Phase 9
  | "meta-check"; // Phase 10

export type PhaseStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "needs-revalidation";

export interface PhaseState {
  phase: MethodologyPhase;
  status: PhaseStatus;
  entityIds: string[];
  lastRun?: string | undefined; // ISO date
  error?: string | undefined;
}

export interface PhaseEntityLike {
  id: string;
  phase: MethodologyPhase;
}

/** Phases implemented in v1 */
export const V1_PHASES: MethodologyPhase[] = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
];

/** Phases implemented in v2 (adds Phase 4 + Phase 6 + Phase 7) */
export const V2_PHASES: MethodologyPhase[] = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "formal-modeling",
  "assumptions",
];

/** All runnable phases in order (excludes revalidation, which is the orthogonal loopback mechanism) */
export const V3_PHASES: MethodologyPhase[] = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "formal-modeling",
  "assumptions",
  "elimination",
  "scenarios",
  "meta-check",
];

/** All 10 methodology phases in order */
export const ALL_PHASES: MethodologyPhase[] = [
  "situational-grounding",
  "player-identification",
  "baseline-model",
  "historical-game",
  "revalidation",
  "formal-modeling",
  "assumptions",
  "elimination",
  "scenarios",
  "meta-check",
];

export const PHASE_LABELS: Record<MethodologyPhase, string> = {
  "situational-grounding": "Situational Grounding",
  "player-identification": "Player Identification",
  "baseline-model": "Baseline Model",
  "historical-game": "Historical Game",
  revalidation: "Revalidation",
  "formal-modeling": "Formal Modeling",
  assumptions: "Assumptions",
  elimination: "Elimination",
  scenarios: "Scenarios",
  "meta-check": "Meta-Check",
};

export const PHASE_NUMBERS: Record<MethodologyPhase, number> = {
  "situational-grounding": 1,
  "player-identification": 2,
  "baseline-model": 3,
  "historical-game": 4,
  revalidation: 5,
  "formal-modeling": 6,
  assumptions: 7,
  elimination: 8,
  scenarios: 9,
  "meta-check": 10,
};

const RUNNABLE_PHASE_SET = new Set<MethodologyPhase>(V3_PHASES);

export function isRunnablePhase(phase: string): phase is MethodologyPhase {
  return RUNNABLE_PHASE_SET.has(phase as MethodologyPhase);
}

export function getRunnablePhaseNumber(phase: MethodologyPhase): number | null {
  const index = V3_PHASES.indexOf(phase);
  return index === -1 ? null : index + 1;
}

export function normalizePhaseStates<T extends PhaseEntityLike>(
  phases: readonly PhaseState[] | undefined,
  entities: readonly T[],
): PhaseState[] {
  const existingStates = new Map<MethodologyPhase, PhaseState>();
  for (const phaseState of phases ?? []) {
    if (!isRunnablePhase(phaseState.phase)) {
      continue;
    }
    existingStates.set(phaseState.phase, phaseState);
  }

  const entityIdsByPhase = new Map<MethodologyPhase, string[]>();
  for (const phase of V3_PHASES) {
    entityIdsByPhase.set(phase, []);
  }

  for (const entity of entities) {
    if (!isRunnablePhase(entity.phase)) {
      continue;
    }
    entityIdsByPhase.get(entity.phase)?.push(entity.id);
  }

  return V3_PHASES.map((phase) => {
    const existing = existingStates.get(phase);
    const entityIds = entityIdsByPhase.get(phase) ?? [];

    return {
      phase,
      status:
        existing?.status ?? (entityIds.length > 0 ? "complete" : "pending"),
      entityIds,
      ...(existing?.lastRun ? { lastRun: existing.lastRun } : {}),
      ...(existing?.error ? { error: existing.error } : {}),
    };
  });
}

export function upsertPhaseStatus<T extends PhaseEntityLike>(
  phases: readonly PhaseState[] | undefined,
  entities: readonly T[],
  phase: MethodologyPhase,
  status: PhaseStatus,
): PhaseState[] {
  const normalized = normalizePhaseStates(phases, entities);
  if (!isRunnablePhase(phase)) {
    return normalized;
  }

  return normalized.map((phaseState) =>
    phaseState.phase === phase ? { ...phaseState, status } : phaseState,
  );
}

export function countCompletedRunnablePhases(
  phases: readonly PhaseState[] | undefined,
): number {
  return (phases ?? []).filter(
    (phaseState) =>
      isRunnablePhase(phaseState.phase) && phaseState.status === "complete",
  ).length;
}
