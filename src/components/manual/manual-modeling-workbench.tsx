import { useMemo, useState } from "react";
import { analysisStore, useAnalysisStore } from "@/stores/analysis-store";
import { useUiStore } from "@/stores/ui-store";
import { generateEntityId } from "shared/game-theory/engine/id-generator";
import type { Command } from "shared/game-theory/engine/commands";
import type { NormalFormModel } from "shared/game-theory/types/formalizations";

type ManualEntityType =
  | "game"
  | "formalization"
  | "player"
  | "source"
  | "observation"
  | "claim"
  | "inference"
  | "assumption"
  | "scenario";
type SourceKind = "web" | "pdf" | "article" | "report" | "transcript" | "manual";
type SourceQuality = "low" | "medium" | "high";

function assertCommitted(command: Command): void {
  const result = analysisStore.getState().dispatch(command);
  if (result.status !== "committed") {
    const message =
      result.status === "rejected"
        ? result.errors.join(", ") || `Failed to apply ${command.kind}.`
        : `Failed to apply ${command.kind}.`;
    throw new Error(message);
  }
}

function isoNow(): string {
  return new Date().toISOString();
}

function toggleStringValue(current: string[], value: string, checked: boolean): string[] {
  return checked
    ? [...new Set([...current, value])]
    : current.filter((entry) => entry !== value);
}

