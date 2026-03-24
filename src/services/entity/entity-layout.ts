import type { AnalysisEntity } from "@/types/entity";
import {
  ENTITY_CARD_LAYOUT,
  getEntityCardMetrics,
} from "@/services/entity/entity-card-metrics";

// ── Column x-offsets by methodology phase (+ synthesis) ──

export const PHASE_COLUMN_X: Record<string, number> = {
  "situational-grounding": 100,
  "player-identification": 500,
  "baseline-model": 900,
  "historical-game": 1300,
  "formal-modeling": 1700,
  assumptions: 2100,
  elimination: 2500,
  scenarios: 2900,
  "meta-check": 3300,
  synthesis: 3700,
};

const DEFAULT_COLUMN_X = 100;

// ── Type-to-column override ──
// Some entity types render in a different column than their phase would suggest.
const TYPE_COLUMN_OVERRIDE: Partial<Record<string, string>> = {
  "analysis-report": "synthesis",
};

/**
 * Assign spatial positions to entities based on their methodology phase.
 *
 * Layout strategy:
 * - Columns keyed by methodology phase, plus a synthesis column for cross-phase entities
 * - Entity types listed in TYPE_COLUMN_OVERRIDE are routed to their override column
 *   instead of their phase column, with an independent vertical cursor
 * - Within each column, entities stack vertically with a gap between nodes
 * - Node heights vary by entity type
 */
export function layoutEntities(
  entities: AnalysisEntity[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (entities.length === 0) return positions;

  // Track the next y-offset per column (keyed by phase or override column key)
  const columnCursors = new Map<string, number>();

  for (const entity of entities) {
    const columnKey = TYPE_COLUMN_OVERRIDE[entity.type] ?? entity.phase;
    const x = PHASE_COLUMN_X[columnKey] ?? DEFAULT_COLUMN_X;
    const y = columnCursors.get(columnKey) ?? 0;

    positions.set(entity.id, { x, y });

    const { height } = getEntityCardMetrics(entity.type);
    columnCursors.set(columnKey, y + height + ENTITY_CARD_LAYOUT.verticalGap);
  }

  return positions;
}
