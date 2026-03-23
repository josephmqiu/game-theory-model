import type { AnalysisEntity } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";
import {
  ENTITY_CARD_LAYOUT,
  getEntityCardMetrics,
} from "@/services/entity/entity-card-metrics";

// ── Column x-offsets by methodology phase ──

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
};

const DEFAULT_COLUMN_X = 100;

/**
 * Assign spatial positions to entities based on their methodology phase.
 *
 * Layout strategy:
 * - Three columns keyed by v1 phases (situational-grounding, player-identification, baseline-model)
 * - Within each column, entities stack vertically with a 24px gap between nodes
 * - Node heights vary by entity type (80px for Player/Game, 60px for Fact, 50px for others)
 */
export function layoutEntities(
  entities: AnalysisEntity[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  if (entities.length === 0) return positions;

  // Track the next y-offset per column (keyed by phase)
  const columnCursors = new Map<MethodologyPhase, number>();

  for (const entity of entities) {
    const x = PHASE_COLUMN_X[entity.phase] ?? DEFAULT_COLUMN_X;
    const y = columnCursors.get(entity.phase) ?? 0;

    positions.set(entity.id, { x, y });

    const { height } = getEntityCardMetrics(entity.type);
    columnCursors.set(
      entity.phase,
      y + height + ENTITY_CARD_LAYOUT.verticalGap,
    );
  }

  return positions;
}
