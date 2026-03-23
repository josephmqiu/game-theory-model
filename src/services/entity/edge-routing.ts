import type { AnalysisRelationship, RelationshipType } from "@/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import { PHASE_NUMBERS } from "@/types/methodology";
import type { MethodologyPhase } from "@/types/methodology";
import { PHASE_COLUMN_X } from "@/services/entity/entity-layout";
import { getEntityCardMetrics } from "@/services/entity/entity-card-metrics";

// ── Types ──

export interface EntityRect {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  phase: string;
}

export interface Port {
  x: number;
  y: number;
}

export type EdgeDirection = "forward" | "backward" | "same-phase";

export interface RoutedEdge {
  relationshipId: string;
  relType: RelationshipType;
  category: "downstream" | "evidence" | "structural";
  direction: EdgeDirection;
  from: Port;
  to: Port;
  waypoints: { x: number; y: number }[];
}

/** Minimum horizontal distance from port to first waypoint */
const EXIT_OFFSET = 16;
/** Minimum vertical spacing between parallel channel segments */
const CHANNEL_SPACING = 8;

// ── Main function (implement in Task 3) ──

export function routeEdges(
  _entities: EntityRect[],
  _relationships: AnalysisRelationship[],
): RoutedEdge[] {
  // Imports used in Task 3 implementation — suppress unused warnings
  void RELATIONSHIP_CATEGORY;
  void PHASE_NUMBERS;
  void PHASE_COLUMN_X;
  void getEntityCardMetrics;
  void EXIT_OFFSET;
  void CHANNEL_SPACING;

  return []; // placeholder — implemented in Task 3
}

// Re-export for Task 3 consumers
export type { MethodologyPhase };
