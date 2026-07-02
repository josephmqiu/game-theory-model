import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { Pencil, ShieldQuestion, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { PHASE_LABELS, PHASE_NUMBERS } from "@/types/methodology";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import * as analysisClient from "@/services/ai/analysis-client";
import { useCanvasStore } from "@/stores/canvas-store";
import { AnalysisReportOverlay } from "@/components/panels/analysis-report-overlay";
import { useRunStatusStore } from "@/stores/run-status-store";
import {
  editFormReducer,
  INITIAL_EDIT_STATE,
  isBusy,
  isSubmittable,
  validateEditClientSide,
} from "@/components/panels/entity-edit-state";
import {
  formatDiffField,
  formatDiffValue,
  latestLogNo,
  latestRevalidationEntry,
} from "@/services/entity/revision-peek";
import type {
  AnalysisEntity,
  ChallengeRecord,
  EntityType,
  EntityData,
  EntityConfidence,
  EntitySource,
  FieldDiff,
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
  AnalysisReportData,
} from "@/types/entity";
import { displaySourceForProvenance } from "@/types/entity";
import { entityTypeColor } from "@/constants/design-tokens";
import { ChallengeOutcomeChip } from "@/components/panels/challenge-outcome-chip";

// ── Props ──

export interface EntityOverlayCardProps {
  entity: AnalysisEntity;
  screenPosition: { x: number; y: number };
  onClose: () => void;
}

// ── Entity type palette (single source: design-tokens, decision 5.1A) ──

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
//
// Field anatomy per 1.2A: {label, input, inline error} — errors render
// directly under the input they belong to. Field errors are provided via
// context so every EditField can resolve its own error by name.

const EditErrorsContext = createContext<Record<string, string>>({});

function useFieldError(name?: string): string | undefined {
  const errors = useContext(EditErrorsContext);
  return name ? errors[name] : undefined;
}

function FieldError({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p role="alert" className="mt-0.5 text-[11px] text-red-400">
      {error}
    </p>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
  name,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  /** Field-error key, e.g. "data.content" or "rationale". */
  name?: string;
  multiline?: boolean;
}) {
  const error = useFieldError(name);
  const inputClass = cn(
    "mt-0.5 w-full rounded-sm border bg-zinc-800 px-2 py-1 text-[13px] text-zinc-200 outline-none",
    error ? "border-red-400/70" : "border-zinc-700 focus:border-zinc-500",
  );
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={cn(inputClass, "resize-y")}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
      <FieldError error={error} />
    </div>
  );
}

/** Edits a string[] as one item per line. */
function ListEditField({
  label,
  values,
  onChange,
  name,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  name?: string;
}) {
  const error = useFieldError(name);
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        {label}{" "}
        <span className="font-normal normal-case tracking-normal text-zinc-600">
          (one per line)
        </span>
      </label>
      <textarea
        value={values.join("\n")}
        rows={Math.max(2, Math.min(6, values.length + 1))}
        onChange={(e) =>
          onChange(
            e.target.value
              .split("\n")
              .map((line) => line.trim())
              .filter(Boolean),
          )
        }
        className={cn(
          "mt-0.5 w-full resize-y rounded-sm border bg-zinc-800 px-2 py-1 text-[13px] text-zinc-200 outline-none",
          error ? "border-red-400/70" : "border-zinc-700 focus:border-zinc-500",
        )}
      />
      <FieldError error={error} />
    </div>
  );
}

// ── Edit forms for the previously uneditable meta entities ──

function MetaCheckEdit({
  data,
  onChange,
}: {
  data: MetaCheckData;
  onChange: (updated: EntityData) => void;
}) {
  const listError = useFieldError("data.questions");
  const setQuestion = (
    index: number,
    patch: Partial<MetaCheckData["questions"][number]>,
  ) => {
    onChange({
      ...data,
      questions: data.questions.map((question, i) =>
        i === index ? { ...question, ...patch } : question,
      ),
    });
  };

  return (
    <div className="space-y-2">
      <FieldError error={listError} />
      {data.questions.map((question, index) => (
        <MetaCheckQuestionEdit
          key={question.question_number}
          question={question}
          index={index}
          onPatch={setQuestion}
        />
      ))}
    </div>
  );
}

