import type { AnalysisEntity, EntityType } from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";

// ── Column x-offsets by methodology phase ──

const PHASE_COLUMN_X: Record<string, number> = {
  "situational-grounding": 100,
  "player-identification": 500,
  "baseline-model": 900,
};

const DEFAULT_COLUMN_X = 100;

// ── Node height estimates by entity type ──

const ENTITY_HEIGHT: Record<EntityType, number> = {
  player: 80,
  game: 80,
  fact: 60,
  objective: 50,
  strategy: 50,
  payoff: 50,
  "institutional-rule": 60,
  "escalation-rung": 50,
};

const VERTICAL_GAP = 24;

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

    const height = ENTITY_HEIGHT[entity.type] ?? 50;
    columnCursors.set(entity.phase, y + height + VERTICAL_GAP);
  }

  return positions;
}
