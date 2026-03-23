import type { AnalysisRelationship, RelationshipType } from "@/types/entity";
import { RELATIONSHIP_CATEGORY } from "@/types/entity";
import { PHASE_NUMBERS } from "@/types/methodology";
import type { MethodologyPhase } from "@/types/methodology";
import { PHASE_COLUMN_X } from "@/services/entity/entity-layout";
import { getEntityCardMetrics } from "@/services/entity/entity-card-metrics";

// Retained for future use by rendering layer; suppress unused-import error
void getEntityCardMetrics;

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

// ── Helpers ──

type Side = "right" | "left" | "top" | "bottom";

/** Key for grouping edges by inter-column gap (forward/backward only) */
function channelKey(phaseA: number, phaseB: number): string {
  const lo = Math.min(phaseA, phaseB);
  const hi = Math.max(phaseA, phaseB);
  return `${lo}-${hi}`;
}

function classifyDirection(
  sourcePhase: string,
  targetPhase: string,
): EdgeDirection {
  const srcNum = PHASE_NUMBERS[sourcePhase as MethodologyPhase] ?? 0;
  const tgtNum = PHASE_NUMBERS[targetPhase as MethodologyPhase] ?? 0;
  if (srcNum < tgtNum) return "forward";
  if (srcNum > tgtNum) return "backward";
  return "same-phase";
}

// ── Port allocation ──

interface PortAllocation {
  entityId: string;
  side: Side;
  relId: string;
}

/**
 * Build a map from entityId+side to a list of relationship IDs using that port.
 * Returns a function that, given an entityId, side, and relId, returns
 * the port position for that edge.
 */
function buildPortAllocator(
  allocations: PortAllocation[],
  entityMap: Map<string, EntityRect>,
) {
  // Group allocations by entity+side
  const groups = new Map<string, string[]>();
  for (const alloc of allocations) {
    const key = `${alloc.entityId}:${alloc.side}`;
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(alloc.relId);
  }

  // For each entity+side, assign port indices
  const portIndex = new Map<string, number>();
  const portCount = new Map<string, number>();
  for (const [key, relIds] of groups) {
    for (let i = 0; i < relIds.length; i++) {
      portIndex.set(`${key}:${relIds[i]}`, i);
      portCount.set(key, relIds.length);
    }
  }

  return function getPort(entityId: string, side: Side, relId: string): Port {
    const entity = entityMap.get(entityId)!;
    const key = `${entityId}:${side}`;
    const idx = portIndex.get(`${key}:${relId}`) ?? 0;
    const count = portCount.get(key) ?? 1;

    // Distribute ports evenly along the edge
    // portPos = entityEdge + (dimension * (idx + 1)) / (count + 1)
    switch (side) {
      case "right":
        return {
          x: entity.x + entity.w,
          y: entity.y + (entity.h * (idx + 1)) / (count + 1),
        };
      case "left":
        return {
          x: entity.x,
          y: entity.y + (entity.h * (idx + 1)) / (count + 1),
        };
      case "bottom":
        return {
          x: entity.x + (entity.w * (idx + 1)) / (count + 1),
          y: entity.y + entity.h,
        };
      case "top":
        return {
          x: entity.x + (entity.w * (idx + 1)) / (count + 1),
          y: entity.y,
        };
    }
  };
}

// ── Channel x-offset assignment ──

/**
 * Compute channel x-positions for edges that share an inter-column gap.
 * Returns a map from relId -> channel x-offset.
 */
function assignChannelOffsets(
  edges: {
    relId: string;
    channelKey: string;
    sourcePhase: string;
    targetPhase: string;
  }[],
  entityMap: Map<string, EntityRect>,
): Map<string, number> {
  // Group edges by their channel (inter-column gap)
  const channelGroups = new Map<string, string[]>();
  for (const edge of edges) {
    let arr = channelGroups.get(edge.channelKey);
    if (!arr) {
      arr = [];
      channelGroups.set(edge.channelKey, arr);
    }
    arr.push(edge.relId);
  }

  const result = new Map<string, number>();

  for (const [key, relIds] of channelGroups) {
    // Parse channel key to get the two phase numbers
    const [loStr, hiStr] = key.split("-");
    const lo = parseInt(loStr, 10);
    const hi = parseInt(hiStr, 10);

    // Find the column x-positions for these phases
    const phases = Object.entries(PHASE_NUMBERS) as [
      MethodologyPhase,
      number,
    ][];
    const loPhase = phases.find(([, n]) => n === lo)?.[0];
    const hiPhase = phases.find(([, n]) => n === hi)?.[0];

    if (!loPhase || !hiPhase) continue;

    const loX = PHASE_COLUMN_X[loPhase] ?? 0;
    const hiX = PHASE_COLUMN_X[hiPhase] ?? 0;

    // Compute the right edge of the left column's cards
    // We need the widest card in that column — use a representative width
    // Find entities in the lo phase to get actual widths, fallback to 240
    let loRightEdge = loX + 240;
    for (const [, ent] of entityMap) {
      const entPhaseNum = PHASE_NUMBERS[ent.phase as MethodologyPhase] ?? 0;
      if (entPhaseNum === lo) {
        loRightEdge = Math.max(loRightEdge, ent.x + ent.w);
      }
    }

    // Channel center is midpoint between left column right edge and right column left edge
    const channelCenter = (loRightEdge + hiX) / 2;

    // Space edges around the center
    const count = relIds.length;
    const totalWidth = (count - 1) * CHANNEL_SPACING;
    const startX = channelCenter - totalWidth / 2;

    for (let i = 0; i < relIds.length; i++) {
      result.set(relIds[i], startX + i * CHANNEL_SPACING);
    }
  }

  return result;
}

// ── Main function ──

