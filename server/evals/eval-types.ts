import type { MethodologyPhase } from "../../shared/types/methodology";
import type { AnalysisEffortLevel } from "../../shared/types/analysis-runtime";
import type { FactCategory, RelationshipType } from "../../src/types/entity";

export interface EvalFixture {
  name: string;
  topic: string;
  complexityTier: "trivial" | "standard" | "complex";
  phases: Partial<Record<MethodologyPhase, PhaseExpectations>>;
  priorContext?: Partial<Record<MethodologyPhase, string>>;
}

export interface PhaseExpectations {
  entityCountRange: [min: number, max: number];
  forbiddenPatterns?: string[];
  requiredPatterns?: string[];
  requiredFactCategories?: FactCategory[];
  minDistinctFactCategories?: number;
  allowedRelationshipTypes?: RelationshipType[];
  requiredRelationshipTypes?: RelationshipType[];
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
  entities: unknown[];
  relationships: unknown[];
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

export const ALLOWED_FACT_CATEGORIES: FactCategory[] = [
  "capability",
  "economic",
  "position",
  "impact",
  "action",
  "rule",
];

export const ALLOWED_PHASE_1_RELATIONSHIP_TYPES: RelationshipType[] = [
  "supports",
  "contradicts",
  "precedes",
];
