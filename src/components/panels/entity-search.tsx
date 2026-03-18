import { useMemo } from "react";
import { Search } from "lucide-react";
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
  }
}

// ── Component ──

export default function EntitySearch({
  query,
  typeFilter,
  onSelectEntity,
}: EntitySearchProps) {
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
        <p className="text-[13px] text-zinc-500">No matching entities</p>
        {query && (
          <p className="text-[11px] text-zinc-600">
            Try a different search term or remove the type filter.
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