export function routeEdges(
  entities: EntityRect[],
  relationships: AnalysisRelationship[],
): RoutedEdge[] {
  if (entities.length === 0 || relationships.length === 0) return [];

  // Step 1: Build entity rect lookup
  const entityMap = new Map<string, EntityRect>();
  for (const ent of entities) {
    entityMap.set(ent.id, ent);
  }

  // Step 2: Classify each relationship and determine port sides
  // Filter out relationships referencing missing entities
  interface EdgeInfo {
    rel: AnalysisRelationship;
    direction: EdgeDirection;
    fromSide: Side;
    toSide: Side;
    channelKey: string | null;
    sourcePhase: string;
    targetPhase: string;
  }

  const edgeInfos: EdgeInfo[] = [];

  for (const rel of relationships) {
    const fromEntity = entityMap.get(rel.fromEntityId);
    const toEntity = entityMap.get(rel.toEntityId);
    if (!fromEntity || !toEntity) continue;

    const direction = classifyDirection(fromEntity.phase, toEntity.phase);

    let fromSide: Side;
    let toSide: Side;
    let chKey: string | null = null;

    switch (direction) {
      case "forward":
        fromSide = "right";
        toSide = "left";
        chKey = channelKey(
          PHASE_NUMBERS[fromEntity.phase as MethodologyPhase] ?? 0,
          PHASE_NUMBERS[toEntity.phase as MethodologyPhase] ?? 0,
        );
        break;
      case "backward":
        fromSide = "left";
        toSide = "right";
        chKey = channelKey(
          PHASE_NUMBERS[fromEntity.phase as MethodologyPhase] ?? 0,
          PHASE_NUMBERS[toEntity.phase as MethodologyPhase] ?? 0,
        );
        break;
      case "same-phase": {
        // Upper entity exits bottom, lower entity enters top
        if (fromEntity.y <= toEntity.y) {
          fromSide = "bottom";
          toSide = "top";
        } else {
          fromSide = "bottom";
          toSide = "top";
        }
        break;
      }
    }

    edgeInfos.push({
      rel,
      direction,
      fromSide: fromSide!,
      toSide: toSide!,
      channelKey: chKey,
      sourcePhase: fromEntity.phase,
      targetPhase: toEntity.phase,
    });
  }

  if (edgeInfos.length === 0) return [];

  // Step 3: Build port allocations
  const allocations: PortAllocation[] = [];
  for (const info of edgeInfos) {
    allocations.push({
      entityId: info.rel.fromEntityId,
      side: info.fromSide,
      relId: info.rel.id,
    });
    allocations.push({
      entityId: info.rel.toEntityId,
      side: info.toSide,
      relId: info.rel.id,
    });
  }

  const getPort = buildPortAllocator(allocations, entityMap);

  // Step 4: Assign channel offsets for forward/backward edges
  const channelEdges = edgeInfos
    .filter((info) => info.channelKey !== null)
    .map((info) => ({
      relId: info.rel.id,
      channelKey: info.channelKey!,
      sourcePhase: info.sourcePhase,
      targetPhase: info.targetPhase,
    }));

  const channelOffsets = assignChannelOffsets(channelEdges, entityMap);

  // Step 5: Build routed edges with waypoints
  const result: RoutedEdge[] = [];

  for (const info of edgeInfos) {
    const fromPort = getPort(info.rel.fromEntityId, info.fromSide, info.rel.id);
    const toPort = getPort(info.rel.toEntityId, info.toSide, info.rel.id);

    const waypoints: { x: number; y: number }[] = [];

    switch (info.direction) {
      case "forward": {
        // Exit right -> channel -> enter left
        const exitWp = { x: fromPort.x + EXIT_OFFSET, y: fromPort.y };
        const channelX =
          channelOffsets.get(info.rel.id) ?? (fromPort.x + toPort.x) / 2;
        const channelTop = { x: channelX, y: fromPort.y };
        const channelBottom = { x: channelX, y: toPort.y };
        const entryWp = { x: toPort.x - EXIT_OFFSET, y: toPort.y };
        waypoints.push(exitWp, channelTop, channelBottom, entryWp);
        break;
      }
      case "backward": {
        // Exit left -> channel -> enter right
        const exitWp = { x: fromPort.x - EXIT_OFFSET, y: fromPort.y };
        const channelX =
          channelOffsets.get(info.rel.id) ?? (fromPort.x + toPort.x) / 2;
        const channelTop = { x: channelX, y: fromPort.y };
        const channelBottom = { x: channelX, y: toPort.y };
        const entryWp = { x: toPort.x + EXIT_OFFSET, y: toPort.y };
        waypoints.push(exitWp, channelTop, channelBottom, entryWp);
        break;
      }
      case "same-phase": {
        // Exit bottom -> small horizontal offset -> enter top
        const fromEntity = entityMap.get(info.rel.fromEntityId)!;
        const offsetX = fromEntity.x + fromEntity.w + EXIT_OFFSET;
        const exitWp = { x: fromPort.x, y: fromPort.y + EXIT_OFFSET };
        const midTop = { x: offsetX, y: fromPort.y + EXIT_OFFSET };
        const midBottom = { x: offsetX, y: toPort.y - EXIT_OFFSET };
        const entryWp = { x: toPort.x, y: toPort.y - EXIT_OFFSET };
        waypoints.push(exitWp, midTop, midBottom, entryWp);
        break;
      }
    }

    result.push({
      relationshipId: info.rel.id,
      relType: info.rel.type,
      category: RELATIONSHIP_CATEGORY[info.rel.type],
      direction: info.direction,
      from: fromPort,
      to: toPort,
      waypoints,
    });
  }

  return result;
}

// Re-export for Task 3 consumers
export type { MethodologyPhase };
