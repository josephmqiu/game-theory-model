// entity-update-validation.ts — server-side validation for human entity edits (8A).
// Every write through /api/ai/entity is validated against the per-type Zod
// data schemas before it touches the graph (or the edit queue): invalid
// payloads produce field-level errors, never partial writes.

import { z } from "zod/v4";
import type {
  AnalysisEntity,
  EntityConfidence,
  EntityData,
  EntityType,
} from "../../src/types/entity";
import {
  analysisReportDataSchema,
  assumptionDataSchema,
  bargainingDynamicsDataSchema,
  behavioralOverlayDataSchema,
  centralThesisDataSchema,
  crossGameConstraintTableDataSchema,
  crossGameEffectDataSchema,
  dynamicInconsistencyDataSchema,
  eliminatedOutcomeDataSchema,
  entityConfidenceSchema,
  equilibriumResultDataSchema,
  escalationRungDataSchema,
  factDataSchema,
  gameDataSchema,
  gameTreeDataSchema,
  institutionalRuleDataSchema,
  interactionHistoryDataSchema,
  metaCheckDataSchema,
  objectiveDataSchema,
  optionValueAssessmentDataSchema,
  payoffDataSchema,
  payoffMatrixDataSchema,
  playerDataSchema,
  repeatedGamePatternDataSchema,
  scenarioDataSchema,
  signalClassificationDataSchema,
  signalingEffectDataSchema,
  strategyDataSchema,
  trustAssessmentDataSchema,
} from "../../src/types/entity";

/** One data schema per entity type — the single source for edit validation. */
export const DATA_SCHEMAS: Record<EntityType, z.ZodType<EntityData>> = {
  fact: factDataSchema,
  player: playerDataSchema,
  objective: objectiveDataSchema,
  game: gameDataSchema,
  strategy: strategyDataSchema,
  payoff: payoffDataSchema,
  "institutional-rule": institutionalRuleDataSchema,
  "escalation-rung": escalationRungDataSchema,
  "interaction-history": interactionHistoryDataSchema,
  "repeated-game-pattern": repeatedGamePatternDataSchema,
  "trust-assessment": trustAssessmentDataSchema,
  "dynamic-inconsistency": dynamicInconsistencyDataSchema,
  "signaling-effect": signalingEffectDataSchema,
  "payoff-matrix": payoffMatrixDataSchema,
  "game-tree": gameTreeDataSchema,
  "equilibrium-result": equilibriumResultDataSchema,
  "cross-game-constraint-table": crossGameConstraintTableDataSchema,
  "cross-game-effect": crossGameEffectDataSchema,
  "signal-classification": signalClassificationDataSchema,
  "bargaining-dynamics": bargainingDynamicsDataSchema,
  "option-value-assessment": optionValueAssessmentDataSchema,
  "behavioral-overlay": behavioralOverlayDataSchema,
  assumption: assumptionDataSchema,
  "eliminated-outcome": eliminatedOutcomeDataSchema,
  scenario: scenarioDataSchema,
  "central-thesis": centralThesisDataSchema,
  "meta-check": metaCheckDataSchema,
  "analysis-report": analysisReportDataSchema,
};

/** Fields a human edit may touch. Everything else is server-owned. */
const EDITABLE_FIELDS = new Set(["data", "confidence", "rationale"]);

const rationaleSchema = z.string().min(1, "Rationale cannot be empty");

export interface ValidatedEntityUpdates {
  data?: EntityData;
  confidence?: EntityConfidence;
  rationale?: string;
}

export type EntityUpdateValidationResult =
  | { ok: true; updates: ValidatedEntityUpdates }
  | { ok: false; fieldErrors: Record<string, string> };

export type NewEntityValidationResult =
  | { ok: true; type: EntityType; data: EntityData }
  | { ok: false; fieldErrors: Record<string, string> };

