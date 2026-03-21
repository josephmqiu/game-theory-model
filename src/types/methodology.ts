export type MethodologyPhase =
  | "situational-grounding" // Phase 1
  | "player-identification" // Phase 2
  | "baseline-model" // Phase 3
  | "historical-game" // Phase 4 (future)
  | "revalidation" // Phase 5 (future)
  | "formal-modeling" // Phase 6 (future)
  | "assumptions" // Phase 7 (future)
  | "elimination" // Phase 8 (future)
  | "scenarios" // Phase 9 (future)
  | "meta-check"; // Phase 10 (future)

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
  lastRun?: string; // ISO date
  error?: string;
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
