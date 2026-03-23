import { useEffect, useRef, useState, useCallback } from "react";
import { Pencil, ShieldQuestion, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
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
  InteractionHistoryData,
  RepeatedGamePatternData,
  TrustAssessmentData,
  DynamicInconsistencyData,
  SignalingEffectData,
  PayoffMatrixData,
  GameTreeData,
  EquilibriumResultData,
  CrossGameConstraintTableData,
  CrossGameEffectData,
  SignalClassificationData,
  BargainingDynamicsData,
  OptionValueAssessmentData,
  BehavioralOverlayData,
  AssumptionData,
  EliminatedOutcomeData,
  ScenarioData,
  CentralThesisData,
  MetaCheckData,
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
  "analysis-report": "#A78BFA",
};

const ENTITY_TYPE_I18N_KEYS: Record<EntityType, string> = {
  fact: "analysis.entities.fact",
  player: "analysis.entities.player",
  objective: "analysis.entities.objective",
  game: "analysis.entities.game",
  strategy: "analysis.entities.strategy",
  payoff: "analysis.entities.payoff",
  "institutional-rule": "analysis.entities.rule",
  "escalation-rung": "analysis.entities.escalation",
  "interaction-history": "analysis.entities.history",
  "repeated-game-pattern": "analysis.entities.pattern",
  "trust-assessment": "analysis.entities.trust",
  "dynamic-inconsistency": "analysis.entities.commitment",
  "signaling-effect": "analysis.entities.signal",
  "payoff-matrix": "analysis.entities.matrix",
  "game-tree": "analysis.entities.gameTree",
  "equilibrium-result": "analysis.entities.equilibrium",
  "cross-game-constraint-table": "analysis.entities.constraints",
  "cross-game-effect": "analysis.entities.crossGame",
  "signal-classification": "analysis.entities.signalClass",
  "bargaining-dynamics": "analysis.entities.bargaining",
  "option-value-assessment": "analysis.entities.optionValue",
  "behavioral-overlay": "analysis.entities.behavioral",
  assumption: "analysis.entities.assumption",
  "eliminated-outcome": "analysis.entities.eliminated",
  scenario: "analysis.entities.scenario",
  "central-thesis": "analysis.entities.thesis",
  "meta-check": "analysis.entities.metaCheck",
  "analysis-report": "analysis.entities.analysisReport",
};

// ── Confidence dot colors ──

const CONFIDENCE_DOT: Record<EntityConfidence, string> = {
  high: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-red-400",
};

const CONFIDENCE_I18N_KEYS: Record<EntityConfidence, string> = {
  high: "analysis.entities.confidence.high",
  medium: "analysis.entities.confidence.medium",
  low: "analysis.entities.confidence.low",
};

// ── Source labels ──

