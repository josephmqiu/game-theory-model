import type {
  AnalysisEntity,
  AnalysisRelationship,
  EntityAnalysis,
  EntityType,
  FactData,
  PlayerData,
  ObjectiveData,
  GameData,
  StrategyData,
  InstitutionalRuleData,
  EscalationRungData,
  PayoffData,
} from "@/types/entity";
import type { MethodologyPhase } from "@/types/methodology";
import { PHASE_LABELS, PHASE_NUMBERS, ALL_PHASES } from "@/types/methodology";

// ── Helpers ──

const or = (value: string | null | undefined, placeholder = "—"): string =>
  value && value.trim() !== "" ? value : placeholder;

type EntityGroup = Map<EntityType, AnalysisEntity[]>;

function groupByPhaseAndType(
  entities: AnalysisEntity[],
): Map<MethodologyPhase, EntityGroup> {
  const phaseMap = new Map<MethodologyPhase, EntityGroup>();
  for (const entity of entities) {
    let group = phaseMap.get(entity.phase);
    if (!group) {
      group = new Map();
      phaseMap.set(entity.phase, group);
    }
    let list = group.get(entity.type);
    if (!list) {
      list = [];
      group.set(entity.type, list);
    }
    list.push(entity);
  }
  return phaseMap;
}

// ── Per-type renderers ──

function renderFacts(entities: AnalysisEntity[]): string {
  const lines = ["### Facts"];
  for (const e of entities) {
    const d = e.data as FactData;
    lines.push(
      `- **${or(d.date)}** — ${or(d.content)} (Source: ${or(d.source)}) [Confidence: ${e.confidence}]`,
    );
  }
  return lines.join("\n");
}

function renderPlayers(entities: AnalysisEntity[]): string {
  const lines = ["### Players"];
  for (const e of entities) {
    const d = e.data as PlayerData;
    lines.push(`#### ${d.name} (${d.playerType})`);
    if (d.knowledge.length > 0) {
      lines.push(`- **Knowledge:** ${d.knowledge.join(", ")}`);
    }
    lines.push(`- [Confidence: ${e.confidence}]`);
  }
  return lines.join("\n");
}

function renderObjectives(entities: AnalysisEntity[]): string {
  const lines = ["### Objectives"];
  for (const e of entities) {
    const d = e.data as ObjectiveData;
    lines.push(
      `- ${or(d.description)} [${d.priority}] [Confidence: ${e.confidence}]`,
    );
  }
  return lines.join("\n");
}

function renderGames(entities: AnalysisEntity[]): string {
  const lines = ["### Games"];
  for (const e of entities) {
    const d = e.data as GameData;
    lines.push(`#### ${d.name} (${d.gameType}, ${d.timing})`);
    if (d.description && d.description.trim() !== "") {
      lines.push(d.description);
    }
    lines.push(`- [Confidence: ${e.confidence}]`);
  }
  return lines.join("\n");
}

function renderStrategies(entities: AnalysisEntity[]): string {
  const lines = ["### Strategies"];
  for (const e of entities) {
    const d = e.data as StrategyData;
    lines.push(`- ${d.name} [${d.feasibility}] [Confidence: ${e.confidence}]`);
  }
  return lines.join("\n");
}

function renderPayoffs(entities: AnalysisEntity[]): string {
  const lines = ["### Payoffs"];
  for (const e of entities) {
    const d = e.data as PayoffData;
    const rank = d.rank != null ? `Rank ${d.rank}` : "—";
    const value = d.value != null ? `Value ${d.value}` : "—";
    const rationale = or(d.rationale);
    lines.push(
      `- ${rank}, ${value}: ${rationale} [Confidence: ${e.confidence}]`,
    );
  }
  return lines.join("\n");
}

function renderInstitutionalRules(entities: AnalysisEntity[]): string {
  const lines = ["### Institutional Rules"];
  for (const e of entities) {
    const d = e.data as InstitutionalRuleData;
    lines.push(
      `- **${d.name}** (${d.ruleType}): ${or(d.effectOnStrategies)} [Confidence: ${e.confidence}]`,
    );
  }
  return lines.join("\n");
}

