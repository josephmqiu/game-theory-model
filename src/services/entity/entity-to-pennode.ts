import type { AnalysisEntity, EntityType, LayoutState } from "@/types/entity";
import type { FrameNode, TextNode } from "@/types/pen";
import type { RenderNode } from "@/canvas/skia/skia-renderer";
import {
  ENTITY_CARD_LAYOUT,
  getEntityCardMetrics,
  truncateEntityCardText,
} from "@/services/entity/entity-card-metrics";

// ── Display helpers ──

/** Human-readable label for entity. Uses data.name where available, falls back to type. */
export function entityDisplayName(entity: AnalysisEntity): string {
  const d = entity.data;
  if ("name" in d && typeof d.name === "string" && d.name) return d.name;
  if ("gameName" in d && typeof d.gameName === "string" && d.gameName)
    return d.gameName;
  if ("negotiation" in d && typeof d.negotiation === "string" && d.negotiation)
    return d.negotiation;
  if ("content" in d && typeof d.content === "string" && d.content)
    return d.content;
  if ("description" in d && typeof d.description === "string" && d.description)
    return d.description;
  if ("action" in d && typeof d.action === "string" && d.action)
    return d.action;
  return entity.type;
}

/** Uppercase type badge label for display. */
function entityTypeBadge(type: EntityType): string {
  return type.replace(/-/g, " ").toUpperCase();
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
    case "analysis-report":
      return `report`;
  }
}

function entityCanvasTitle(entity: AnalysisEntity): string {
  const fullTitle = entityDisplayName(entity);
  const { titleMaxChars } = getEntityCardMetrics(entity.type);
  return truncateEntityCardText(fullTitle, titleMaxChars);
}

function entityCanvasMetaLine(entity: AnalysisEntity): string {
  const fullMetaLine = entityMetaLine(entity);
  const { metaMaxChars } = getEntityCardMetrics(entity.type);
  return truncateEntityCardText(fullMetaLine, metaMaxChars);
}

// ── Mapping ──

/**
 * Map an AnalysisEntity to a RenderNode for the Skia canvas.
 *
 * Builds a FrameNode with three TextNode children (badge + name + meta),
 * using the entity's position, type-based size, and a semantic role
 * prefixed with "entity-".
 */
export function entityToRenderNode(
  entity: AnalysisEntity,
  layoutEntry: LayoutState[string],
): RenderNode {
  const size = getEntityCardMetrics(entity.type);
  const { x, y } = layoutEntry;

  const padL = ENTITY_CARD_LAYOUT.padLeft;
  const padR = ENTITY_CARD_LAYOUT.padRight;
  const padT = ENTITY_CARD_LAYOUT.padTop;
  const contentW = size.width - padL - padR;

  const badgeText: TextNode = {
    id: `${entity.id}__badge`,
    type: "text",
    x: padL,
    y: padT,
    width: contentW,
    height: ENTITY_CARD_LAYOUT.badgeHeight,
    content: entityTypeBadge(entity.type),
    fontFamily: "Geist",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: 0.06,
    textGrowth: "fixed-width",
    fill: [{ type: "solid", color: "#A1A1AA" }], // placeholder — overridden at render time
  };

  const nameText: TextNode = {
    id: `${entity.id}__name`,
    type: "text",
    x: padL,
    y: padT + ENTITY_CARD_LAYOUT.badgeHeight + ENTITY_CARD_LAYOUT.badgeGap,
    width: contentW,
    height: ENTITY_CARD_LAYOUT.titleHeight,
    content: entityCanvasTitle(entity),
    fontFamily: "Geist",
    fontSize: 15,
    fontWeight: 600,
    textGrowth: "fixed-width",
    fill: [{ type: "solid", color: "#F4F4F5" }],
  };

  const metaText: TextNode = {
    id: `${entity.id}__meta`,
    type: "text",
    x: padL,
    y:
      size.height -
      ENTITY_CARD_LAYOUT.padBottom -
      ENTITY_CARD_LAYOUT.metaHeight,
    width: contentW,
    height: ENTITY_CARD_LAYOUT.metaHeight,
    content: entityCanvasMetaLine(entity),
    fontFamily: "Geist",
    fontSize: 12,
    fontWeight: 400,
    textGrowth: "fixed-width",
    fill: [{ type: "solid", color: "#71717A" }],
  };

  const frame: FrameNode = {
    id: entity.id,
    type: "frame",
    role: `entity-${entity.type}`,
    name: entityDisplayName(entity),
    x,
    y,
    width: size.width,
    height: size.height,
    cornerRadius: ENTITY_CARD_LAYOUT.cornerRadius,
    children: [badgeText, nameText, metaText],
  };

  return {
    node: frame,
    absX: x,
    absY: y,
    absW: size.width,
    absH: size.height,
  };
}