function MetaCheckQuestionEdit({
  question,
  index,
  onPatch,
}: {
  question: MetaCheckData["questions"][number];
  index: number;
  onPatch: (
    index: number,
    patch: Partial<MetaCheckData["questions"][number]>,
  ) => void;
}) {
  const answerError = useFieldError(`data.questions.${index}.answer`);
  return (
    <div>
      <label className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
        Question {question.question_number}
      </label>
      <textarea
        value={question.answer}
        rows={2}
        onChange={(e) => onPatch(index, { answer: e.target.value })}
        className={cn(
          "mt-0.5 w-full resize-y rounded-sm border bg-zinc-800 px-2 py-1 text-[13px] text-zinc-200 outline-none",
          answerError
            ? "border-red-400/70"
            : "border-zinc-700 focus:border-zinc-500",
        )}
      />
      <FieldError error={answerError} />
      <label className="mt-0.5 flex items-center gap-1.5 text-[11px] text-zinc-400">
        <input
          type="checkbox"
          checked={question.disruption_trigger_identified}
          onChange={(e) =>
            onPatch(index, {
              disruption_trigger_identified: e.target.checked,
            })
          }
        />
        Disruption trigger identified
      </label>
    </div>
  );
}

function AnalysisReportEdit({
  data,
  onChange,
}: {
  data: AnalysisReportData;
  onChange: (updated: EntityData) => void;
}) {
  const set = (field: keyof AnalysisReportData, value: unknown) =>
    onChange({ ...data, [field]: value } as EntityData);

  return (
    <div className="space-y-1.5">
      <EditField
        label="Executive summary"
        name="data.executive_summary"
        value={data.executive_summary}
        onChange={(v) => set("executive_summary", v)}
        multiline
      />
      <EditField
        label="Why"
        name="data.why"
        value={data.why}
        onChange={(v) => set("why", v)}
        multiline
      />
      <ListEditField
        label="Key evidence"
        name="data.key_evidence"
        values={data.key_evidence}
        onChange={(v) => set("key_evidence", v)}
      />
      <ListEditField
        label="Open assumptions"
        name="data.open_assumptions"
        values={data.open_assumptions}
        onChange={(v) => set("open_assumptions", v)}
      />
      <ListEditField
        label="What changes this"
        name="data.what_would_change"
        values={data.what_would_change}
        onChange={(v) => set("what_would_change", v)}
      />
      <EditField
        label="Source URL"
        name="data.source_url"
        value={data.source_url ?? ""}
        onChange={(v) => set("source_url", v.trim() === "" ? null : v)}
      />
      <p className="text-[11px] text-zinc-600">
        Entity references and the prediction verdict are AI-owned — re-run
        synthesis to change them.
      </p>
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
            name="data.content"
            value={data.content}
            onChange={(v) => set("content", v)}
            multiline
          />
          <EditField
            label="Date"
            name="data.date"
            value={data.date}
            onChange={(v) => set("date", v)}
          />
          <EditField
            label="Source"
            name="data.source"
            value={data.source}
            onChange={(v) => set("source", v)}
          />
          <EditField
            label="Category"
            name="data.category"
            value={data.category}
            onChange={(v) => set("category", v)}
          />
        </div>
      );
    case "player":
      return (
        <div className="space-y-1.5">
          <EditField
            label="Name"
            name="data.name"
            value={data.name}
            onChange={(v) => set("name", v)}
          />
          <EditField
            label="Type"
            name="data.playerType"
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
            name="data.description"
            value={data.description}
            onChange={(v) => set("description", v)}
            multiline
          />
          <EditField
            label="Priority"
            name="data.priority"
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
      return <MetaCheckEdit data={data} onChange={onChange} />;
    case "analysis-report":
      return <AnalysisReportEdit data={data} onChange={onChange} />;
  }
}