function renderEscalationLadder(entities: AnalysisEntity[]): string {
  const sorted = [...entities].sort((a, b) => {
    const aOrder = (a.data as EscalationRungData).order;
    const bOrder = (b.data as EscalationRungData).order;
    return aOrder - bOrder;
  });
  const lines = ["### Escalation Ladder"];
  for (let i = 0; i < sorted.length; i++) {
    const e = sorted[i];
    const d = e.data as EscalationRungData;
    const marker = d.climbed ? "✓ Climbed" : "○ Available";
    lines.push(
      `${i + 1}. ${d.action} [${d.reversibility}] ${marker} [Confidence: ${e.confidence}]`,
    );
  }
  return lines.join("\n");
}

const TYPE_RENDERERS: Partial<
  Record<EntityType, (entities: AnalysisEntity[]) => string>
> = {
  fact: renderFacts,
  player: renderPlayers,
  objective: renderObjectives,
  game: renderGames,
  strategy: renderStrategies,
  payoff: renderPayoffs,
  "institutional-rule": renderInstitutionalRules,
  "escalation-rung": renderEscalationLadder,
};

// Stable ordering within a phase
const TYPE_ORDER: EntityType[] = [
  "fact",
  "player",
  "objective",
  "game",
  "strategy",
  "payoff",
  "institutional-rule",
  "escalation-rung",
];

// ── Relationships ──

function renderRelationships(
  relationships: AnalysisRelationship[],
  entityMap: Map<string, AnalysisEntity>,
): string {
  if (relationships.length === 0) return "";

  const lines = ["## Relationships", ""];
  for (const r of relationships) {
    const from = entityMap.get(r.fromEntityId);
    const to = entityMap.get(r.toEntityId);
    const fromLabel = from ? entityLabel(from) : r.fromEntityId;
    const toLabel = to ? entityLabel(to) : r.toEntityId;
    lines.push(`- ${fromLabel} **${r.type}** ${toLabel}`);
  }
  return lines.join("\n");
}

function entityLabel(e: AnalysisEntity): string {
  const d = e.data;
  if ("name" in d && typeof d.name === "string") return d.name;
  if ("action" in d && typeof d.action === "string") return d.action;
  if ("content" in d && typeof d.content === "string") {
    const snippet = d.content.slice(0, 40);
    return snippet.length < d.content.length ? `${snippet}...` : snippet;
  }
  if ("description" in d && typeof d.description === "string")
    return d.description.slice(0, 40);
  return e.id;
}

// ── Main export ──

export function exportToMarkdown(analysis: EntityAnalysis): string {
  if (analysis.entities.length === 0) {
    return "# Game Theory Analysis\n\nNo entities. Run an analysis first.";
  }

  const sections: string[] = [];

  // Header
  sections.push(`# Game Theory Analysis: ${analysis.name}`);
  sections.push(`\n**Topic:** ${analysis.topic}`);

  // Build entity map for relationship labels
  const entityMap = new Map<string, AnalysisEntity>();
  for (const e of analysis.entities) entityMap.set(e.id, e);

  // Group entities by phase, then type
  const phaseGroups = groupByPhaseAndType(analysis.entities);

  // Render phases in methodology order
  for (const phase of ALL_PHASES) {
    const group = phaseGroups.get(phase);
    if (!group) continue;

    const num = PHASE_NUMBERS[phase];
    const label = PHASE_LABELS[phase];
    sections.push(`\n## Phase ${num}: ${label}`);

    for (const entityType of TYPE_ORDER) {
      const entities = group.get(entityType);
      if (!entities || entities.length === 0) continue;
      const renderer = TYPE_RENDERERS[entityType];
      if (renderer) {
        sections.push(`\n${renderer(entities)}`);
      }
    }
  }

  // Relationships
  if (analysis.relationships.length > 0) {
    sections.push(
      `\n${renderRelationships(analysis.relationships, entityMap)}`,
    );
  }

  return sections.join("\n");
}