const SOURCE_I18N_KEYS: Record<EntitySource, string> = {
  ai: "analysis.entities.source.ai",
  human: "analysis.entities.source.human",
  computed: "analysis.entities.source.computed",
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
    case "interaction-history":
      return d.playerPair.join(" \u2194 ");
    case "repeated-game-pattern":
      return d.description.length > 60
        ? d.description.slice(0, 60) + "\u2026"
        : d.description;
    case "trust-assessment":
      return `${d.playerPair[0]} \u2192 ${d.playerPair[1]}`;
    case "dynamic-inconsistency":
      return d.commitment.length > 60
        ? d.commitment.slice(0, 60) + "\u2026"
        : d.commitment;
    case "signaling-effect":
      return d.signal.length > 60 ? d.signal.slice(0, 60) + "\u2026" : d.signal;
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
      return d.action.length > 60 ? d.action.slice(0, 60) + "\u2026" : d.action;
    case "bargaining-dynamics":
      return d.negotiation.length > 60
        ? d.negotiation.slice(0, 60) + "\u2026"
        : d.negotiation;
    case "option-value-assessment":
      return d.action.length > 60 ? d.action.slice(0, 60) + "\u2026" : d.action;
    case "behavioral-overlay":
      return d.description.length > 60
        ? d.description.slice(0, 60) + "\u2026"
        : d.description;
    case "assumption":
      return d.description.length > 60
        ? d.description.slice(0, 60) + "\u2026"
        : d.description;
    case "eliminated-outcome":
      return d.description.length > 60
        ? d.description.slice(0, 60) + "\u2026"
        : d.description;
    case "scenario":
      return d.narrative.length > 60
        ? d.narrative.slice(0, 60) + "\u2026"
        : d.narrative;
    case "central-thesis":
      return d.thesis.length > 60 ? d.thesis.slice(0, 60) + "\u2026" : d.thesis;
    case "meta-check":
      return `Meta-Check (${d.questions.filter((q) => q.disruption_trigger_identified).length} triggers)`;
    case "analysis-report":
      return d.executive_summary.length > 60
        ? d.executive_summary.slice(0, 60) + "\u2026"
        : d.executive_summary;
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

function InteractionHistoryDetails({ data }: { data: InteractionHistoryData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Timespan" value={data.timespan} />
      <DetailRow label="Players" value={data.playerPair.join(" \u2194 ")} />
    </dl>
  );
}

function RepeatedGamePatternDetails({
  data,
}: {
  data: RepeatedGamePatternData;
}) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Pattern" value={data.patternType} />
      <DetailRow label="Description" value={data.description} />
      <DetailRow label="Evidence" value={data.evidence} />
    </dl>
  );
}

function TrustAssessmentDetails({ data }: { data: TrustAssessmentData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Trust level" value={data.trustLevel} />
      <DetailRow label="Direction" value={data.direction} />
      <DetailRow label="Evidence" value={data.evidence} />
    </dl>
  );
}

function DynamicInconsistencyDetails({
  data,
}: {
  data: DynamicInconsistencyData;
}) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Commitment" value={data.commitment} />
      <DetailRow label="Institutional form" value={data.institutionalForm} />
      <DetailRow label="Durability" value={data.durability} />
    </dl>
  );
}

function SignalingEffectDetails({ data }: { data: SignalingEffectData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Signal" value={data.signal} />
      <DetailRow label="Observers" value={data.observers.join(", ")} />
      <DetailRow label="Lesson" value={data.lesson} />
    </dl>
  );
}

function PayoffMatrixDetails({ data }: { data: PayoffMatrixData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Game" value={data.gameName} />
      <DetailRow label="Players" value={data.players.join(" vs ")} />
      <DetailRow
        label="Row strategies"
        value={data.strategies.row.join(", ")}
      />
      <DetailRow
        label="Column strategies"
        value={data.strategies.column.join(", ")}
      />
      <DetailRow label="Cells" value={`${data.cells.length} outcomes`} />
    </dl>
  );
}

function GameTreeDetails({ data }: { data: GameTreeData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Game" value={data.gameName} />
      <DetailRow label="Nodes" value={String(data.nodes.length)} />
      <DetailRow label="Branches" value={String(data.branches.length)} />
      <DetailRow
        label="Information sets"
        value={String(data.informationSets.length)}
      />
    </dl>
  );
}

