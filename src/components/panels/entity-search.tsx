import { useMemo } from "react";
import { Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { PHASE_NUMBERS } from "@/types/methodology";
import type { AnalysisEntity, EntityType } from "@/types/entity";

// ── Props ──

export interface EntitySearchProps {
  query: string;
  typeFilter: EntityType | null;
  onSelectEntity: (entityId: string) => void;
}

// ── Entity type display ──

const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  fact: "#94A3B8",
  player: "#60A5FA",
  objective: "#60A5FA",
  game: "#FBBF24",
  strategy: "#34D399",
  payoff: "#FCD34D",
  "institutional-rule": "#A1A1AA",
  "escalation-rung": "#4ADE80",
  "interaction-history": "#818CF8",
  "repeated-game-pattern": "#C084FC",
  "trust-assessment": "#2DD4BF",
  "dynamic-inconsistency": "#FB923C",
  "signaling-effect": "#F472B6",
  "payoff-matrix": "#FBBF24",
  "game-tree": "#FBBF24",
  "equilibrium-result": "#F59E0B",
  "cross-game-constraint-table": "#FB923C",
  "cross-game-effect": "#FB923C",
  "signal-classification": "#F472B6",
  "bargaining-dynamics": "#818CF8",
  "option-value-assessment": "#2DD4BF",
  "behavioral-overlay": "#C084FC",
  assumption: "#E879F9",
  "eliminated-outcome": "#EF4444",
  scenario: "#22D3EE",
  "central-thesis": "#A78BFA",
  "meta-check": "#F97316",
};

const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  fact: "Fact",
  player: "Player",
  objective: "Obj",
  game: "Game",
  strategy: "Strat",
  payoff: "Payoff",
  "institutional-rule": "Rule",
  "escalation-rung": "Esc",
  "interaction-history": "Hist",
  "repeated-game-pattern": "Pat",
  "trust-assessment": "Trust",
  "dynamic-inconsistency": "Commit",
  "signaling-effect": "Sig",
  "payoff-matrix": "Matrix",
  "game-tree": "Tree",
  "equilibrium-result": "Equil",
  "cross-game-constraint-table": "Constr",
  "cross-game-effect": "X-Game",
  "signal-classification": "SigCls",
  "bargaining-dynamics": "Barg",
  "option-value-assessment": "OptVal",
  "behavioral-overlay": "Behav",
  assumption: "Asmp",
  "eliminated-outcome": "Elim",
  scenario: "Scen",
  "central-thesis": "Thesis",
  "meta-check": "Check",
};

// ── Helpers ──

/** Extract searchable text from entity data */
function getSearchableText(entity: AnalysisEntity): string {
  const d = entity.data;
  switch (d.type) {
    case "fact":
      return `${d.content} ${d.source} ${d.category}`;
    case "player":
      return `${d.name} ${d.playerType} ${d.knowledge.join(" ")}`;
    case "objective":
      return `${d.description} ${d.priority}`;
    case "game":
      return `${d.name} ${d.gameType} ${d.description}`;
    case "strategy":
      return `${d.name} ${d.feasibility} ${d.description}`;
    case "payoff":
      return d.rationale;
    case "institutional-rule":
      return `${d.name} ${d.ruleType} ${d.effectOnStrategies}`;
    case "escalation-rung":
      return `${d.action} ${d.reversibility}`;
    case "interaction-history":
      return `${d.playerPair.join(" ")} ${d.timespan}`;
    case "repeated-game-pattern":
      return `${d.patternType} ${d.description} ${d.evidence}`;
    case "trust-assessment":
      return `${d.playerPair.join(" ")} ${d.trustLevel} ${d.direction} ${d.evidence}`;
    case "dynamic-inconsistency":
      return `${d.commitment} ${d.institutionalForm} ${d.durability}`;
    case "signaling-effect":
      return `${d.signal} ${d.observers.join(" ")} ${d.lesson}`;
    case "payoff-matrix":
      return `${d.gameName} ${d.players.join(" ")}`;
    case "game-tree":
      return `${d.gameName}`;
    case "equilibrium-result":
      return `${d.gameName} ${d.equilibriumType} ${d.description}`;
    case "cross-game-constraint-table":
      return `${d.strategies.join(" ")} ${d.games.join(" ")}`;
    case "cross-game-effect":
      return `${d.sourceGame} ${d.targetGame} ${d.effectType} ${d.trigger}`;
    case "signal-classification":
      return `${d.action} ${d.player} ${d.classification} ${d.credibility}`;
    case "bargaining-dynamics":
      return `${d.negotiation}`;
    case "option-value-assessment":
      return `${d.player} ${d.action} ${d.uncertaintyLevel}`;
    case "behavioral-overlay":
      return `${d.overlayType} ${d.description} ${d.affectedPlayers.join(" ")}`;
    case "assumption":
      return `${d.description} ${d.sensitivity} ${d.category} ${d.classification}`;
    case "eliminated-outcome":
      return `${d.description} ${d.traced_reasoning} ${d.source_phase}`;
    case "scenario":
      return `${d.narrative} ${d.subtype} ${d.prediction_basis}`;
    case "central-thesis":
      return `${d.thesis} ${d.falsification_conditions}`;
    case "meta-check":
      return d.questions.map((q) => q.answer).join(" ");
  }
}