function collectIssues(
  issues: z.core.$ZodIssue[],
  prefix: string,
  fieldErrors: Record<string, string>,
): void {
  for (const issue of issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "";
    const key = path ? `${prefix}.${path}` : prefix;
    // First error per field wins — keeps the payload small and stable
    if (!(key in fieldErrors)) {
      fieldErrors[key] = issue.message;
    }
  }
}

/**
 * Validate a human edit against the target entity's per-type schema.
 *
 * `updates.data` may be partial: it is merged over the entity's current data
 * and the merged object must satisfy the full per-type schema. The `type`
 * discriminator is server-owned and cannot be changed by an edit.
 */
export function validateEntityUpdates(
  existing: Pick<AnalysisEntity, "type" | "data">,
  updates: Record<string, unknown>,
): EntityUpdateValidationResult {
  const fieldErrors: Record<string, string> = {};
  const sanitized: ValidatedEntityUpdates = {};

  const keys = Object.keys(updates);
  if (keys.length === 0) {
    return {
      ok: false,
      fieldErrors: { updates: "No editable fields provided" },
    };
  }

  for (const key of keys) {
    if (!EDITABLE_FIELDS.has(key)) {
      fieldErrors[key] = "Field is not editable";
    }
  }

  if ("confidence" in updates) {
    const parsed = entityConfidenceSchema.safeParse(updates.confidence);
    if (parsed.success) {
      sanitized.confidence = parsed.data;
    } else {
      fieldErrors.confidence = 'Must be one of "high", "medium", or "low"';
    }
  }

  if ("rationale" in updates) {
    const parsed = rationaleSchema.safeParse(updates.rationale);
    if (parsed.success) {
      sanitized.rationale = parsed.data;
    } else {
      fieldErrors.rationale = parsed.error.issues[0]?.message ?? "Invalid";
    }
  }

  if ("data" in updates) {
    const rawData = updates.data;
    if (
      typeof rawData !== "object" ||
      rawData === null ||
      Array.isArray(rawData)
    ) {
      fieldErrors.data = "Expected an object of entity fields";
    } else {
      const dataUpdates = rawData as Record<string, unknown>;
      if ("type" in dataUpdates && dataUpdates.type !== existing.type) {
        fieldErrors["data.type"] = "Entity type cannot be changed";
      } else {
        const schema = DATA_SCHEMAS[existing.type];
        const merged = {
          ...(existing.data as Record<string, unknown>),
          ...dataUpdates,
          type: existing.type,
        };
        const parsed = schema.safeParse(merged);
        if (parsed.success) {
          sanitized.data = parsed.data;
        } else {
          collectIssues(parsed.error.issues, "data", fieldErrors);
        }
      }
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  return { ok: true, updates: sanitized };
}

function isEntityType(value: string): value is EntityType {
  return Object.prototype.hasOwnProperty.call(DATA_SCHEMAS, value);
}

/**
 * Validate model-created entity data against the same per-type schema used for
 * edits. `type` is supplied out-of-band by the tool call, but `data.type` must
 * not contradict it.
 */
export function validateNewEntity(
  type: string,
  data: Record<string, unknown>,
): NewEntityValidationResult {
  if (!isEntityType(type)) {
    return {
      ok: false,
      fieldErrors: { type: `Unsupported entity type: ${type}` },
    };
  }

  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return {
      ok: false,
      fieldErrors: { data: "Expected an object of entity fields" },
    };
  }

  if ("type" in data && data.type !== type) {
    return {
      ok: false,
      fieldErrors: { "data.type": "Entity type cannot be changed" },
    };
  }

  const parsed = DATA_SCHEMAS[type].safeParse({ ...data, type });
  if (parsed.success) {
    return { ok: true, type, data: parsed.data };
  }

  const fieldErrors: Record<string, string> = {};
  collectIssues(parsed.error.issues, "data", fieldErrors);
  return { ok: false, fieldErrors };
}