function EquilibriumResultDetails({ data }: { data: EquilibriumResultData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Game" value={data.gameName} />
      <DetailRow label="Type" value={data.equilibriumType} />
      <DetailRow label="Description" value={data.description} />
      {data.strategies.length > 0 && (
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            Strategies
          </dt>
          <dd className="mt-0.5">
            <ul className="list-disc pl-4 space-y-0.5">
              {data.strategies.map((s, i) => (
                <li key={i} className="text-[13px] text-zinc-300">
                  {s.player}: {s.strategy}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

function CrossGameConstraintTableDetails({
  data,
}: {
  data: CrossGameConstraintTableData;
}) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Strategies" value={data.strategies.join(", ")} />
      <DetailRow label="Games" value={data.games.join(", ")} />
      <DetailRow label="Cells" value={`${data.cells.length} entries`} />
    </dl>
  );
}

function CrossGameEffectDetails({ data }: { data: CrossGameEffectData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Source" value={data.sourceGame} />
      <DetailRow label="Target" value={data.targetGame} />
      <DetailRow label="Effect type" value={data.effectType} />
      <DetailRow label="Trigger" value={data.trigger} />
      <DetailRow label="Cascade" value={data.cascade ? "Yes" : "No"} />
    </dl>
  );
}

function SignalClassificationDetails({
  data,
}: {
  data: SignalClassificationData;
}) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Action" value={data.action} />
      <DetailRow label="Player" value={data.player} />
      <DetailRow label="Classification" value={data.classification} />
      <DetailRow label="Credibility" value={data.credibility} />
    </dl>
  );
}

function BargainingDynamicsDetails({ data }: { data: BargainingDynamicsData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Negotiation" value={data.negotiation} />
      <DetailRow
        label="Outside options"
        value={`${data.outsideOptions.length} players`}
      />
      <DetailRow label="Deadlines" value={`${data.deadlines.length}`} />
      {data.commitmentProblems.length > 0 && (
        <DetailRow
          label="Commitment problems"
          value={data.commitmentProblems.join("; ")}
        />
      )}
    </dl>
  );
}

function OptionValueAssessmentDetails({
  data,
}: {
  data: OptionValueAssessmentData;
}) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Player" value={data.player} />
      <DetailRow label="Action" value={data.action} />
      <DetailRow label="Uncertainty" value={data.uncertaintyLevel} />
      {data.flexibilityPreserved.length > 0 && (
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            Flexibility preserved
          </dt>
          <dd className="mt-0.5">
            <ul className="list-disc pl-4 space-y-0.5">
              {data.flexibilityPreserved.map((f, i) => (
                <li key={i} className="text-[13px] text-zinc-300">
                  {f.type}: {f.description}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
    </dl>
  );
}

function BehavioralOverlayDetails({ data }: { data: BehavioralOverlayData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Overlay type" value={data.overlayType} />
      <DetailRow label="Classification" value={data.classification} />
      <DetailRow label="Description" value={data.description} />
      <DetailRow
        label="Affected players"
        value={data.affectedPlayers.join(", ")}
      />
      {data.referencePoint && (
        <DetailRow label="Reference point" value={data.referencePoint} />
      )}
      <DetailRow
        label="Prediction modification"
        value={data.predictionModification}
      />
    </dl>
  );
}

function AssumptionDetails({ data }: { data: AssumptionData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Description" value={data.description} />
      <DetailRow label="Sensitivity" value={data.sensitivity} />
      <DetailRow label="Category" value={data.category} />
      <DetailRow label="Classification" value={data.classification} />
    </dl>
  );
}

function EliminatedOutcomeDetails({ data }: { data: EliminatedOutcomeData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Description" value={data.description} />
      <DetailRow label="Reasoning" value={data.traced_reasoning} />
      <DetailRow label="Source Phase" value={data.source_phase} />
    </dl>
  );
}

function ScenarioDetails({ data }: { data: ScenarioData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Subtype" value={data.subtype} />
      <DetailRow label="Narrative" value={data.narrative} />
      <DetailRow
        label="Probability"
        value={`${data.probability.point}% (${data.probability.rangeLow}-${data.probability.rangeHigh}%)`}
      />
      <DetailRow label="Prediction Basis" value={data.prediction_basis} />
      <DetailRow label="Invalidation" value={data.invalidation_conditions} />
      {data.trigger && <DetailRow label="Trigger" value={data.trigger} />}
    </dl>
  );
}

function CentralThesisDetails({ data }: { data: CentralThesisData }) {
  return (
    <dl className="space-y-1.5">
      <DetailRow label="Thesis" value={data.thesis} />
      <DetailRow label="Falsification" value={data.falsification_conditions} />
    </dl>
  );
}

function MetaCheckDetails({ data }: { data: MetaCheckData }) {
  return (
    <dl className="space-y-1.5">
      {data.questions.map((q) => (
        <div key={q.question_number}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            Q{q.question_number}
            {q.disruption_trigger_identified && (
              <span className="ml-1 text-orange-400">[TRIGGER]</span>
            )}
          </dt>
          <dd className="text-[13px] text-zinc-300">{q.answer}</dd>
        </div>
      ))}
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
    case "interaction-history":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Timespan"
            value={data.timespan}
            onChange={(v) => set("timespan", v)}
          />
        </div>
      );
    case "repeated-game-pattern":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
          <EditField
            label="Evidence"
            value={data.evidence}
            onChange={(v) => set("evidence", v)}
          />
        </div>
      );
    case "trust-assessment":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Direction"
            value={data.direction}
            onChange={(v) => set("direction", v)}
          />
          <EditField
            label="Evidence"
            value={data.evidence}
            onChange={(v) => set("evidence", v)}
          />
        </div>
      );
    case "dynamic-inconsistency":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Commitment"
            value={data.commitment}
            onChange={(v) => set("commitment", v)}
          />
        </div>
      );
    case "signaling-effect":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Signal"
            value={data.signal}
            onChange={(v) => set("signal", v)}
          />
          <EditField
            label="Lesson"
            value={data.lesson}
            onChange={(v) => set("lesson", v)}
          />
        </div>
      );
    case "payoff-matrix":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Game name"
            value={data.gameName}
            onChange={(v) => set("gameName", v)}
          />
        </div>
      );
    case "game-tree":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Game name"
            value={data.gameName}
            onChange={(v) => set("gameName", v)}
          />
        </div>
      );
    case "equilibrium-result":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Game name"
            value={data.gameName}
            onChange={(v) => set("gameName", v)}
          />
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
        </div>
      );
    case "cross-game-constraint-table":
      return (
        <div className="space-y-1.5">
          <p className="text-[11px] text-zinc-500">
            Composite entity — edit via AI reanalysis
          </p>
        </div>
      );
    case "cross-game-effect":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Trigger"
            value={data.trigger}
            onChange={(v) => set("trigger", v)}
          />
        </div>
      );
    case "signal-classification":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Action"
            value={data.action}
            onChange={(v) => set("action", v)}
          />
        </div>
      );
    case "bargaining-dynamics":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Negotiation"
            value={data.negotiation}
            onChange={(v) => set("negotiation", v)}
          />
        </div>
      );
    case "option-value-assessment":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Action"
            value={data.action}
            onChange={(v) => set("action", v)}
          />
        </div>
      );
    case "behavioral-overlay":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
        </div>
      );
    case "assumption":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
          <EditField
            label="Rationale"
            value={data.rationale}
            onChange={(v) => set("rationale", v)}
          />
        </div>
      );
    case "eliminated-outcome":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Description"
            value={data.description}
            onChange={(v) => set("description", v)}
          />
          <EditField
            label="Reasoning"
            value={data.traced_reasoning}
            onChange={(v) => set("traced_reasoning", v)}
          />
        </div>
      );
    case "scenario":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Narrative"
            value={data.narrative}
            onChange={(v) => set("narrative", v)}
          />
          <EditField
            label="Invalidation"
            value={data.invalidation_conditions}
            onChange={(v) => set("invalidation_conditions", v)}
          />
        </div>
      );
    case "central-thesis":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Thesis"
            value={data.thesis}
            onChange={(v) => set("thesis", v)}
          />
          <EditField
            label="Falsification"
            value={data.falsification_conditions}
            onChange={(v) => set("falsification_conditions", v)}
          />
        </div>
      );
    case "meta-check":
      return null;
    case "analysis-report":
      return null; // not implemented — Task 4
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
    case "interaction-history":
      return <InteractionHistoryDetails data={entity.data} />;
    case "repeated-game-pattern":
      return <RepeatedGamePatternDetails data={entity.data} />;
    case "trust-assessment":
      return <TrustAssessmentDetails data={entity.data} />;
    case "dynamic-inconsistency":
      return <DynamicInconsistencyDetails data={entity.data} />;
    case "signaling-effect":
      return <SignalingEffectDetails data={entity.data} />;
    case "payoff-matrix":
      return <PayoffMatrixDetails data={entity.data} />;
    case "game-tree":
      return <GameTreeDetails data={entity.data} />;
    case "equilibrium-result":
      return <EquilibriumResultDetails data={entity.data} />;
    case "cross-game-constraint-table":
      return <CrossGameConstraintTableDetails data={entity.data} />;
    case "cross-game-effect":
      return <CrossGameEffectDetails data={entity.data} />;
    case "signal-classification":
      return <SignalClassificationDetails data={entity.data} />;
    case "bargaining-dynamics":
      return <BargainingDynamicsDetails data={entity.data} />;
    case "option-value-assessment":
      return <OptionValueAssessmentDetails data={entity.data} />;
    case "behavioral-overlay":
      return <BehavioralOverlayDetails data={entity.data} />;
    case "assumption":
      return <AssumptionDetails data={entity.data} />;
    case "eliminated-outcome":
      return <EliminatedOutcomeDetails data={entity.data} />;
    case "scenario":
      return <ScenarioDetails data={entity.data} />;
    case "central-thesis":
      return <CentralThesisDetails data={entity.data} />;
    case "meta-check":
      return <MetaCheckDetails data={entity.data} />;
    case "analysis-report":
      return null; // not implemented — Task 4
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
  const { t } = useTranslation();
  const color = ENTITY_TYPE_COLORS[type];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]"
      style={{ color, backgroundColor: `${color}26` }}
    >
      {t(ENTITY_TYPE_I18N_KEYS[type])}
    </span>
  );
}