/** Get the primary display name for an entity */
function getEntityDisplayName(entity: AnalysisEntity): string {
  const d = entity.data;
  switch (d.type) {
    case "fact":
      return d.content.length > 50
        ? d.content.slice(0, 50) + "\u2026"
        : d.content;
    case "player":
      return d.name;
    case "objective":
      return d.description.length > 50
        ? d.description.slice(0, 50) + "\u2026"
        : d.description;
    case "game":
      return d.name;
    case "strategy":
      return d.name;
    case "payoff":
      return d.rationale
        ? d.rationale.length > 50
          ? d.rationale.slice(0, 50) + "\u2026"
          : d.rationale
        : "Payoff";
    case "institutional-rule":
      return d.name;
    case "escalation-rung":
      return d.action;
    case "interaction-history":
      return d.playerPair.join(" \u2194 ");
    case "repeated-game-pattern":
      return d.description.length > 50
        ? d.description.slice(0, 50) + "\u2026"
        : d.description;
    case "trust-assessment":
      return `${d.playerPair[0]} \u2192 ${d.playerPair[1]}`;
    case "dynamic-inconsistency":
      return d.commitment.length > 50
        ? d.commitment.slice(0, 50) + "\u2026"
        : d.commitment;
    case "signaling-effect":
      return d.signal.length > 50 ? d.signal.slice(0, 50) + "\u2026" : d.signal;
    case "payoff-matrix":
      return d.gameName;
    case "game-tree":
      return d.gameName;
    case "equilibrium-result":
      return d.gameName;
    case "cross-game-constraint-table":
      return `${d.games.length} games \u00d7 ${d.strategies.length} strategies`;
    case "cross-game-effect":
      return `${d.sourceGame} \u2192 ${d.targetGame}`;
    case "signal-classification":
      return d.action.length > 50 ? d.action.slice(0, 50) + "\u2026" : d.action;
    case "bargaining-dynamics":
      return d.negotiation.length > 50
        ? d.negotiation.slice(0, 50) + "\u2026"
        : d.negotiation;
    case "option-value-assessment":
      return d.action.length > 50 ? d.action.slice(0, 50) + "\u2026" : d.action;
    case "behavioral-overlay":
      return d.description.length > 50
        ? d.description.slice(0, 50) + "\u2026"
        : d.description;
    case "assumption":
      return d.description.length > 50
        ? d.description.slice(0, 50) + "\u2026"
        : d.description;
    case "eliminated-outcome":
      return d.description.length > 50
        ? d.description.slice(0, 50) + "\u2026"
        : d.description;
    case "scenario":
      return d.narrative.length > 50
        ? d.narrative.slice(0, 50) + "\u2026"
        : d.narrative;
    case "central-thesis":
      return d.thesis.length > 50 ? d.thesis.slice(0, 50) + "\u2026" : d.thesis;
    case "meta-check":
      return `Meta-Check (${d.questions.filter((q) => q.disruption_trigger_identified).length} triggers)`;
  }
}

// ── Component ──

export default function EntitySearch({
  query,
  typeFilter,
  onSelectEntity,
}: EntitySearchProps) {
  const { t } = useTranslation();
  const entities = useEntityGraphStore((s) => s.analysis.entities);

  const results = useMemo(() => {
    const normalizedQuery = query.toLowerCase().trim();

    return entities.filter((entity) => {
      // Type filter
      if (typeFilter && entity.type !== typeFilter) return false;

      // Text match — empty query shows all (filtered by type if set)
      if (!normalizedQuery) return true;

      const text = getSearchableText(entity).toLowerCase();
      return text.includes(normalizedQuery);
    });
  }, [entities, query, typeFilter]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Search size={20} className="text-zinc-600" />
        <p className="text-[13px] text-zinc-500">
          {t("analysis.entities.noMatching")}
        </p>
        {query && (
          <p className="text-[11px] text-zinc-600">
            {t("analysis.entities.searchHint")}
          </p>
        )}
      </div>
    );
  }

  return (
    <ul className="divide-y divide-zinc-800">
      {results.map((entity) => (
        <li key={entity.id}>
          <button
            type="button"
            onClick={() => onSelectEntity(entity.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-800/60"
          >
            {/* Entity type icon dot */}
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ENTITY_TYPE_COLORS[entity.type] }}
            />

            {/* Type label */}
            <span
              className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em]"
              style={{ color: ENTITY_TYPE_COLORS[entity.type] }}
            >
              {ENTITY_TYPE_LABELS[entity.type]}
            </span>

            {/* Entity name */}
            <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-300">
              {getEntityDisplayName(entity)}
            </span>

            {/* Phase badge */}
            <span className="shrink-0 rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
              P{PHASE_NUMBERS[entity.phase]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
