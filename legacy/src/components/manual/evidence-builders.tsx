import { useState } from "react";
import { generateEntityId } from "shared/game-theory/engine/id-generator";
import {
  assertCommitted,
  isoNow,
  toggleStringValue,
  type BuilderWithCanonicalProps,
} from "./workbench-utils";

// ---------------------------------------------------------------------------
// ObservationBuilder
// ---------------------------------------------------------------------------

export function ObservationBuilder({
  run,
  canonical,
}: BuilderWithCanonicalProps) {
  const [observationSourceId, setObservationSourceId] = useState("");
  const [observationText, setObservationText] = useState("");
  const [observationQuoteSpan, setObservationQuoteSpan] = useState("");

  const sources = Object.values(canonical.sources);

  return (
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
  );
}

// ---------------------------------------------------------------------------
// ClaimBuilder
// ---------------------------------------------------------------------------

export function ClaimBuilder({ run, canonical }: BuilderWithCanonicalProps) {
  const [claimStatement, setClaimStatement] = useState("");
  const [claimConfidence, setClaimConfidence] = useState("0.7");
  const [claimBasedOnObservationIds, setClaimBasedOnObservationIds] = useState<
    string[]
  >([]);

  const observations = Object.values(canonical.observations);

  return (
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
  );
}

// ---------------------------------------------------------------------------
// InferenceBuilder
// ---------------------------------------------------------------------------

export function InferenceBuilder({
  run,
  canonical,
}: BuilderWithCanonicalProps) {
  const [inferenceStatement, setInferenceStatement] = useState("");
  const [inferenceRationale, setInferenceRationale] = useState("");
  const [inferenceConfidence, setInferenceConfidence] = useState("0.7");
  const [inferenceDerivedFromIds, setInferenceDerivedFromIds] = useState<
    string[]
  >([]);

  const claims = Object.values(canonical.claims);

  return (
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
                      toggleStringValue(
                        current,
                        claim.id,
                        event.target.checked,
                      ),
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
  );
}

// ---------------------------------------------------------------------------
// AssumptionBuilder
// ---------------------------------------------------------------------------

export function AssumptionBuilder({
  run,
  canonical,
}: BuilderWithCanonicalProps) {
  const [assumptionStatement, setAssumptionStatement] = useState("");
  const [assumptionType, setAssumptionType] = useState<
    | "behavioral"
    | "capability"
    | "structural"
    | "institutional"
    | "rationality"
    | "information"
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

  const claims = Object.values(canonical.claims);
  const inferences = Object.values(canonical.inferences);

  return (
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
            setAssumptionType(event.target.value as typeof assumptionType)
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
                      toggleStringValue(
                        current,
                        claim.id,
                        event.target.checked,
                      ),
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
                      toggleStringValue(
                        current,
                        claim.id,
                        event.target.checked,
                      ),
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
  );
}

// ---------------------------------------------------------------------------
// ScenarioBuilder
// ---------------------------------------------------------------------------

export function ScenarioBuilder({ run, canonical }: BuilderWithCanonicalProps) {
  const [scenarioFormalizationId, setScenarioFormalizationId] = useState("");
  const [scenarioName, setScenarioName] = useState("");
  const [scenarioNarrative, setScenarioNarrative] = useState("");
  const [scenarioProbabilityModel, setScenarioProbabilityModel] = useState<
    "independent" | "dependency_aware" | "ordinal_only"
  >("independent");
  const [scenarioKeyAssumptionIds, setScenarioKeyAssumptionIds] = useState<
    string[]
  >([]);
  const [scenarioInvalidatorIds, setScenarioInvalidatorIds] = useState<
    string[]
  >([]);

  const formalizations = Object.values(canonical.formalizations);
  const claims = Object.values(canonical.claims);
  const inferences = Object.values(canonical.inferences);
  const assumptions = Object.values(canonical.assumptions);

  return (
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
              {canonical.games[formalization.game_id]?.name ??
                formalization.game_id}{" "}
              / {formalization.kind}
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
        {claims.length === 0 &&
        inferences.length === 0 &&
        assumptions.length === 0 ? (
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
                      toggleStringValue(
                        current,
                        claim.id,
                        event.target.checked,
                      ),
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
          !scenarioFormalizationId ||
          !scenarioName.trim() ||
          !scenarioNarrative.trim()
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
  );
}
