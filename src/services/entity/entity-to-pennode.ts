import type { AnalysisEntity, EntityType, LayoutState } from "@/types/entity";
import type { FrameNode, TextNode } from "@/types/pen";
import type { RenderNode } from "@/canvas/skia/skia-renderer";

// ── Entity node sizes by type (from DESIGN.md Canvas Rendering) ──

const ENTITY_SIZE: Record<EntityType, { w: number; h: number }> = {
  player: { w: 160, h: 80 },
  game: { w: 160, h: 80 },
  fact: { w: 140, h: 60 },
  objective: { w: 120, h: 50 },
  strategy: { w: 120, h: 50 },
  payoff: { w: 120, h: 50 },
  "institutional-rule": { w: 140, h: 60 },
  "escalation-rung": { w: 120, h: 50 },
  "interaction-history": { w: 160, h: 80 },
  "repeated-game-pattern": { w: 140, h: 60 },
  "trust-assessment": { w: 140, h: 60 },
  "dynamic-inconsistency": { w: 140, h: 60 },
  "signaling-effect": { w: 120, h: 50 },
  "payoff-matrix": { w: 180, h: 100 },
  "game-tree": { w: 180, h: 100 },
  "equilibrium-result": { w: 160, h: 80 },
  "cross-game-constraint-table": { w: 180, h: 100 },
  "cross-game-effect": { w: 140, h: 60 },
  "signal-classification": { w: 140, h: 60 },
  "bargaining-dynamics": { w: 160, h: 80 },
  "option-value-assessment": { w: 140, h: 60 },
  "behavioral-overlay": { w: 140, h: 60 },
  assumption: { w: 120, h: 50 },
  "eliminated-outcome": { w: 140, h: 60 },
  scenario: { w: 160, h: 80 },
  "central-thesis": { w: 180, h: 100 },
  "meta-check": { w: 180, h: 100 },
};

// ── Display helpers ──

/** Human-readable label for entity. Uses data.name where available, falls back to type. */
function entityDisplayName(entity: AnalysisEntity): string {
  const d = entity.data;
  if ("name" in d && typeof d.name === "string" && d.name) return d.name;
  if ("gameName" in d && typeof d.gameName === "string" && d.gameName)
    return d.gameName;
  if ("negotiation" in d && typeof d.negotiation === "string" && d.negotiation)
    return d.negotiation.length > 30
      ? d.negotiation.slice(0, 27) + "..."
      : d.negotiation;
  if ("content" in d && typeof d.content === "string" && d.content) {
    return d.content.length > 30 ? d.content.slice(0, 27) + "..." : d.content;
  }
  if (
    "description" in d &&
    typeof d.description === "string" &&
    d.description
  ) {
    return d.description.length > 30
      ? d.description.slice(0, 27) + "..."
      : d.description;
  }
  if ("action" in d && typeof d.action === "string" && d.action) {
    return d.action.length > 30 ? d.action.slice(0, 27) + "..." : d.action;
  }
  return entity.type;
}

/** Short meta line for the entity (type + extra info). */
function entityMetaLine(entity: AnalysisEntity): string {
  const d = entity.data;
  switch (d.type) {
    case "fact":
      return `fact / ${d.category}`;
    case "player":
      return `player / ${d.playerType}`;
    case "objective":
      return `objective / ${d.priority}`;
    case "game":
      return `game / ${d.gameType}`;
    case "strategy":
      return `strategy / ${d.feasibility}`;
    case "payoff":
      return `payoff`;
    case "institutional-rule":
      return `rule / ${d.ruleType}`;
    case "escalation-rung":
      return `rung #${d.order}`;
    case "interaction-history":
      return `history / ${d.playerPair.join(" \u2194 ")}`;
    case "repeated-game-pattern":
      return `pattern / ${d.patternType}`;
    case "trust-assessment":
      return `trust / ${d.trustLevel}`;
    case "dynamic-inconsistency":
      return `commitment / ${d.durability}`;
    case "signaling-effect":
      return `signal`;
    case "payoff-matrix":
      return `matrix / ${d.players.join(" vs ")}`;
    case "game-tree":
      return `tree / ${d.nodes.length} nodes`;
    case "equilibrium-result":
      return `equilibrium / ${d.equilibriumType}`;
    case "cross-game-constraint-table":
      return `constraints / ${d.games.length} games`;
    case "cross-game-effect":
      return `effect / ${d.effectType}`;
    case "signal-classification":
      return `signal / ${d.classification}`;
    case "bargaining-dynamics":
      return `bargaining`;
    case "option-value-assessment":
      return `option value / ${d.uncertaintyLevel}`;
    case "behavioral-overlay":
      return `behavioral / ${d.overlayType}`;
    case "assumption":
      return `assumption / ${d.sensitivity}`;
    case "eliminated-outcome":
      return `eliminated / ${d.source_phase}`;
    case "scenario":
      return `scenario / ${d.subtype}`;
    case "central-thesis":
      return `thesis`;
    case "meta-check":
      return `meta-check / ${d.questions.filter((q) => q.disruption_trigger_identified).length} triggers`;
  }
}

// ── Mapping ──

/**
 * Map an AnalysisEntity to a RenderNode for the Skia canvas.
 *
 * Builds a FrameNode with two TextNode children (name + meta line),
 * using the entity's position, type-based size, and a semantic role
 * prefixed with "entity-".
 */
export function entityToRenderNode(
  entity: AnalysisEntity,
  layoutEntry: LayoutState[string],
): RenderNode {
  const size = ENTITY_SIZE[entity.type] ?? { w: 120, h: 50 };
  const { x, y } = layoutEntry;

  const nameText: TextNode = {
    id: `${entity.id}__name`,
    type: "text",
    x: 10,
    y: 10,
    width: size.w - 20,
    height: 18,
    content: entityDisplayName(entity),
    fontFamily: "Geist",
    fontSize: 14,
    fontWeight: 600,
    textGrowth: "fixed-width",
    fill: [{ type: "solid", color: "#FAFAFA" }],
  };

  const metaText: TextNode = {
    id: `${entity.id}__meta`,
    type: "text",
    x: 10,
    y: 32,
    width: size.w - 20,
    height: 16,
    content: entityMetaLine(entity),
    fontFamily: "Geist",
    fontSize: 12,
    fontWeight: 400,
    textGrowth: "fixed-width",
    fill: [{ type: "solid", color: "#A1A1AA" }],
  };

  const frame: FrameNode = {
    id: entity.id,
    type: "frame",
    role: `entity-${entity.type}`,
    name: entityDisplayName(entity),
    x,
    y,
    width: size.w,
    height: size.h,
    cornerRadius: 6,
    children: [nameText, metaText],
  };

  return {
    node: frame,
    absX: x,
    absY: y,
    absW: size.w,
    absH: size.h,
  };
}
