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
  /** Per-type entity count constraints. E.g. { player: [1, 4], objective: [1, 6] } */
  entityTypeMix?: Record<string, [min: number, max: number]>;
  /** If true, entities must reference prior-phase entity IDs in their data fields
   *  (e.g. assumption.dependencies, scenario.key_assumptions, eliminated-outcome.source_entity_ids) */
  requireCrossPhaseRefs?: boolean;
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
  transcript?: string;
}

export interface PhaseEvalReport {
  fixture: string;
  phase: MethodologyPhase;
  effort: AnalysisEffortLevel;
  trials: TrialResult[];
  passRate: number; // fraction of trials where all graders passed
  allPass: boolean; // true only if every trial passed all graders
  // Aggregate metrics (Anthropic eval best practices)
  passAtK?: number; // P(>=1 pass in k trials)
  passHatK?: number; // P(all k pass)
  sem?: number; // Standard error of the mean
  ci95?: [number, number]; // 95% confidence interval
  meanLatencyMs?: number;
  medianLatencyMs?: number;
}
