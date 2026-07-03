// revision-log.ts — field-diff computation for the per-entity revision log (E1B).
// Pure functions; entity-graph-service owns appending entries to entities.

import type {
  AnalysisEntity,
  FieldDiff,
  RevisionLogEntry,
  RevisionLogSource,
} from "../../shared/types/entity";
import { REVISION_LOG_LIMIT } from "../../src/types/entity";

/** Max JSON-encoded length per diff value before truncation (E4A). */
const DIFF_VALUE_MAX_CHARS = 2048;
const TRUNCATION_MARKER = "…[truncated]";

/** JSON.stringify with recursively sorted object keys — stable across
 * differently-ordered but equal objects (AI output vs stored state). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (typeof value === "object" && value !== null) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      sorted[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
    }
    return sorted;
  }
  return value;
}

function encodeDiffValue(value: unknown): string {
  const encoded = value === undefined ? "undefined" : stableStringify(value);
  if (encoded.length <= DIFF_VALUE_MAX_CHARS) {
    return encoded;
  }
  return encoded.slice(0, DIFF_VALUE_MAX_CHARS) + TRUNCATION_MARKER;
}

/** The entity fields the log tracks. `data` is diffed one level deep. */
type DiffableEntity = Pick<
  AnalysisEntity,
  "type" | "phase" | "data" | "confidence" | "rationale"
>;

const TOP_LEVEL_DIFF_FIELDS = [
  "type",
  "phase",
  "confidence",
  "rationale",
] as const;

/**
 * Compute old→new field diffs between two entity snapshots.
 * Returns [] when the tracked content is identical — callers use that as the
 * content-equality gate before bumping revisions (E4A no-op fix).
 */
export function computeFieldDiffs(
  before: DiffableEntity,
  after: DiffableEntity,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];

  for (const field of TOP_LEVEL_DIFF_FIELDS) {
    if (stableStringify(before[field]) !== stableStringify(after[field])) {
      diffs.push({
        field,
        old: encodeDiffValue(before[field]),
        new: encodeDiffValue(after[field]),
      });
    }
  }

  const beforeData = (before.data ?? {}) as Record<string, unknown>;
  const afterData = (after.data ?? {}) as Record<string, unknown>;
  const dataKeys = new Set([
    ...Object.keys(beforeData),
    ...Object.keys(afterData),
  ]);
  for (const key of dataKeys) {
    if (stableStringify(beforeData[key]) !== stableStringify(afterData[key])) {
      diffs.push({
        field: `data.${key}`,
        old: encodeDiffValue(beforeData[key]),
        new: encodeDiffValue(afterData[key]),
      });
    }
  }

  return diffs;
}

export function nextLogNo(log: RevisionLogEntry[] | undefined): number {
  const last = log?.at(-1);
  return (last?.logNo ?? 0) + 1;
}

export function latestLogNo(log: RevisionLogEntry[] | undefined): number {
  return log?.at(-1)?.logNo ?? 0;
}

export interface AppendRevisionLogInput {
  logSource: RevisionLogSource;
  fieldDiffs: FieldDiff[];
  runId?: string;
  conflict?: boolean;
}

/** Append an entry, keeping the log bounded. logNo stays monotonic across
 * trimming — {entityId, logNo} identifies an entry forever. */
export function appendRevisionLog(
  log: RevisionLogEntry[] | undefined,
  input: AppendRevisionLogInput,
): RevisionLogEntry[] {
  const entry: RevisionLogEntry = {
    logNo: nextLogNo(log),
    ts: Date.now(),
    logSource: input.logSource,
    ...(input.runId !== undefined ? { runId: input.runId } : {}),
    fieldDiffs: input.fieldDiffs,
    ...(input.conflict ? { conflict: true } : {}),
  };

  const next = [...(log ?? []), entry];
  return next.length > REVISION_LOG_LIMIT
    ? next.slice(next.length - REVISION_LOG_LIMIT)
    : next;
}