function EntityDataSection({
  entity,
  onEntityClick,
}: {
  entity: AnalysisEntity;
  onEntityClick?: (entityId: string) => void;
}) {
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
      return (
        <AnalysisReportOverlay
          data={entity.data as AnalysisReportData}
          onEntityClick={onEntityClick ?? (() => {})}
        />
      );
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
  const color = entityTypeColor(type);
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

// ── Stale banner with revalidation countdown (2.3A) ──

const REVALIDATION_DEBOUNCE_SECONDS = 2;

function StaleBanner({ stale }: { stale: boolean }) {
  const runStatus = useRunStatusStore((s) => s.runStatus);
  const [secondsLeft, setSecondsLeft] = useState(REVALIDATION_DEBOUNCE_SECONDS);

  useEffect(() => {
    if (!stale) return;
    setSecondsLeft(REVALIDATION_DEBOUNCE_SECONDS);
    const interval = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [stale]);

  if (!stale) return null;

  const label =
    secondsLeft > 0
      ? `Needs revalidation — re-running in ${secondsLeft}s…`
      : runStatus.status === "running"
        ? runStatus.kind === "revalidation"
          ? "Needs revalidation — re-running…"
          : "Needs revalidation — queued behind current analysis"
        : "Needs revalidation — queued";

  return (
    <div className="rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-400">
      {label}
    </div>
  );
}

// ── "What changed" peek (3.1A) ──

function DiffList({ diffs }: { diffs: FieldDiff[] }) {
  return (
    <dl className="mt-1 space-y-1">
      {diffs.map((diff) => (
        <div key={diff.field}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
            {formatDiffField(diff.field)}
          </dt>
          <dd className="mt-0.5 text-[12px] leading-snug">
            <span className="text-zinc-500 line-through decoration-zinc-600">
              {formatDiffValue(diff.old)}
            </span>
            <span className="mx-1 text-zinc-600">→</span>
            <span className="text-zinc-200">{formatDiffValue(diff.new)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RevisionPeek({ entity }: { entity: AnalysisEntity }) {
  const entry = latestRevalidationEntry(entity);
  const markRevisionViewed = useCanvasStore((s) => s.markRevisionViewed);

  // Seeing the peek clears the canvas updated-dot (3.1A "clears on view")
  useEffect(() => {
    if (entry) {
      markRevisionViewed(entity.id, entry.logNo);
    }
  }, [entity.id, entry, markRevisionViewed]);

  if (!entry) return null;

  return (
    <section className="rounded-sm border border-amber-500/20 bg-amber-500/5 px-2 py-1.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-amber-400">
        Updated by revalidation
      </h3>
      <DiffList diffs={entry.fieldDiffs} />
    </section>
  );
}

// ── Challenge sections (2.1A form + 2.2A resolution) ──

const EMPTY_CHALLENGE_LIST: ChallengeRecord[] = [];

function ChallengeResolutionSection({ entity }: { entity: AnalysisEntity }) {
  const challenges = useEntityGraphStore(
    (s) => s.analysis.challenges ?? EMPTY_CHALLENGE_LIST,
  );
  const entityChallenges = challenges.filter(
    (record) => record.entityId === entity.id,
  );

  // Viewing the resolution clears the canvas badge (2.2A until-viewed)
  const unviewedIds = entityChallenges
    .filter((record) => record.status === "resolved" && !record.viewed)
    .map((record) => record.id)
    .join(",");
  useEffect(() => {
    if (!unviewedIds) return;
    for (const id of unviewedIds.split(",")) {
      void analysisClient.markChallengeViewed(id);
    }
  }, [unviewedIds]);

  if (entityChallenges.length === 0) return null;

  return (
    <div className="space-y-2">
      {entityChallenges.map((record) => {
        if (record.status === "pending") {
          return (
            <section
              key={record.id}
              className="rounded-sm border border-zinc-700 bg-zinc-800/60 px-2 py-1.5"
            >
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Objection pending re-run
              </h3>
              <p className="mt-0.5 text-[12px] italic leading-snug text-zinc-400">
                “{record.objection}”
              </p>
            </section>
          );
        }

        const responseEntry =
          record.outcome === "REVISED" && record.responseLogNo !== undefined
            ? (entity.revisionLog ?? []).find(
                (entry) => entry.logNo === record.responseLogNo,
              )
            : undefined;

        return (
          <section
            key={record.id}
            className="rounded-sm border border-zinc-700 bg-zinc-800/60 px-2 py-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-400">
                Objection addressed
              </h3>
              {record.outcome && (
                <ChallengeOutcomeChip outcome={record.outcome} />
              )}
            </div>
            <p className="mt-1 text-[12px] italic leading-snug text-zinc-400">
              “{record.objection}”
            </p>
            {record.responseRationale && (
              <p className="mt-1 text-[12px] leading-snug text-zinc-300">
                {record.responseRationale}
              </p>
            )}
            {/* The outcome always ships WITH the change, never the chip alone */}
            {responseEntry && responseEntry.fieldDiffs.length > 0 ? (
              <DiffList diffs={responseEntry.fieldDiffs} />
            ) : (
              record.outcome === "CONFIRMED" && (
                <p className="mt-1 text-[11px] text-zinc-500">
                  No material change — the entity stood up to the objection.
                </p>
              )
            )}
          </section>
        );
      })}
    </div>
  );
}

// ── Challenge form (2.1A) ──

interface ChallengeFormHandle {
  submit: () => void;
  submittable: boolean;
  submitting: boolean;
}

function ChallengeForm({
  entity,
  onStateChange,
  onDone,
}: {
  entity: AnalysisEntity;
  onStateChange: (handle: ChallengeFormHandle) => void;
  onDone: (result: "created" | "queued") => void;
}) {
  const [objection, setObjection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [downstreamIds, setDownstreamIds] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void analysisClient.getDownstreamEntityIds(entity.id).then((ids) => {
      if (!cancelled) setDownstreamIds(ids);
    });
    return () => {
      cancelled = true;
    };
  }, [entity.id]);

  const submittable = objection.trim().length >= 10 && !submitting;

  const handleSubmit = useCallback(async () => {
    if (objection.trim().length < 10 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await analysisClient.challengeEntity(
      entity.id,
      objection.trim(),
    );
    setSubmitting(false);
    if (result.status === "error") {
      setSubmitError(result.error ?? "Challenge failed");
      return;
    }
    onDone(result.status);
  }, [entity.id, objection, submitting, onDone]);

  // Lift submit control to the pinned action bar (1.2A)
  useEffect(() => {
    onStateChange({
      submit: () => void handleSubmit(),
      submittable,
      submitting,
    });
  }, [handleSubmit, submittable, submitting, onStateChange]);

  return (
    <div className="space-y-2.5">
      <p className="text-[12px] leading-snug text-zinc-400">
        Object to this entity's conclusion. The analysis re-runs from its phase
        with your objection in context, and the model must address it — by
        revising the entity or defending it.
      </p>

      <div>
        <label
          htmlFor="challenge-objection"
          className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500"
        >
          Objection
        </label>
        <textarea
          id="challenge-objection"
          value={objection}
          rows={3}
          maxLength={2000}
          placeholder='e.g. "The cited tariff rate is from 2024 — the March 2026 revision supersedes it."'
          onChange={(e) => setObjection(e.target.value)}
          className="mt-0.5 w-full resize-y rounded-sm border border-zinc-700 bg-zinc-800 px-2 py-1 text-[13px] text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-amber-500/60"
        />
        <div className="mt-0.5 flex items-center justify-between text-[11px] text-zinc-600">
          <span>
            {objection.trim().length < 10 ? "At least 10 characters" : ""}
          </span>
          <span>{objection.length} / 2000</span>
        </div>
      </div>

      {/* Downstream preview (2.1A): what this challenge will invalidate */}
      <div className="rounded-sm border border-zinc-700 bg-zinc-800/60 px-2 py-1.5">
        {downstreamIds === null ? (
          <p className="text-[11px] text-zinc-500">
            Checking downstream impact…
          </p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5" aria-hidden>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {downstreamIds.slice(0, 8).map((id) => (
                <span
                  key={id}
                  className="h-2 w-2 rounded-full border border-amber-500/60 bg-amber-500/20"
                />
              ))}
            </div>
            <p className="text-[11px] text-zinc-400">
              This entity
              {downstreamIds.length > 0
                ? ` and ${downstreamIds.length} downstream ${
                    downstreamIds.length === 1 ? "entity" : "entities"
                  } will be marked stale and re-run`
                : " will be marked stale and re-run"}
            </p>
          </div>
        )}
      </div>

      {submitError && (
        <p role="alert" className="text-[12px] text-red-400">
          {submitError}
        </p>
      )}
    </div>
  );
}

// ── Main component ──

type CardMode = "view" | "edit" | "challenge";

export default function EntityOverlayCard({
  entity,
  screenPosition,
  onClose,
}: EntityOverlayCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CardMode>("view");
  const [editData, setEditData] = useState<EntityData>(entity.data);
  const [editRationale, setEditRationale] = useState(entity.rationale);
  const [formState, dispatch] = useReducer(editFormReducer, INITIAL_EDIT_STATE);
  const [queuedNotice, setQueuedNotice] = useState<"edit" | "challenge" | null>(
    null,
  );
  const queuedAtLogNo = useRef<number | null>(null);
  const queuedAtEntityRevision = useRef<number | null>(null);
  const [challengeHandle, setChallengeHandle] =
    useState<ChallengeFormHandle | null>(null);

  // Reset edit state when the entity prop changes identity
  useEffect(() => {
    setEditData(entity.data);
    setEditRationale(entity.rationale);
    setMode("view");
    dispatch({ type: "RESET" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity.id]);

  const entityLatestLogNo = latestLogNo(entity.revisionLog);

  // Clear the queued chip once the queued mutation landed.
  useEffect(() => {
    if (
      queuedNotice &&
      queuedAtLogNo.current !== null &&
      queuedAtEntityRevision.current !== null &&
      (entityLatestLogNo > queuedAtLogNo.current ||
        entity.revision > queuedAtEntityRevision.current)
    ) {
      setQueuedNotice(null);
      queuedAtLogNo.current = null;
      queuedAtEntityRevision.current = null;
    }
  }, [entity.revision, entityLatestLogNo, queuedNotice]);

  // Dismiss on Escape (cancel form if open, otherwise close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mode !== "view") {
        setMode("view");
        setEditData(entity.data);
        setEditRationale(entity.rationale);
        dispatch({ type: "RESET" });
      } else {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, mode, entity.data, entity.rationale]);

  // Click-away dismissal (disabled while a form is open)
  useEffect(() => {
    if (mode !== "view") return;

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
  }, [onClose, mode]);

  const markEdited = useCallback(() => dispatch({ type: "EDIT" }), []);

  const handleEditDataChange = useCallback(
    (updated: EntityData) => {
      setEditData(updated);
      markEdited();
    },
    [markEdited],
  );

  const handleRationaleChange = useCallback(
    (value: string) => {
      setEditRationale(value);
      markEdited();
    },
    [markEdited],
  );

  // Single write path (7A): every save goes through /api/ai/entity.
  const handleSave = useCallback(async () => {
    if (!isSubmittable(formState)) return; // double-submit guard
    dispatch({ type: "SUBMIT" });

    const fieldErrors = validateEditClientSide(entity, editData, editRationale);
    if (Object.keys(fieldErrors).length > 0) {
      dispatch({ type: "CLIENT_INVALID", fieldErrors });
      return;
    }
    dispatch({ type: "CLIENT_VALID" });

    // Optimistic apply (2.3A) — only when no run is active; queued edits
    // apply server-side after the in-flight phase and arrive via SSE.
    const running = analysisClient.isRunning();
    const previous = entity;
    if (!running) {
      useEntityGraphStore.getState().upsertEntityFromServer({
        ...entity,
        data: editData,
        rationale: editRationale,
      });
    }

    const result = await analysisClient.updateEntity(entity.id, {
      data: editData,
      rationale: editRationale,
    });

    if (result.status === "applied") {
      dispatch({ type: "SERVER_APPLIED" });
      // Quiet check, then return to view (2.3A)
      setTimeout(() => {
        setMode("view");
        dispatch({ type: "RESET" });
      }, 900);
      return;
    }
    if (result.status === "queued") {
      dispatch({ type: "SERVER_QUEUED" });
      queuedAtLogNo.current = entityLatestLogNo;
      queuedAtEntityRevision.current = entity.revision;
      setQueuedNotice("edit");
      setMode("view");
      dispatch({ type: "RESET" });
      return;
    }
    // Roll back the optimistic apply; the form stays open with preserved
    // input and field errors (2.3A failure path).
    if (!running) {
      useEntityGraphStore.getState().upsertEntityFromServer(previous);
    }
    dispatch({
      type: "SERVER_ERROR",
      error: result.error ?? "Save failed",
      fieldErrors: result.fieldErrors,
    });
  }, [entity, editData, editRationale, entityLatestLogNo, formState]);

  const handleCancel = useCallback(() => {
    setEditData(entity.data);
    setEditRationale(entity.rationale);
    setMode("view");
    dispatch({ type: "RESET" });
  }, [entity.data, entity.rationale]);

  const handleEntityNavigation = useCallback((entityId: string) => {
    useCanvasStore.getState().setFocusedEntityId(entityId);
  }, []);

  const handleChallengeDone = useCallback(
    (result: "created" | "queued") => {
      if (result === "queued") {
        queuedAtLogNo.current = entityLatestLogNo;
        queuedAtEntityRevision.current = entity.revision;
        setQueuedNotice("challenge");
      }
      setMode("view");
      setChallengeHandle(null);
    },
    [entity.revision, entityLatestLogNo],
  );

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
    width: cardMaxWidth,
    maxHeight: 480,
    zIndex: 60,
  };

  const name = getEntityName(entity);
  const editErrors = formState.phase === "failed" ? formState.fieldErrors : {};
  const unmappedErrors = Object.entries(editErrors).filter(
    ([key]) => key !== "updates",
  );

  return (
    <div
      ref={cardRef}
      className="flex flex-col overflow-hidden rounded-md border border-zinc-700 bg-zinc-900 shadow-lg"
      style={style}
    >
      {/* ── PINNED header: badges + name + close (1.2A) ── */}
      <header className="shrink-0 space-y-1.5 border-b border-zinc-800 p-3 pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <TypeBadge type={entity.type} />
            <ConfidenceBadge confidence={entity.confidence} />
            <SourceBadge
              source={displaySourceForProvenance(entity.provenance)}
            />
            {mode === "edit" && (
              <span className="inline-flex items-center rounded-sm bg-zinc-800 px-1.5 py-0.5 text-[11px] font-medium text-zinc-300">
                Editing
              </span>
            )}
            {mode === "challenge" && (
              <span className="inline-flex items-center rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-400">
                Challenge
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 -mt-1 shrink-0 text-zinc-500 hover:text-zinc-100"
          >
            <X size={14} />
          </Button>
        </div>
        <h2 className="text-base font-bold leading-snug text-zinc-100">
          {name}
        </h2>
        <PhaseBadge phase={entity.phase} />
      </header>

      {/* ── SCROLLABLE field region — only this scrolls (1.2A) ── */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {mode === "view" && (
          <>
            <RevisionPeek entity={entity} />
            <ChallengeResolutionSection entity={entity} />
            {queuedNotice && (
              <div className="rounded-sm border border-zinc-700 bg-zinc-800/60 px-2 py-1 text-[11px] font-medium text-zinc-300">
                {queuedNotice === "edit"
                  ? "Queued — applies after current phase"
                  : "Challenge queued — applies after current phase"}
              </div>
            )}
            <EntityDataSection
              entity={entity}
              onEntityClick={handleEntityNavigation}
            />
            {entity.rationale && (
              <div className="border-t border-zinc-800 pt-2">
                <dt className="text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  Rationale
                </dt>
                <dd className="mt-0.5 text-[13px] leading-relaxed text-zinc-300">
                  {entity.rationale}
                </dd>
              </div>
            )}
            <StaleBanner stale={entity.stale} />
          </>
        )}

        {mode === "edit" && (
          <EditErrorsContext.Provider value={editErrors}>
            <EditableEntityData
              data={editData}
              onChange={handleEditDataChange}
            />
            <div className="border-t border-zinc-800 pt-2">
              <EditField
                label="Rationale"
                name="rationale"
                value={editRationale}
                onChange={handleRationaleChange}
                multiline
              />
            </div>
            {unmappedErrors.length > 0 && (
              <ul role="alert" className="space-y-0.5 text-[11px] text-red-400">
                {unmappedErrors.map(([field, message]) => (
                  <li key={field}>
                    {formatDiffField(field)}: {message}
                  </li>
                ))}
              </ul>
            )}
          </EditErrorsContext.Provider>
        )}

        {mode === "challenge" && (
          <ChallengeForm
            entity={entity}
            onStateChange={setChallengeHandle}
            onDone={handleChallengeDone}
          />
        )}
      </div>

      {/* ── PINNED action bar (1.2A) ── */}
      <footer className="flex shrink-0 items-center gap-1 border-t border-zinc-800 px-3 py-2">
        {mode === "view" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditData(entity.data);
                setEditRationale(entity.rationale);
                dispatch({ type: "RESET" });
                setMode("edit");
              }}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <Pencil size={12} />
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMode("challenge")}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <ShieldQuestion size={12} />
              Challenge
            </Button>
          </>
        )}

        {mode === "edit" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSave()}
              disabled={isBusy(formState) || formState.phase === "pristine"}
              className="text-xs text-emerald-400 hover:text-emerald-300"
            >
              <Check size={12} />
              {isBusy(formState)
                ? "Saving…"
                : formState.phase === "saved"
                  ? "Saved"
                  : "Save"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isBusy(formState)}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              <X size={12} />
              Cancel
            </Button>
            {formState.phase === "failed" && (
              <span role="alert" className="ml-auto text-[11px] text-red-400">
                {formState.error}
              </span>
            )}
          </>
        )}

        {mode === "challenge" && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="text-xs text-zinc-400 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => challengeHandle?.submit()}
              disabled={!challengeHandle?.submittable}
              className="ml-auto bg-amber-500 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
            >
              {challengeHandle?.submitting
                ? "Submitting…"
                : "Challenge & re-run"}
            </Button>
          </>
        )}
      </footer>
    </div>
  );
}