function ConfidenceBadge({ confidence }: { confidence: EntityConfidence }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400">
      <span
        className={cn("h-1.5 w-1.5 rounded-full", CONFIDENCE_DOT[confidence])}
      />
      {t(CONFIDENCE_I18N_KEYS[confidence])}
    </span>
  );
}

function SourceBadge({ source }: { source: EntitySource }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
      {t(SOURCE_I18N_KEYS[source])}
    </span>
  );
}

const PHASE_I18N_KEYS: Record<string, string> = {
  "situational-grounding": "analysis.phases.situationalGrounding",
  "player-identification": "analysis.phases.playerIdentification",
  "baseline-model": "analysis.phases.baselineModel",
  "historical-game": "analysis.phases.historicalGame",
  revalidation: "analysis.phases.revalidation",
  "formal-modeling": "analysis.phases.formalModeling",
  assumptions: "analysis.phases.assumptions",
  elimination: "analysis.phases.elimination",
  scenarios: "analysis.phases.scenarios",
  "meta-check": "analysis.phases.metaCheck",
};

function PhaseBadge({ phase }: { phase: AnalysisEntity["phase"] }) {
  const { t } = useTranslation();
  const num = PHASE_NUMBERS[phase];
  const label = PHASE_I18N_KEYS[phase]
    ? t(PHASE_I18N_KEYS[phase])
    : PHASE_LABELS[phase];
  return (
    <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-400">
      {t("analysis.progress.phaseLabel", { number: num, name: label })}
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

  // Reset edit state when the entity prop changes (id or data)
  useEffect(() => {
    setEditData(entity.data);
    setEditRationale(entity.rationale);
    setEditing(false);
  }, [entity.id, entity.data, entity.rationale]);

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
