import type { MethodologyPhase } from "../../shared/types/methodology";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";

export interface EvalFixture {
  name: string;
  topic: string;
  complexityTier: "trivial" | "standard" | "complex";
  phases: Partial<Record<MethodologyPhase, PhaseExpectations>>;
}

export interface PhaseExpectations {
  entityCountRange: [min: number, max: number];
  forbiddenPatterns?: string[];
  requiredPatterns?: string[];
  rubrics?: string[];
}

export interface GraderResult {
  grader: string;
  passed: boolean;
  score: number;
  message: string;
}

export interface TrialResult {
  fixture: string;
  phase: MethodologyPhase;
  effort: AnalysisEffortLevel;
  trial: number;
  success: boolean;
  entityCount: number;
  entityTypes: Record<string, number>;
  graderResults: GraderResult[];
  latencyMs: number;
  error?: string;
}

export interface PhaseEvalReport {
  fixture: string;
  phase: MethodologyPhase;
  effort: AnalysisEffortLevel;
  trials: TrialResult[];
  passRate: number; // fraction of trials where all graders passed
  allPass: boolean; // true only if every trial passed all graders
}

export const ALLOWED_ENTITY_TYPES: Record<string, string[]> = {
  "situational-grounding": ["fact"],
  "player-identification": ["player", "objective"],
  "baseline-model": ["game", "strategy"],
  "historical-game": [
    "interaction-history",
    "repeated-game-pattern",
    "trust-assessment",
    "dynamic-inconsistency",
    "signaling-effect",
  ],
  "formal-modeling": [
    "payoff-matrix",
    "game-tree",
    "equilibrium-result",
    "cross-game-constraint-table",
    "cross-game-effect",
    "signal-classification",
    "bargaining-dynamics",
    "option-value-assessment",
    "behavioral-overlay",
  ],
  assumptions: ["assumption"],
  elimination: ["eliminated-outcome"],
  scenarios: ["scenario", "central-thesis"],
  "meta-check": ["meta-check"],
};
