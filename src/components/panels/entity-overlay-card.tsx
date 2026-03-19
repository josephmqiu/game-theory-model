import { useEffect, useRef, useState, useCallback } from "react";
import { Pencil, ShieldQuestion, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PHASE_LABELS, PHASE_NUMBERS } from "@/types/methodology";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import * as analysisClient from "@/services/ai/analysis-client";
import type {
  AnalysisEntity,
  EntityType,
  EntityData,
  EntityConfidence,
  EntitySource,
  FactData,
  PlayerData,
  ObjectiveData,
  GameData,
  StrategyData,
  PayoffData,
  InstitutionalRuleData,
  EscalationRungData,
} from "@/types/entity";

// ── Props ──

export interface EntityOverlayCardProps {
  entity: AnalysisEntity;
  screenPosition: { x: number; y: number };
  onEdit: (entity: AnalysisEntity) => void;
  onChallenge: (entity: AnalysisEntity) => void;
  onClose: () => void;
}

// ── Entity type palette (from DESIGN.md) ──

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
  objective: "Objective",
  game: "Game",
  strategy: "Strategy",
  payoff: "Payoff",
  "institutional-rule": "Rule",
  "escalation-rung": "Escalation",
};

// ── Confidence dot colors ──

const CONFIDENCE_DOT: Record<EntityConfidence, string> = {
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

const CONFIDENCE_LABELS: Record<EntityConfidence, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

// ── Source labels ──

const SOURCE_LABELS: Record<EntitySource, string> = {
  ai: "AI",
  human: "Human",
  computed: "Computed",
};

// ── Entity name extraction ──

function getEntityName(entity: AnalysisEntity): string {
  const d = entity.data;
  switch (d.type) {
    case "fact":
      return d.content.length > 60
        ? d.content.slice(0, 60) + "\u2026"
        : d.content;
    case "player":
      return d.name;
    case "objective":
      return d.description.length > 60
        ? d.description.slice(0, 60) + "\u2026"
        : d.description;
    case "game":
      return d.name;
    case "strategy":
      return d.name;
    case "payoff":
      return d.rationale.length > 60
        ? d.rationale.slice(0, 60) + "\u2026"
        : d.rationale || "Payoff";
    case "institutional-rule":
      return d.name;
    case "escalation-rung":
      return d.action;
  }
}

// ── Type-specific detail renderers ──

function FactDetails({ data }: { data: FactData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Date" value={data.date} />
      <DetailRow label="Source" value={data.source} />
      <DetailRow label="Category" value={data.category} />
      <DetailRow label="Content" value={data.content} />
    </dl>
  );
}

function PlayerDetails({ data }: { data: PlayerData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Type" value={data.playerType} />
      {data.knowledge.length > 0 && (
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            Knowledge
          </dt>
          <dd className="mt-0.5">
            <ul className="list-disc pl-4 space-y-0.5">
              {data.knowledge.map((k, i) => (
                <li key={i} className="text-[13px] text-zinc-300">
                  {k}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

function ObjectiveDetails({ data }: { data: ObjectiveData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Description" value={data.description} />
      <DetailRow label="Priority" value={data.priority} />
      <DetailRow label="Stability" value={data.stability} />
    </dl>
  );
}

function GameDetails({ data }: { data: GameData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Game type" value={data.gameType} />
      <DetailRow label="Timing" value={data.timing} />
      {data.description && (
        <DetailRow label="Description" value={data.description} />
      )}
    </dl>
  );
}

function StrategyDetails({ data }: { data: StrategyData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Feasibility" value={data.feasibility} />
      {data.description && (
        <DetailRow label="Description" value={data.description} />
      )}
    </dl>
  );
}

function PayoffDetails({ data }: { data: PayoffData }) {
  return (
    <dl className="space-y-1.5">
      {data.rank != null && (
        <DetailRow label="Rank" value={String(data.rank)} />
      )}
      {data.value != null && (
        <DetailRow label="Value" value={String(data.value)} />
      )}
      {data.rationale && <DetailRow label="Rationale" value={data.rationale} />}
    </dl>
  );
}

function InstitutionalRuleDetails({ data }: { data: InstitutionalRuleData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Rule type" value={data.ruleType} />
      <DetailRow label="Effect" value={data.effectOnStrategies} />
    </dl>
  );
}

function EscalationRungDetails({ data }: { data: EscalationRungData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Action" value={data.action} />
      <DetailRow label="Reversibility" value={data.reversibility} />
      <DetailRow label="Order" value={String(data.order)} />
      <DetailRow label="Climbed" value={data.climbed ? "Yes" : "No"} />
    </dl>
  );
}

// ── Edit-mode field input ──

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-[13px] text-zinc-200 outline-none focus:border-zinc-500"
      />
    </div>
  );
}

// ── Editable data sections per entity type ──

function EditableEntityData({
  data,
  onChange,
}: {
  data: EntityData;
  onChange: (updated: EntityData) => void;
}) {
  const set = (field: string, value: string | number | boolean) =>
    onChange({ ...data, [field]: value } as EntityData);

  switch (data.type) {
    case "fact":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Content"
            value={data.content}
            onChange={(v) => set("content", v)}
          />
          <EditField
            label="Date"
            value={data.date}
            onChange={(v) => set("date", v)}
          />
          <EditField
            label="Source"
            value={data.source}
            onChange={(v) => set("source", v)}
          />
        </div>
      );
    case "player":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Name"
            value={data.name}
            onChange={(v) => set("name", v)}
          />
          <EditField
            label="Type"
            value={data.playerType}
            onChange={(v) => set("playerType", v)}
          />
        </div>
      );
    case "objective":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
          <EditField
            label="Priority"
            value={data.priority}
            onChange={(v) => set("priority", v)}
          />
        </div>
      );
    case "game":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Name"
            value={data.name}
            onChange={(v) => set("name", v)}
          />
          <EditField
            label="Game type"
            value={data.gameType}
            onChange={(v) => set("gameType", v)}
          />
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
        </div>
      );
    case "strategy":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Name"
            value={data.name}
            onChange={(v) => set("name", v)}
          />
          <EditField
            label="Feasibility"
            value={data.feasibility}
            onChange={(v) => set("feasibility", v)}
          />
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
        </div>
      );
    case "payoff":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Value"
            value={data.value != null ? String(data.value) : ""}
            onChange={(v) =>
              set("value", v === "" ? (null as unknown as number) : Number(v))
            }
            type="number"
          />
          <EditField
            label="Rationale"
            value={data.rationale}
            onChange={(v) => set("rationale", v)}
          />
        </div>
      );
    case "institutional-rule":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Name"
            value={data.name}
            onChange={(v) => set("name", v)}
          />
          <EditField
            label="Rule type"
            value={data.ruleType}
            onChange={(v) => set("ruleType", v)}
          />
          <EditField
            label="Effect"
            value={data.effectOnStrategies}
            onChange={(v) => set("effectOnStrategies", v)}
          />
        </div>
      );
    case "escalation-rung":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Action"
            value={data.action}
            onChange={(v) => set("action", v)}
          />
          <EditField
            label="Reversibility"
            value={data.reversibility}
            onChange={(v) => set("reversibility", v)}
          />
          <EditField
            label="Order"
            value={String(data.order)}
            onChange={(v) => set("order", Number(v))}
            type="number"
          />
        </div>
      );
  }
}