export function ManualModelingWorkbench() {
  const manualMode = useUiStore((state) => state.manualMode);
  const canonical = useAnalysisStore((state) => state.canonical);
  const [activeBuilder, setActiveBuilder] = useState<ManualEntityType>("game");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [gameName, setGameName] = useState("");
  const [gameDescription, setGameDescription] = useState("");
  const [formalizationGameId, setFormalizationGameId] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerDescription, setPlayerDescription] = useState("");
  const [playerType, setPlayerType] = useState<
    "state" | "organization" | "individual" | "coalition" | "market" | "public"
  >("state");
  const [playerRole, setPlayerRole] = useState<
    "primary" | "involuntary" | "background" | "internal" | "gatekeeper"
  >("primary");
  const [playerGameId, setPlayerGameId] = useState("");
  const [sourceKind, setSourceKind] = useState<SourceKind>("article");
  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourcePublisher, setSourcePublisher] = useState("");
  const [sourceQualityRating, setSourceQualityRating] =
    useState<SourceQuality>("medium");
  const [sourceNotes, setSourceNotes] = useState("");
  const [observationSourceId, setObservationSourceId] = useState("");
  const [observationText, setObservationText] = useState("");
  const [observationQuoteSpan, setObservationQuoteSpan] = useState("");
  const [claimStatement, setClaimStatement] = useState("");
  const [claimConfidence, setClaimConfidence] = useState("0.7");
  const [claimBasedOnObservationIds, setClaimBasedOnObservationIds] = useState<
    string[]
  >([]);
  const [inferenceStatement, setInferenceStatement] = useState("");
  const [inferenceRationale, setInferenceRationale] = useState("");
  const [inferenceConfidence, setInferenceConfidence] = useState("0.7");
  const [inferenceDerivedFromIds, setInferenceDerivedFromIds] = useState<
    string[]
  >([]);
  const [assumptionStatement, setAssumptionStatement] = useState("");
  const [assumptionType, setAssumptionType] = useState<
    "behavioral" | "capability" | "structural" | "institutional" | "rationality" | "information"
  >("behavioral");
  const [assumptionSensitivity, setAssumptionSensitivity] = useState<
    "low" | "medium" | "high" | "critical"
  >("medium");
  const [assumptionConfidence, setAssumptionConfidence] = useState("0.7");
  const [assumptionSupportedByIds, setAssumptionSupportedByIds] = useState<
    string[]
  >([]);
  const [assumptionContradictedByIds, setAssumptionContradictedByIds] =
    useState<string[]>([]);
  const [scenarioFormalizationId, setScenarioFormalizationId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioNarrative, setScenarioNarrative] = useState("");
  const [scenarioProbabilityModel, setScenarioProbabilityModel] = useState<
    "independent" | "dependency_aware" | "ordinal_only"
  >("independent");
  const [scenarioKeyAssumptionIds, setScenarioKeyAssumptionIds] = useState<
    string[]
  >([]);
  const [scenarioInvalidatorIds, setScenarioInvalidatorIds] = useState<string[]>(
    [],
  );

  const games = useMemo(() => Object.values(canonical.games), [canonical.games]);
  const formalizations = useMemo(
    () => Object.values(canonical.formalizations),
    [canonical.formalizations],
  );
  const sources = useMemo(() => Object.values(canonical.sources), [canonical.sources]);
  const observations = useMemo(
    () => Object.values(canonical.observations),
    [canonical.observations],
  );
  const claims = useMemo(() => Object.values(canonical.claims), [canonical.claims]);
  const inferences = useMemo(
    () => Object.values(canonical.inferences),
    [canonical.inferences],
  );
  const assumptions = useMemo(
    () => Object.values(canonical.assumptions),
    [canonical.assumptions],
  );

  if (!manualMode) {
    return (
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Manual modeling</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enable manual modeling in Settings to add games, formalizations, players,
          evidence, inferences, assumptions, and scenarios through the command spine.
        </p>
      </section>
    );
  }

  function clearMessages(): void {
    setError(null);
    setLastAction(null);
  }

  function run(action: () => void, successMessage: string): void {
    clearMessages();
    try {
      action();
      setLastAction(successMessage);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Manual modeling failed.");
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Manual modeling</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Create core entities directly through the canonical command/event system.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(
            [
              ["game", "Game"],
              ["formalization", "Formalization"],
              ["player", "Player"],
              ["source", "Source"],
              ["observation", "Observation"],
              ["claim", "Claim"],
              ["inference", "Inference"],
              ["assumption", "Assumption"],
              ["scenario", "Scenario"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveBuilder(value)}
              className={`rounded-full px-3 py-1.5 text-xs transition-colors ${
                activeBuilder === value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-foreground hover:bg-accent"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {activeBuilder === "game" && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Game name</span>
            <input
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="US-China tariff bargaining"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Description</span>
            <input
              value={gameDescription}
              onChange={(event) => setGameDescription(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Core strategic interaction and stakes"
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={!gameName.trim() || !gameDescription.trim()}
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_game",
                  id: generateEntityId("game"),
                  payload: {
                    name: gameName.trim(),
                    description: gameDescription.trim(),
                    semantic_labels: ["custom"],
                    players: [],
                    status: "active",
                    formalizations: [],
                    coupling_links: [],
                    key_assumptions: [],
                    created_at: isoNow(),
                    updated_at: isoNow(),
                  },
                });
                setGameName("");
                setGameDescription("");
              }, "Game created.")
            }
          >
            Add game
          </button>
        </div>
      )}

      {activeBuilder === "formalization" && (
        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Attach to game</span>
            <select
              value={formalizationGameId}
              onChange={(event) => setFormalizationGameId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Select game</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={!formalizationGameId}
            onClick={() =>
              run(() => {
                const formalizationId = generateEntityId("formalization");
                const formalizationPayload: Omit<NormalFormModel, "id"> = {
                  game_id: formalizationGameId,
                  kind: "normal_form",
                  purpose: "computational",
                  abstraction_level: "minimal",
                  assumptions: [],
                  strategies: {},
                  payoff_cells: [],
                };
                assertCommitted({
                  kind: "add_formalization",
                  id: formalizationId,
                  payload: formalizationPayload,
                });
                assertCommitted({
                  kind: "attach_formalization_to_game",
                  payload: {
                    game_id: formalizationGameId,
                    formalization_id: formalizationId,
                  },
                });
                setScenarioFormalizationId(formalizationId);
              }, "Normal-form formalization created.")
            }
          >
            Add formalization
          </button>
        </div>
      )}

      {activeBuilder === "player" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Player name</span>
            <input
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Treasury Department"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Player type</span>
            <select
              value={playerType}
              onChange={(event) =>
                setPlayerType(
                  event.target.value as typeof playerType,
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="state">State</option>
              <option value="organization">Organization</option>
              <option value="individual">Individual</option>
              <option value="coalition">Coalition</option>
              <option value="market">Market</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Role</span>
            <select
              value={playerRole}
              onChange={(event) =>
                setPlayerRole(
                  event.target.value as typeof playerRole,
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="primary">Primary</option>
              <option value="gatekeeper">Gatekeeper</option>
              <option value="internal">Internal</option>
              <option value="background">Background</option>
              <option value="involuntary">Involuntary</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Attach to game</span>
            <select
              value={playerGameId}
              onChange={(event) => setPlayerGameId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Optional</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Description</span>
            <textarea
              value={playerDescription}
              onChange={(event) => setPlayerDescription(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="What this player wants, fears, or controls"
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={!playerName.trim()}
            onClick={() =>
              run(() => {
                const playerId = generateEntityId("player");
                assertCommitted({
                  kind: "add_player",
                  id: playerId,
                  payload: {
                    name: playerName.trim(),
                    type: playerType,
                    objectives: [],
                    constraints: [],
                    role: playerRole,
                    metadata: playerDescription.trim()
                      ? { description: playerDescription.trim() }
                      : undefined,
                  },
                });
                if (playerGameId) {
                  assertCommitted({
                    kind: "attach_player_to_game",
                    payload: {
                      game_id: playerGameId,
                      player_id: playerId,
                    },
                  });
                }
                setPlayerName("");
                setPlayerDescription("");
              }, "Player created.")
            }
          >
            Add player
          </button>
        </div>
      )}

      {activeBuilder === "source" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Source kind</span>
            <select
              value={sourceKind}
              onChange={(event) => setSourceKind(event.target.value as SourceKind)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="article">Article</option>
              <option value="report">Report</option>
              <option value="web">Web</option>
              <option value="pdf">PDF</option>
              <option value="transcript">Transcript</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Quality</span>
            <select
              value={sourceQualityRating}
              onChange={(event) =>
                setSourceQualityRating(event.target.value as SourceQuality)
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Title</span>
            <input
              value={sourceTitle}
              onChange={(event) => setSourceTitle(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="IMF country risk update"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Publisher</span>
            <input
              value={sourcePublisher}
              onChange={(event) => setSourcePublisher(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="IMF"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">URL</span>
            <input
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="https://example.com/report"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Notes</span>
            <textarea
              value={sourceNotes}
              onChange={(event) => setSourceNotes(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Why this source matters or what it covers"
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={!sourceTitle.trim()}
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_source",
                  id: generateEntityId("source"),
                  payload: {
                    kind: sourceKind,
                    title: sourceTitle.trim(),
                    url: sourceUrl.trim() || undefined,
                    publisher: sourcePublisher.trim() || undefined,
                    captured_at: isoNow(),
                    quality_rating: sourceQualityRating,
                    notes: sourceNotes.trim() || undefined,
                  },
                });
                setSourceTitle("");
                setSourceUrl("");
                setSourcePublisher("");
                setSourceNotes("");
              }, "Source created.")
            }
          >
            Add source
          </button>
        </div>
      )}

      {activeBuilder === "observation" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Source</span>
            <select
              value={observationSourceId}
              onChange={(event) => setObservationSourceId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Select source</option>
              {sources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title ?? source.url ?? source.id}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Observation</span>
            <textarea
              value={observationText}
              onChange={(event) => setObservationText(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Key factual observation extracted from the source"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Quote span</span>
            <input
              value={observationQuoteSpan}
              onChange={(event) => setObservationQuoteSpan(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Optional direct quote or excerpt"
            />
          </label>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={!observationSourceId || !observationText.trim()}
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_observation",
                  id: generateEntityId("observation"),
                  payload: {
                    source_id: observationSourceId,
                    text: observationText.trim(),
                    quote_span: observationQuoteSpan.trim() || undefined,
                    captured_at: isoNow(),
                  },
                });
                setObservationText("");
                setObservationQuoteSpan("");
              }, "Observation created.")
            }
          >
            Add observation
          </button>
        </div>
      )}

      {activeBuilder === "claim" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Claim statement</span>
            <textarea
              value={claimStatement}
              onChange={(event) => setClaimStatement(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Analytic claim derived from the evidence base"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Confidence</span>
            <input
              value={claimConfidence}
              onChange={(event) => setClaimConfidence(event.target.value)}
              type="number"
              min="0"
              max="1"
              step="0.05"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Based on observations</span>
            {observations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add an observation first.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {observations.map((observation) => (
                  <label
                    key={observation.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={claimBasedOnObservationIds.includes(observation.id)}
                      onChange={(event) =>
                        setClaimBasedOnObservationIds((current) =>
                          toggleStringValue(
                            current,
                            observation.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>{observation.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={
              !claimStatement.trim() || claimBasedOnObservationIds.length === 0
            }
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_claim",
                  id: generateEntityId("claim"),
                  payload: {
                    statement: claimStatement.trim(),
                    based_on: claimBasedOnObservationIds,
                    confidence: Number(claimConfidence) || 0.7,
                  },
                });
                setClaimStatement("");
                setClaimBasedOnObservationIds([]);
              }, "Claim created.")
            }
          >
            Add claim
          </button>
        </div>
      )}

      {activeBuilder === "inference" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Inference statement</span>
            <textarea
              value={inferenceStatement}
              onChange={(event) => setInferenceStatement(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="What follows from the current claims"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Rationale</span>
            <textarea
              value={inferenceRationale}
              onChange={(event) => setInferenceRationale(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Why this inference is warranted"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Confidence</span>
            <input
              value={inferenceConfidence}
              onChange={(event) => setInferenceConfidence(event.target.value)}
              type="number"
              min="0"
              max="1"
              step="0.05"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Derived from claims</span>
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a claim first.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {claims.map((claim) => (
                  <label
                    key={claim.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={inferenceDerivedFromIds.includes(claim.id)}
                      onChange={(event) =>
                        setInferenceDerivedFromIds((current) =>
                          toggleStringValue(current, claim.id, event.target.checked),
                        )
                      }
                    />
                    <span>{claim.statement}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={
              !inferenceStatement.trim() ||
              !inferenceRationale.trim() ||
              inferenceDerivedFromIds.length === 0
            }
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_inference",
                  id: generateEntityId("inference"),
                  payload: {
                    statement: inferenceStatement.trim(),
                    derived_from: inferenceDerivedFromIds,
                    confidence: Number(inferenceConfidence) || 0.7,
                    rationale: inferenceRationale.trim(),
                  },
                });
                setInferenceStatement("");
                setInferenceRationale("");
                setInferenceDerivedFromIds([]);
              }, "Inference created.")
            }
          >
            Add inference
          </button>
        </div>
      )}

      {activeBuilder === "assumption" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Assumption statement</span>
            <textarea
              value={assumptionStatement}
              onChange={(event) => setAssumptionStatement(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="What must remain true for the model to hold"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Type</span>
            <select
              value={assumptionType}
              onChange={(event) =>
                setAssumptionType(
                  event.target.value as typeof assumptionType,
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="behavioral">Behavioral</option>
              <option value="capability">Capability</option>
              <option value="structural">Structural</option>
              <option value="institutional">Institutional</option>
              <option value="rationality">Rationality</option>
              <option value="information">Information</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Sensitivity</span>
            <select
              value={assumptionSensitivity}
              onChange={(event) =>
                setAssumptionSensitivity(
                  event.target.value as typeof assumptionSensitivity,
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Confidence</span>
            <input
              value={assumptionConfidence}
              onChange={(event) => setAssumptionConfidence(event.target.value)}
              type="number"
              min="0"
              max="1"
              step="0.05"
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Supported by</span>
            {claims.length === 0 && inferences.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add claims or inferences to link support.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {claims.map((claim) => (
                  <label
                    key={claim.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={assumptionSupportedByIds.includes(claim.id)}
                      onChange={(event) =>
                        setAssumptionSupportedByIds((current) =>
                          toggleStringValue(current, claim.id, event.target.checked),
                        )
                      }
                    />
                    <span>Claim: {claim.statement}</span>
                  </label>
                ))}
                {inferences.map((inference) => (
                  <label
                    key={inference.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={assumptionSupportedByIds.includes(inference.id)}
                      onChange={(event) =>
                        setAssumptionSupportedByIds((current) =>
                          toggleStringValue(
                            current,
                            inference.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>Inference: {inference.statement}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Contradicted by</span>
            {claims.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add a claim first.</p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {claims.map((claim) => (
                  <label
                    key={claim.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={assumptionContradictedByIds.includes(claim.id)}
                      onChange={(event) =>
                        setAssumptionContradictedByIds((current) =>
                          toggleStringValue(current, claim.id, event.target.checked),
                        )
                      }
                    />
                    <span>{claim.statement}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50 md:col-span-2"
            disabled={!assumptionStatement.trim()}
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_assumption",
                  id: generateEntityId("assumption"),
                  payload: {
                    statement: assumptionStatement.trim(),
                    type: assumptionType,
                    supported_by:
                      assumptionSupportedByIds.length > 0
                        ? assumptionSupportedByIds
                        : undefined,
                    contradicted_by:
                      assumptionContradictedByIds.length > 0
                        ? assumptionContradictedByIds
                        : undefined,
                    sensitivity: assumptionSensitivity,
                    confidence: Number(assumptionConfidence) || 0.7,
                  },
                });
                setAssumptionStatement("");
                setAssumptionSupportedByIds([]);
                setAssumptionContradictedByIds([]);
              }, "Assumption created.")
            }
          >
            Add assumption
          </button>
        </div>
      )}

      {activeBuilder === "scenario" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium">Formalization</span>
            <select
              value={scenarioFormalizationId}
              onChange={(event) => setScenarioFormalizationId(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="">Select formalization</option>
              {formalizations.map((formalization) => (
                <option key={formalization.id} value={formalization.id}>
                  {canonical.games[formalization.game_id]?.name ?? formalization.game_id} /{" "}
                  {formalization.kind}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Scenario name</span>
            <input
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="Escalation contained"
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Narrative</span>
            <textarea
              value={scenarioNarrative}
              onChange={(event) => setScenarioNarrative(event.target.value)}
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2"
              placeholder="What path unfolds and why"
            />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium">Probability model</span>
            <select
              value={scenarioProbabilityModel}
              onChange={(event) =>
                setScenarioProbabilityModel(
                  event.target.value as typeof scenarioProbabilityModel,
                )
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2"
            >
              <option value="independent">Independent</option>
              <option value="dependency_aware">Dependency-aware</option>
              <option value="ordinal_only">Ordinal only</option>
            </select>
          </label>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Key assumptions</span>
            {assumptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add assumptions to link scenario foundations.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {assumptions.map((assumption) => (
                  <label
                    key={assumption.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={scenarioKeyAssumptionIds.includes(assumption.id)}
                      onChange={(event) =>
                        setScenarioKeyAssumptionIds((current) =>
                          toggleStringValue(
                            current,
                            assumption.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>{assumption.statement}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="text-sm md:col-span-2">
            <span className="mb-2 block font-medium">Invalidators</span>
            {claims.length === 0 && inferences.length === 0 && assumptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add claims, inferences, or assumptions to define invalidators.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2">
                {claims.map((claim) => (
                  <label
                    key={claim.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={scenarioInvalidatorIds.includes(claim.id)}
                      onChange={(event) =>
                        setScenarioInvalidatorIds((current) =>
                          toggleStringValue(current, claim.id, event.target.checked),
                        )
                      }
                    />
                    <span>Claim: {claim.statement}</span>
                  </label>
                ))}
                {inferences.map((inference) => (
                  <label
                    key={inference.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={scenarioInvalidatorIds.includes(inference.id)}
                      onChange={(event) =>
                        setScenarioInvalidatorIds((current) =>
                          toggleStringValue(
                            current,
                            inference.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>Inference: {inference.statement}</span>
                  </label>
                ))}
                {assumptions.map((assumption) => (
                  <label
                    key={assumption.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      checked={scenarioInvalidatorIds.includes(assumption.id)}
                      onChange={(event) =>
                        setScenarioInvalidatorIds((current) =>
                          toggleStringValue(
                            current,
                            assumption.id,
                            event.target.checked,
                          ),
                        )
                      }
                    />
                    <span>Assumption: {assumption.statement}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            disabled={
              !scenarioFormalizationId || !scenarioName.trim() || !scenarioNarrative.trim()
            }
            onClick={() =>
              run(() => {
                assertCommitted({
                  kind: "add_scenario",
                  id: generateEntityId("scenario"),
                  payload: {
                    name: scenarioName.trim(),
                    formalization_id: scenarioFormalizationId,
                    path: [],
                    probability_model: scenarioProbabilityModel,
                    key_assumptions: scenarioKeyAssumptionIds,
                    invalidators: scenarioInvalidatorIds,
                    narrative: scenarioNarrative.trim(),
                  },
                });
                setScenarioName("");
                setScenarioNarrative("");
                setScenarioKeyAssumptionIds([]);
                setScenarioInvalidatorIds([]);
              }, "Scenario created.")
            }
          >
            Add scenario
          </button>
        </div>
      )}

      {(error || lastAction) && (
        <div className="mt-4 rounded-lg border border-border/70 bg-background px-4 py-3">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {lastAction && <p className="text-sm text-foreground">{lastAction}</p>}
        </div>
      )}
    </section>
  );
}