function EntityDataSection({ entity }: { entity: AnalysisEntity }) {
  switch (entity.data.type) {
    case "fact":
      return <FactDetails data={entity.data} />;
    case "player":
      return <PlayerDetails data={entity.data} />;
    case "objective":
      return <ObjectiveDetails data={entity.data} />;
    case "game":
      return <GameDetails data={entity.data} />;
    case "strategy":
      return <StrategyDetails data={entity.data} />;
    case "payoff":
      return <PayoffDetails data={entity.data} />;
    case "institutional-rule":
      return <InstitutionalRuleDetails data={entity.data} />;
    case "escalation-rung":
      return <EscalationRungDetails data={entity.data} />;
  }
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        {label}
      </dt>
      <dd className="text-[13px] text-zinc-300">{value}</dd>
    </div>
  );
}

// ── Badge components ──

function TypeBadge({ type }: { type: EntityType }) {
  const color = ENTITY_TYPE_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
      style={{ color, backgroundColor: `${color}26` }}
    >
      {ENTITY_TYPE_LABELS[type]}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: EntityConfidence }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", CONFIDENCE_DOT[confidence])}
      />
      {CONFIDENCE_LABELS[confidence]}
    </span>
  );
}

function SourceBadge({ source }: { source: EntitySource }) {
  return (
    <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
      {SOURCE_LABELS[source]}
    </span>
  );
}

function PhaseBadge({ phase }: { phase: AnalysisEntity["phase"] }) {
  const num = PHASE_NUMBERS[phase];
  const label = PHASE_LABELS[phase];
  return (
    <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
      Phase {num}: {label}
    </span>
  );
}

// ── Main component ──

export default function EntityOverlayCard({
  entity,
  screenPosition,
  onEdit,
  onChallenge,
  onClose,
}: EntityOverlayCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<EntityData>(entity.data);
  const [editRationale, setEditRationale] = useState(entity.rationale);

  // Reset edit state when the entity prop changes
  useEffect(() => {
    setEditData(entity.data);
    setEditRationale(entity.rationale);
    setEditing(false);
  }, [entity.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Dismiss on Escape (cancel edit if editing, otherwise close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (editing) {
          setEditing(false);
          setEditData(entity.data);
          setEditRationale(entity.rationale);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, editing, entity.data, entity.rationale]);

  // Click-away dismissal (disabled while editing to prevent accidental loss)
  useEffect(() => {
    if (editing) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay listener to avoid the opening click triggering immediate close
    const timer = setTimeout(() => {
      document.addEventListener("pointerdown", handlePointerDown);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [onClose, editing]);

  const handleSave = useCallback(() => {
    const updates = {
      data: editData,
      rationale: editRationale,
      source: "human" as const,
      revision: entity.revision + 1,
    };

    if (analysisClient.isRunning()) {
      // During active analysis, route edit through the server endpoint
      // which handles queueing and stale propagation server-side.
      void analysisClient.updateEntity(entity.id, updates);
    } else {
      // No analysis running — apply locally
      useEntityGraphStore.getState().updateEntity(entity.id, updates);
    }

    setEditing(false);
    onEdit(entity);
  }, [entity, editData, editRationale, onEdit]);

  const handleCancel = useCallback(() => {
    setEditData(entity.data);
    setEditRationale(entity.rationale);
    setEditing(false);
  }, [entity.data, entity.rationale]);

  // Position: right of node by default, flip left if near right edge
  const viewportWidth =
    typeof window !== "undefined" ? window.innerWidth : 1920;
  const cardMaxWidth = 360;
  const nodeOffset = 16;
  const flipToLeft =
    screenPosition.x + cardMaxWidth + nodeOffset > viewportWidth;

  const style: React.CSSProperties = {
    position: "fixed",
    top: screenPosition.y,
    ...(flipToLeft
      ? { right: viewportWidth - screenPosition.x + nodeOffset }
      : { left: screenPosition.x + nodeOffset }),
    maxWidth: cardMaxWidth,
    maxHeight: 480,
    zIndex: 60,
  };

  const name = getEntityName(entity);

  return (
    <div
      ref={cardRef}
      className="overflow-y-auto rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
      style={style}
    >
      <div className="space-y-3 p-3">
        {/* Header badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TypeBadge type={entity.type} />
          <ConfidenceBadge confidence={entity.confidence} />
          <SourceBadge source={entity.source} />
        </div>

        {/* Entity name */}
        <h2
          className="text-lg font-bold leading-snug text-zinc-100"
          style={{ fontFamily: "Satoshi, sans-serif" }}
        >
          {name}
        </h2>

        {/* Phase badge */}
        <PhaseBadge phase={entity.phase} />

        {/* Type-specific data — editable or read-only */}
        <div className="border-t border-zinc-800 pt-2">
          {editing ? (
            <EditableEntityData data={editData} onChange={setEditData} />
          ) : (
            <EntityDataSection entity={entity} />
          )}
        </div>

        {/* Rationale */}
        {editing ? (
          <div className="border-t border-zinc-800 pt-2">
            <EditField
              label="Rationale"
              value={editRationale}
              onChange={setEditRationale}
            />
          </div>
        ) : (
          entity.rationale && (
            <div className="border-t border-zinc-800 pt-2">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                Rationale
              </dt>
              <dd className="mt-0.5 text-[13px] leading-relaxed text-zinc-300">
                {entity.rationale}
              </dd>
            </div>
          )
        )}

        {/* Stale indicator */}
        {entity.stale && (
          <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-400">
            Needs revalidation
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 border-t border-zinc-800 px-3 py-2">
        {editing ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              <Check size={12} />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <X size={12} />
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <Pencil size={12} />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChallenge(entity)}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <ShieldQuestion size={12} />
              Challenge
            </Button>
          </>
        )}
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-100"
          >
            <X size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
