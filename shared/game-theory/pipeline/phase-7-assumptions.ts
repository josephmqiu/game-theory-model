import type { Command } from "../engine/commands";
import type { PipelineHost } from "./host";
import type {
  CanonicalStore,
  EntityRef,
  EstimateValue,
  Formalization,
} from "../types";
import type {
  AssumptionExtractionResult,
  CorrelatedCluster,
  FormalizationResult,
  HistoricalGameResult,
  ModelProposal,
  PhaseExecution,
  PhaseResult,
  ProposedAssumptionFull,
} from "../types/analysis-pipeline";
import type { AssumptionSensitivity } from "../types/solver-results";
import {
  asEntityRef,
  buildModelProposal,
  createConfidenceEstimate,
  createEntityPreview,
} from "./helpers";

interface Phase7RunnerContext {
  canonical: CanonicalStore;
  baseRevision: number;
  phaseExecution: PhaseExecution;
  phaseResults?: Record<number, unknown>;
  getDerivedState: PipelineHost["getDerivedState"];
}

type OwnerAttachment =
  | { kind: "game"; id: string }
  | { kind: "formalization"; id: string }
  | { kind: "game_node"; id: string }
  | { kind: "game_edge"; id: string }
  | {
      kind: "normal_form_estimate";
      formalization_id: string;
      cell_index: number;
      player_id: string;
    }
  | { kind: "terminal_estimate"; node_id: string; player_id: string }
  | { kind: "edge_payoff_delta"; edge_id: string; player_id: string };

interface CandidateAssumption {
  existing_id: string | null;
  temp_id: string;
  statement: string;
  type: ProposedAssumptionFull["type"];
  owners: OwnerAttachment[];
  supported_by_ids: string[];
  contradicted_by_ids: string[];
  extra_evidence_refs: EntityRef[];
  affected_conclusions: EntityRef[];
  game_theoretic_vs_empirical: ProposedAssumptionFull["game_theoretic_vs_empirical"];
  confidence_value: number;
}

interface FinalizedAssumption extends ProposedAssumptionFull {
  existing_id: string | null;
  supported_by_ids: string[];
  contradicted_by_ids: string[];
  owners: OwnerAttachment[];
}

function getHistoricalResult(
  phaseResults?: Record<number, unknown>,
): HistoricalGameResult | null {
  const result = phaseResults?.[4];
  return result &&
    typeof result === "object" &&
    "phase" in result &&
    result.phase === 4
    ? (result as HistoricalGameResult)
    : null;
}

function getFormalizationResult(
  phaseResults?: Record<number, unknown>,
): FormalizationResult | null {
  const result = phaseResults?.[6];
  return result &&
    typeof result === "object" &&
    "phase" in result &&
    result.phase === 6
    ? (result as FormalizationResult)
    : null;
}

function normalizeStatement(statement: string): string {
  return statement
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function uniqueRefs(refs: EntityRef[]): EntityRef[] {
  const seen = new Set<string>();
  return refs
    .filter((ref) => {
      const key = `${ref.type}:${ref.id}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) =>
      `${left.type}:${left.id}`.localeCompare(`${right.type}:${right.id}`),
    );
}

function uniqueOwners(owners: OwnerAttachment[]): OwnerAttachment[] {
  const seen = new Set<string>();
  return owners.filter((owner) => {
    const key = JSON.stringify(owner);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

function createStableTempId(statement: string, ownerKey?: string): string {
  const normalized =
    normalizeStatement(statement).replace(/\s+/g, "_").slice(0, 48) ||
    "assumption";
  const ownerSuffix = ownerKey
    ? normalizeStatement(ownerKey).replace(/\s+/g, "_").slice(0, 24)
    : "derived";
  return `assumption_temp_${normalized}_${ownerSuffix}`;
}

function humanizeKind(kind: Formalization["kind"]): string {
  return kind.replace(/_/g, " ");
}

function pickTopToken(statement: string): string {
  const stopwords = new Set([
    "the",
    "and",
    "that",
    "this",
    "with",
    "from",
    "into",
    "over",
    "under",
    "same",
    "remain",
    "players",
    "player",
    "current",
    "model",
    "game",
    "will",
    "would",
    "could",
    "their",
  ]);
  const tokens = normalizeStatement(statement)
    .split(" ")
    .filter((token) => token.length >= 5 && !stopwords.has(token));
  return tokens[0] ?? "assumption";
}

function isClaimBackedByObservation(
  claimId: string,
  canonical: CanonicalStore,
): boolean {
  const claim = canonical.claims[claimId];
  return Boolean(claim && claim.based_on.length > 0);
}

function inferEvidenceQuality(
  supportedByIds: string[],
  canonical: CanonicalStore,
): ProposedAssumptionFull["evidence_quality"] {
  if (supportedByIds.length === 0) {
    return "assumption_only";
  }

  for (const id of supportedByIds) {
    if (id in canonical.claims && isClaimBackedByObservation(id, canonical)) {
      return "direct_evidence";
    }
  }

  return "inference";
}

function confidenceForCandidate(
  candidate: CandidateAssumption,
  evidenceQuality: ProposedAssumptionFull["evidence_quality"],
  canonical: CanonicalStore,
): EstimateValue {
  const baseline =
    evidenceQuality === "direct_evidence"
      ? 0.82
      : evidenceQuality === "inference"
        ? 0.68
        : 0.52;
  const numeric = Math.max(candidate.confidence_value, baseline);
  return createConfidenceEstimate(
    `Phase 7 confidence for assumption extraction on "${candidate.statement}".`,
    candidate.supported_by_ids.filter((id) => id in canonical.claims),
    numeric,
  );
}

function buildOwnerIndexes(
  canonical: CanonicalStore,
): Map<string, OwnerAttachment[]> {
  const owners = new Map<string, OwnerAttachment[]>();

  function pushOwner(assumptionId: string, owner: OwnerAttachment): void {
    owners.set(assumptionId, [...(owners.get(assumptionId) ?? []), owner]);
  }

  for (const game of Object.values(canonical.games)) {
    for (const assumptionId of game.key_assumptions) {
      pushOwner(assumptionId, { kind: "game", id: game.id });
    }
  }

  for (const formalization of Object.values(canonical.formalizations)) {
    for (const assumptionId of formalization.assumptions) {
      pushOwner(assumptionId, { kind: "formalization", id: formalization.id });
    }

    if (formalization.kind === "normal_form") {
      formalization.payoff_cells.forEach((cell, cellIndex) => {
        Object.entries(cell.payoffs).forEach(([playerId, estimate]) => {
          for (const assumptionId of estimate.assumptions ?? []) {
            pushOwner(assumptionId, {
              kind: "normal_form_estimate",
              formalization_id: formalization.id,
              cell_index: cellIndex,
              player_id: playerId,
            });
          }
        });
      });
    }
  }

  for (const node of Object.values(canonical.nodes)) {
    for (const assumptionId of node.assumptions ?? []) {
      pushOwner(assumptionId, { kind: "game_node", id: node.id });
    }

    Object.entries(node.terminal_payoffs ?? {}).forEach(
      ([playerId, estimate]) => {
        for (const assumptionId of estimate.assumptions ?? []) {
          pushOwner(assumptionId, {
            kind: "terminal_estimate",
            node_id: node.id,
            player_id: playerId,
          });
        }
      },
    );
  }

  for (const edge of Object.values(canonical.edges)) {
    for (const assumptionId of edge.assumptions ?? []) {
      pushOwner(assumptionId, { kind: "game_edge", id: edge.id });
    }

    Object.entries(edge.payoff_delta ?? {}).forEach(([playerId, estimate]) => {
      for (const assumptionId of estimate.assumptions ?? []) {
        pushOwner(assumptionId, {
          kind: "edge_payoff_delta",
          edge_id: edge.id,
          player_id: playerId,
        });
      }
    });
  }

  return owners;
}

function gatherAffectedConclusions(
  canonical: CanonicalStore,
  assumptionId: string,
  owners: OwnerAttachment[],
): EntityRef[] {
  const refs: EntityRef[] = [];

  for (const owner of owners) {
    if (owner.kind === "game") {
      refs.push(asEntityRef("game", owner.id));
    } else if (
      owner.kind === "formalization" ||
      owner.kind === "normal_form_estimate"
    ) {
      refs.push(
        asEntityRef(
          "formalization",
          owner.kind === "formalization" ? owner.id : owner.formalization_id,
        ),
      );
    } else if (
      owner.kind === "game_node" ||
      owner.kind === "terminal_estimate"
    ) {
      const nodeId = owner.kind === "game_node" ? owner.id : owner.node_id;
      refs.push(asEntityRef("game_node", nodeId));
      const node = canonical.nodes[nodeId];
      if (node) {
        refs.push(asEntityRef("formalization", node.formalization_id));
      }
    } else if (
      owner.kind === "game_edge" ||
      owner.kind === "edge_payoff_delta"
    ) {
      const edgeId = owner.kind === "game_edge" ? owner.id : owner.edge_id;
      refs.push(asEntityRef("game_edge", edgeId));
      const edge = canonical.edges[edgeId];
      if (edge) {
        refs.push(asEntityRef("formalization", edge.formalization_id));
      }
    }
  }

  for (const scenario of Object.values(canonical.scenarios)) {
    if (scenario.key_assumptions.includes(assumptionId)) {
      refs.push(asEntityRef("scenario", scenario.id));
      refs.push(asEntityRef("formalization", scenario.formalization_id));
    }
  }

  return uniqueRefs(refs);
}

function collectCanonicalCandidates(
  canonical: CanonicalStore,
  ownerIndexes: Map<string, OwnerAttachment[]>,
): CandidateAssumption[] {
  return Object.values(canonical.assumptions).map((assumption) => {
    const owners = uniqueOwners(ownerIndexes.get(assumption.id) ?? []);
    return {
      existing_id: assumption.id,
      temp_id: assumption.id,
      statement: assumption.statement,
      type: assumption.type,
      owners,
      supported_by_ids: uniqueStrings(assumption.supported_by ?? []),
      contradicted_by_ids: uniqueStrings(assumption.contradicted_by ?? []),
      extra_evidence_refs: [],
      affected_conclusions: gatherAffectedConclusions(
        canonical,
        assumption.id,
        owners,
      ),
      game_theoretic_vs_empirical:
        assumption.game_theoretic_vs_empirical ?? "empirical",
      confidence_value: assumption.confidence,
    } satisfies CandidateAssumption;
  });
}

function collectHistoricalCandidates(
  canonical: CanonicalStore,
  historical: HistoricalGameResult | null,
): CandidateAssumption[] {
  if (!historical) {
    return [];
  }

  const candidates: CandidateAssumption[] = [];

  const repeatedGames = uniqueStrings(
    historical.patterns_found.map((pattern) => pattern.game_id),
  );
  for (const gameId of repeatedGames) {
    const game = canonical.games[gameId];
    candidates.push({
      existing_id: null,
      temp_id: createStableTempId(
        `The interaction in ${game?.name ?? gameId} remains strategically repeated rather than resetting to a one-shot encounter.`,
        gameId,
      ),
      statement: `The interaction in ${game?.name ?? gameId} remains strategically repeated rather than resetting to a one-shot encounter.`,
      type: "structural",
      owners: [{ kind: "game", id: gameId }],
      supported_by_ids: [],
      contradicted_by_ids: [],
      extra_evidence_refs: [],
      affected_conclusions: uniqueRefs([asEntityRef("game", gameId)]),
      game_theoretic_vs_empirical: "game_theoretic",
      confidence_value: 0.7,
    });
  }

  if (historical.baseline_recheck.hidden_type_uncertainty) {
    const gameId = repeatedGames[0] ?? Object.keys(canonical.games)[0];
    if (gameId) {
      candidates.push({
        existing_id: null,
        temp_id: createStableTempId(
          "Relevant player types, resolve, or private constraints remain partially hidden to opponents.",
          gameId,
        ),
        statement:
          "Relevant player types, resolve, or private constraints remain partially hidden to opponents.",
        type: "information",
        owners: [{ kind: "game", id: gameId }],
        supported_by_ids: [],
        contradicted_by_ids: [],
        extra_evidence_refs: [],
        affected_conclusions: uniqueRefs([asEntityRef("game", gameId)]),
        game_theoretic_vs_empirical: "game_theoretic",
        confidence_value: 0.68,
      });
    }
  }

  for (const assessment of historical.trust_assessment) {
    const targetLabel =
      canonical.players[assessment.target_player_id]?.name ??
      assessment.target_player_id;
    candidates.push({
      existing_id: null,
      temp_id: createStableTempId(
        `${targetLabel} will keep behaving in line with the current trust assessment rather than unexpectedly restoring cooperation.`,
        assessment.target_player_id,
      ),
      statement: `${targetLabel} will keep behaving in line with the current trust assessment rather than unexpectedly restoring cooperation.`,
      type: "behavioral",
      owners: [],
      supported_by_ids: assessment.evidence_refs
        .filter((ref) => ref.type === "claim" || ref.type === "inference")
        .map((ref) => ref.id),
      contradicted_by_ids: [],
      extra_evidence_refs: assessment.evidence_refs,
      affected_conclusions: assessment.driving_patterns,
      game_theoretic_vs_empirical: "empirical",
      confidence_value: assessment.posterior_belief.confidence ?? 0.66,
    });
  }

  for (const risk of historical.dynamic_inconsistency_risks) {
    const playerLabel =
      canonical.players[risk.player_id]?.name ?? risk.player_id;
    candidates.push({
      existing_id: null,
      temp_id: createStableTempId(
        `${playerLabel} can sustain the current commitment posture without a decisive internal reversal.`,
        risk.player_id,
      ),
      statement: `${playerLabel} can sustain the current commitment posture without a decisive internal reversal.`,
      type: "institutional",
      owners: [],
      supported_by_ids: risk.evidence_refs
        .filter((ref) => ref.type === "claim" || ref.type === "inference")
        .map((ref) => ref.id),
      contradicted_by_ids: [],
      extra_evidence_refs: risk.evidence_refs,
      affected_conclusions: risk.affected_games,
      game_theoretic_vs_empirical: "empirical",
      confidence_value:
        risk.durability === "durable"
          ? 0.76
          : risk.durability === "moderate"
            ? 0.66
            : 0.56,
    });
  }

  return candidates;
}

function synthesizeFormalizationAssumption(
  canonical: CanonicalStore,
  formalizationId: string,
  kind: Formalization["kind"],
): CandidateAssumption {
  const formalization = canonical.formalizations[formalizationId];
  const game = formalization ? canonical.games[formalization.game_id] : null;
  const statement =
    kind === "bargaining"
      ? `Bargaining dynamics remain the decisive analytical lens for ${game?.name ?? formalizationId}.`
      : kind === "signaling"
        ? `Observed communication in ${game?.name ?? formalizationId} is strategically informative rather than purely noise.`
        : kind === "bayesian"
          ? `Private information remains strategically important in ${game?.name ?? formalizationId}.`
          : `A ${humanizeKind(kind)} framing remains structurally appropriate for ${game?.name ?? formalizationId}.`;

  return {
    existing_id: null,
    temp_id: createStableTempId(statement, formalizationId),
    statement,
    type:
      kind === "signaling" || kind === "bayesian"
        ? "information"
        : "structural",
    owners: formalization
      ? [{ kind: "formalization", id: formalization.id }]
      : [],
    supported_by_ids: [],
    contradicted_by_ids: [],
    extra_evidence_refs: formalization
      ? [asEntityRef("formalization", formalization.id)]
      : [],
    affected_conclusions: formalization
      ? [asEntityRef("formalization", formalization.id)]
      : [],
    game_theoretic_vs_empirical: "game_theoretic",
    confidence_value: 0.72,
  };
}

function collectFormalizationCandidates(
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
): CandidateAssumption[] {
  if (!phase6) {
    return [];
  }

  const candidates: CandidateAssumption[] = [];

  for (const summary of phase6.formal_representations.summaries) {
    candidates.push(
      synthesizeFormalizationAssumption(
        canonical,
        summary.formalization_id,
        summary.kind,
      ),
    );
  }

  for (const selection of phase6.equilibrium_selection.selections) {
    const formalization = canonical.formalizations[selection.formalization_id];
    const game = formalization ? canonical.games[formalization.game_id] : null;
    candidates.push({
      existing_id: null,
      temp_id: createStableTempId(
        `Players in ${game?.name ?? selection.formalization_id} will keep selecting among plausible equilibria using the current focal, institutional, or commitment cues.`,
        selection.formalization_id,
      ),
      statement: `Players in ${game?.name ?? selection.formalization_id} will keep selecting among plausible equilibria using the current focal, institutional, or commitment cues.`,
      type: "rationality",
      owners: [{ kind: "formalization", id: selection.formalization_id }],
      supported_by_ids: [],
      contradicted_by_ids: [],
      extra_evidence_refs: [
        asEntityRef("formalization", selection.formalization_id),
      ],
      affected_conclusions: [
        asEntityRef("formalization", selection.formalization_id),
      ],
      game_theoretic_vs_empirical: "game_theoretic",
      confidence_value: 0.7,
    });
  }

  return candidates;
}

function mergeCandidates(
  candidates: CandidateAssumption[],
  canonical: CanonicalStore,
): CandidateAssumption[] {
  const canonicalByStatement = new Map<string, string>();
  for (const assumption of Object.values(canonical.assumptions)) {
    canonicalByStatement.set(
      normalizeStatement(assumption.statement),
      assumption.id,
    );
  }

  const merged = new Map<string, CandidateAssumption>();

  for (const candidate of candidates) {
    const normalized = normalizeStatement(candidate.statement);
    const existingId =
      candidate.existing_id ?? canonicalByStatement.get(normalized) ?? null;
    const key = existingId
      ? `existing:${existingId}`
      : `${normalized}:${JSON.stringify(candidate.owners[0] ?? null)}`;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, {
        ...candidate,
        existing_id: existingId,
      });
      continue;
    }

    merged.set(key, {
      ...current,
      owners: uniqueOwners([...current.owners, ...candidate.owners]),
      supported_by_ids: uniqueStrings([
        ...current.supported_by_ids,
        ...candidate.supported_by_ids,
      ]),
      contradicted_by_ids: uniqueStrings([
        ...current.contradicted_by_ids,
        ...candidate.contradicted_by_ids,
      ]),
      extra_evidence_refs: uniqueRefs([
        ...current.extra_evidence_refs,
        ...candidate.extra_evidence_refs,
      ]),
      affected_conclusions: uniqueRefs([
        ...current.affected_conclusions,
        ...candidate.affected_conclusions,
      ]),
      confidence_value: Math.max(
        current.confidence_value,
        candidate.confidence_value,
      ),
    });
  }

  return [...merged.values()].sort((left, right) =>
    left.statement.localeCompare(right.statement),
  );
}

function collectAssumptionSensitivities(
  formalizationId: string,
  getDerivedState: PipelineHost["getDerivedState"],
): AssumptionSensitivity[] {
  const state = getDerivedState();
  const analyses = state.sensitivityByFormalizationAndSolver[formalizationId];
  if (!analyses) {
    return [];
  }

  const entries = Object.values(analyses).flatMap(
    (analysis) => analysis?.assumption_sensitivities ?? [],
  );
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.assumption_id}:${entry.impact}:${entry.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function determineSensitivity(
  candidate: CandidateAssumption,
  phase6: FormalizationResult | null,
  getDerivedState: PipelineHost["getDerivedState"],
): ProposedAssumptionFull["sensitivity"] {
  const anchorFormalizationId =
    phase6?.formal_representations.summaries[0]?.formalization_id ?? null;
  const selectedFormalizationIds = new Set(
    phase6?.equilibrium_selection.selections.map(
      (entry) => entry.formalization_id,
    ) ?? [],
  );
  const affectedFormalizationIds = new Set(
    candidate.affected_conclusions
      .filter((ref) => ref.type === "formalization")
      .map((ref) => ref.id),
  );
  const sensitivityHits = [...affectedFormalizationIds].flatMap(
    (formalizationId) =>
      collectAssumptionSensitivities(formalizationId, getDerivedState),
  );

  const flipsResult = candidate.existing_id
    ? sensitivityHits.some(
        (entry) =>
          entry.assumption_id === candidate.existing_id &&
          entry.impact === "result_changes",
      )
    : sensitivityHits.some((entry) => entry.impact === "result_changes");

  const touchesAnchor = Boolean(
    (anchorFormalizationId &&
      affectedFormalizationIds.has(anchorFormalizationId)) ||
    [...selectedFormalizationIds].some((formalizationId) =>
      affectedFormalizationIds.has(formalizationId),
    ),
  );

  if (flipsResult) {
    return "critical";
  }
  if (touchesAnchor) {
    return "high";
  }
  if (candidate.affected_conclusions.length > 0) {
    return "medium";
  }
  return "low";
}

function buildWhatIfWrong(
  candidate: CandidateAssumption,
  sensitivity: ProposedAssumptionFull["sensitivity"],
  canonical: CanonicalStore,
): string {
  const formalizationLabels = candidate.affected_conclusions
    .filter((ref) => ref.type === "formalization")
    .map((ref) => canonical.formalizations[ref.id]?.kind ?? ref.id)
    .map((kind) => humanizeKind(kind as Formalization["kind"]));

  const scenarioLabels = candidate.affected_conclusions
    .filter((ref) => ref.type === "scenario")
    .map((ref) => canonical.scenarios[ref.id]?.name ?? ref.id);

  if (scenarioLabels.length > 0) {
    return sensitivity === "critical"
      ? `If wrong, the leading scenario read could flip and force a different forecast path for ${scenarioLabels.join(", ")}.`
      : `If wrong, downstream scenario confidence would need revision for ${scenarioLabels.join(", ")}.`;
  }

  if (formalizationLabels.length > 0) {
    return sensitivity === "critical"
      ? `If wrong, the current equilibrium or solver-backed read for ${formalizationLabels.join(", ")} could flip or require reframing.`
      : sensitivity === "high"
        ? `If wrong, the current formalization read for ${formalizationLabels.join(", ")} would materially change.`
        : `If wrong, the current formalization details for ${formalizationLabels.join(", ")} would need adjustment without discarding the whole model.`;
  }

  return sensitivity === "low"
    ? "If wrong, this would only change secondary details in the current analysis."
    : "If wrong, the current model would need revision before later phases can be trusted.";
}

function ownerSimilarity(
  left: Pick<
    FinalizedAssumption,
    "statement" | "supported_by_ids" | "affected_conclusions"
  >,
  right: Pick<
    FinalizedAssumption,
    "statement" | "supported_by_ids" | "affected_conclusions"
  >,
): boolean {
  const leftConclusions = new Set(
    left.affected_conclusions.map((ref) => `${ref.type}:${ref.id}`),
  );
  const rightConclusions = new Set(
    right.affected_conclusions.map((ref) => `${ref.type}:${ref.id}`),
  );
  const sharedConclusion = [...leftConclusions].some((key) =>
    rightConclusions.has(key),
  );
  if (sharedConclusion) {
    return true;
  }

  const leftSupport = new Set(left.supported_by_ids);
  const rightSupport = new Set(right.supported_by_ids);
  const sharedSupport = [...leftSupport].some((id) => rightSupport.has(id));
  if (sharedSupport) {
    return true;
  }

  const leftToken = pickTopToken(left.statement);
  const rightToken = pickTopToken(right.statement);
  return leftToken !== "assumption" && leftToken === rightToken;
}

function buildClusters(
  assumptions: FinalizedAssumption[],
  canonical: CanonicalStore,
): { assumptions: FinalizedAssumption[]; clusters: CorrelatedCluster[] } {
  const parent = new Map<string, string>();

  function find(id: string): string {
    const current = parent.get(id) ?? id;
    if (current === id) {
      return current;
    }
    const root = find(current);
    parent.set(id, root);
    return root;
  }

  function union(left: string, right: string): void {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) {
      parent.set(rightRoot, leftRoot);
    }
  }

  for (const assumption of assumptions) {
    parent.set(
      assumption.temp_id,
      assumption.correlated_cluster_id ?? assumption.temp_id,
    );
  }

  for (let index = 0; index < assumptions.length; index += 1) {
    for (
      let nextIndex = index + 1;
      nextIndex < assumptions.length;
      nextIndex += 1
    ) {
      if (ownerSimilarity(assumptions[index]!, assumptions[nextIndex]!)) {
        union(assumptions[index]!.temp_id, assumptions[nextIndex]!.temp_id);
      }
    }
  }

  const grouped = new Map<string, FinalizedAssumption[]>();
  for (const assumption of assumptions) {
    const root = find(assumption.temp_id);
    grouped.set(root, [...(grouped.get(root) ?? []), assumption]);
  }

  const clusters: CorrelatedCluster[] = [];
  const clusteredAssumptions = assumptions.map((assumption) => ({
    ...assumption,
  }));

  for (const group of grouped.values()) {
    if (group.length < 2) {
      continue;
    }

    const explicitId = group
      .map((entry) => entry.correlated_cluster_id)
      .find((value) => value);
    const topToken = pickTopToken(group[0]!.statement);
    const clusterId = explicitId ?? `cluster_${topToken}`;
    const affectedDomains = uniqueStrings(
      group.flatMap((entry) =>
        entry.affected_conclusions.map((ref) => {
          if (ref.type === "formalization") {
            const formalization = canonical.formalizations[ref.id];
            return formalization ? humanizeKind(formalization.kind) : ref.id;
          }
          if (ref.type === "game") {
            return canonical.games[ref.id]?.name ?? ref.id;
          }
          if (ref.type === "scenario") {
            return canonical.scenarios[ref.id]?.name ?? ref.id;
          }
          return ref.id;
        }),
      ),
    );

    clusters.push({
      id: clusterId,
      label: titleCase(clusterId.replace(/^cluster_/, "").replace(/_/g, " ")),
      description: `These assumptions move together because they share evidence, affected conclusions, or a common latent topic around ${topToken}.`,
      latent_factor: titleCase(topToken),
      assumption_ids: group.map((entry) => entry.temp_id).sort(),
      affected_domains: affectedDomains,
    });

    for (const assumption of clusteredAssumptions) {
      if (group.some((entry) => entry.temp_id === assumption.temp_id)) {
        assumption.correlated_cluster_id = clusterId;
      }
    }
  }

  clusters.sort((left, right) => left.id.localeCompare(right.id));
  clusteredAssumptions.sort((left, right) =>
    left.statement.localeCompare(right.statement),
  );
  return { assumptions: clusteredAssumptions, clusters };
}

function buildSensitivitySummary(
  assumptions: FinalizedAssumption[],
  clusters: CorrelatedCluster[],
): AssumptionExtractionResult["sensitivity_summary"] {
  return {
    critical_count: assumptions.filter(
      (assumption) => assumption.sensitivity === "critical",
    ).length,
    high_count: assumptions.filter(
      (assumption) => assumption.sensitivity === "high",
    ).length,
    medium_count: assumptions.filter(
      (assumption) => assumption.sensitivity === "medium",
    ).length,
    low_count: assumptions.filter(
      (assumption) => assumption.sensitivity === "low",
    ).length,
    inference_only_critical: assumptions.filter(
      (assumption) =>
        assumption.sensitivity === "critical" &&
        assumption.evidence_quality !== "direct_evidence",
    ).length,
    largest_cluster_size: clusters.reduce(
      (largest, cluster) => Math.max(largest, cluster.assumption_ids.length),
      0,
    ),
  };
}

function buildFinalizedAssumptions(
  candidates: CandidateAssumption[],
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
  getDerivedState: PipelineHost["getDerivedState"],
): FinalizedAssumption[] {
  return candidates.map((candidate) => {
    const evidenceQuality = inferEvidenceQuality(
      candidate.supported_by_ids,
      canonical,
    );
    const sensitivity = determineSensitivity(
      candidate,
      phase6,
      getDerivedState,
    );
    return {
      existing_id: candidate.existing_id,
      temp_id: candidate.existing_id ?? candidate.temp_id,
      statement: candidate.statement,
      type: candidate.type,
      sensitivity,
      what_if_wrong: buildWhatIfWrong(candidate, sensitivity, canonical),
      game_theoretic_vs_empirical: candidate.game_theoretic_vs_empirical,
      correlated_cluster_id: candidate.existing_id
        ? (canonical.assumptions[candidate.existing_id]
            ?.correlated_cluster_id ?? null)
        : null,
      evidence_quality: evidenceQuality,
      evidence_refs: uniqueRefs([
        ...candidate.extra_evidence_refs,
        ...candidate.supported_by_ids.map((id) =>
          id in canonical.claims
            ? asEntityRef("claim", id)
            : asEntityRef("inference", id),
        ),
      ]),
      affected_conclusions: uniqueRefs(candidate.affected_conclusions),
      confidence: confidenceForCandidate(candidate, evidenceQuality, canonical),
      supported_by_ids: candidate.supported_by_ids,
      contradicted_by_ids: candidate.contradicted_by_ids,
      owners: uniqueOwners(candidate.owners),
    };
  });
}

function sameStringArray(left: string[], right: string[]): boolean {
  const leftSorted = [...left].sort();
  const rightSorted = [...right].sort();
  return (
    leftSorted.length === rightSorted.length &&
    leftSorted.every((value, index) => value === rightSorted[index])
  );
}

function mostSpecificOwner(owners: OwnerAttachment[]): OwnerAttachment | null {
  const priorities: OwnerAttachment["kind"][] = [
    "normal_form_estimate",
    "terminal_estimate",
    "edge_payoff_delta",
    "game_node",
    "game_edge",
    "formalization",
    "game",
  ];

  for (const kind of priorities) {
    const owner = owners.find((candidate) => candidate.kind === kind);
    if (owner) {
      return owner;
    }
  }

  return null;
}

function attachAssumptionCommands(
  canonical: CanonicalStore,
  assumptionId: string,
  owners: OwnerAttachment[],
): Command[] {
  const owner = mostSpecificOwner(owners);
  if (!owner) {
    return [];
  }

  if (owner.kind === "game") {
    const game = canonical.games[owner.id];
    if (!game || game.key_assumptions.includes(assumptionId)) {
      return [];
    }
    return [
      {
        kind: "update_game",
        payload: {
          id: game.id,
          key_assumptions: [...game.key_assumptions, assumptionId],
        },
      },
    ];
  }

  if (owner.kind === "formalization") {
    const formalization = canonical.formalizations[owner.id];
    if (!formalization || formalization.assumptions.includes(assumptionId)) {
      return [];
    }
    return [
      {
        kind: "update_formalization",
        payload: {
          id: formalization.id,
          assumptions: [...formalization.assumptions, assumptionId],
        },
      },
    ];
  }

  if (owner.kind === "game_node") {
    const node = canonical.nodes[owner.id];
    const assumptions = node?.assumptions ?? [];
    if (!node || assumptions.includes(assumptionId)) {
      return [];
    }
    return [
      {
        kind: "update_game_node",
        payload: {
          id: node.id,
          assumptions: [...assumptions, assumptionId],
        },
      },
    ];
  }

  if (owner.kind === "game_edge") {
    const edge = canonical.edges[owner.id];
    const assumptions = edge?.assumptions ?? [];
    if (!edge || assumptions.includes(assumptionId)) {
      return [];
    }
    return [
      {
        kind: "update_game_edge",
        payload: {
          id: edge.id,
          assumptions: [...assumptions, assumptionId],
        },
      },
    ];
  }

  if (owner.kind === "normal_form_estimate") {
    const formalization = canonical.formalizations[owner.formalization_id];
    if (!formalization || formalization.kind !== "normal_form") {
      return [];
    }
    const cell = formalization.payoff_cells[owner.cell_index];
    const estimate = cell?.payoffs[owner.player_id];
    const assumptions = estimate?.assumptions ?? [];
    if (!cell || !estimate || assumptions.includes(assumptionId)) {
      return [];
    }
    const payoff_cells = formalization.payoff_cells.map(
      (existingCell, index) =>
        index === owner.cell_index
          ? {
              ...existingCell,
              payoffs: {
                ...existingCell.payoffs,
                [owner.player_id]: {
                  ...estimate,
                  assumptions: [...assumptions, assumptionId],
                },
              },
            }
          : existingCell,
    );
    return [
      {
        kind: "update_formalization",
        payload: {
          id: formalization.id,
          payoff_cells,
        },
      },
    ];
  }

  if (owner.kind === "terminal_estimate") {
    const node = canonical.nodes[owner.node_id];
    const estimate = node?.terminal_payoffs?.[owner.player_id];
    const assumptions = estimate?.assumptions ?? [];
    if (!node || !estimate || assumptions.includes(assumptionId)) {
      return [];
    }
    return [
      {
        kind: "update_game_node",
        payload: {
          id: node.id,
          terminal_payoffs: {
            ...(node.terminal_payoffs ?? {}),
            [owner.player_id]: {
              ...estimate,
              assumptions: [...assumptions, assumptionId],
            },
          },
        },
      },
    ];
  }

  const edge = canonical.edges[owner.edge_id];
  const estimate = edge?.payoff_delta?.[owner.player_id];
  const assumptions = estimate?.assumptions ?? [];
  if (!edge || !estimate || assumptions.includes(assumptionId)) {
    return [];
  }
  return [
    {
      kind: "update_game_edge",
      payload: {
        id: edge.id,
        payoff_delta: {
          ...(edge.payoff_delta ?? {}),
          [owner.player_id]: {
            ...estimate,
            assumptions: [...assumptions, assumptionId],
          },
        },
      },
    },
  ];
}

function buildProposal(
  context: Phase7RunnerContext,
  assumption: FinalizedAssumption,
): ModelProposal | null {
  const supported_by = uniqueStrings(
    assumption.supported_by_ids.filter(
      (id) =>
        id in context.canonical.claims || id in context.canonical.inferences,
    ),
  );
  const confidenceValue =
    assumption.confidence.value ?? assumption.confidence.confidence ?? 0.6;

  if (assumption.existing_id) {
    const existing = context.canonical.assumptions[assumption.existing_id];
    if (!existing) {
      return null;
    }

    const payload: Record<string, unknown> = { id: existing.id };
    if (existing.type !== assumption.type) {
      payload.type = assumption.type;
    }
    if (existing.sensitivity !== assumption.sensitivity) {
      payload.sensitivity = assumption.sensitivity;
    }
    if (
      (existing.game_theoretic_vs_empirical ?? "empirical") !==
      assumption.game_theoretic_vs_empirical
    ) {
      payload.game_theoretic_vs_empirical =
        assumption.game_theoretic_vs_empirical;
    }
    if (
      (existing.correlated_cluster_id ?? null) !==
      assumption.correlated_cluster_id
    ) {
      payload.correlated_cluster_id = assumption.correlated_cluster_id;
    }
    if (!sameStringArray(existing.supported_by ?? [], supported_by)) {
      payload.supported_by = supported_by;
    }
    if (Math.abs(existing.confidence - confidenceValue) >= 0.001) {
      payload.confidence = confidenceValue;
    }

    if (Object.keys(payload).length === 1) {
      return null;
    }

    const updateCommand: Command = {
      kind: "update_assumption",
      payload: payload as { id: string } & Partial<
        CanonicalStore["assumptions"][string]
      >,
    };

    return buildModelProposal({
      description: `Update assumption metadata for "${assumption.statement}".`,
      phase: 7,
      proposal_type: "assumption",
      phaseExecution: context.phaseExecution,
      baseRevision: context.baseRevision,
      commands: [updateCommand],
      entity_previews: [
        createEntityPreview("assumption", "update", existing.id, {
          statement: assumption.statement,
          sensitivity: assumption.sensitivity,
          game_theoretic_vs_empirical: assumption.game_theoretic_vs_empirical,
          correlated_cluster_id: assumption.correlated_cluster_id,
        }),
      ],
    });
  }

  const newId = assumption.temp_id;
  return buildModelProposal({
    description: `Add extracted assumption "${assumption.statement}".`,
    phase: 7,
    proposal_type: "assumption",
    phaseExecution: context.phaseExecution,
    baseRevision: context.baseRevision,
    commands: [
      {
        kind: "add_assumption",
        id: newId,
        payload: {
          statement: assumption.statement,
          type: assumption.type,
          sensitivity: assumption.sensitivity,
          confidence: confidenceValue,
          supported_by,
          game_theoretic_vs_empirical: assumption.game_theoretic_vs_empirical,
          correlated_cluster_id: assumption.correlated_cluster_id,
        },
      },
      ...attachAssumptionCommands(context.canonical, newId, assumption.owners),
    ],
    entity_previews: [
      createEntityPreview("assumption", "add", newId, {
        statement: assumption.statement,
        type: assumption.type,
        sensitivity: assumption.sensitivity,
        game_theoretic_vs_empirical: assumption.game_theoretic_vs_empirical,
      }),
    ],
  });
}

export function runPhase7Assumptions(
  context: Phase7RunnerContext,
): AssumptionExtractionResult {
  const historical = getHistoricalResult(context.phaseResults);
  const phase6 = getFormalizationResult(context.phaseResults);
  const ownerIndexes = buildOwnerIndexes(context.canonical);

  const mergedCandidates = mergeCandidates(
    [
      ...collectCanonicalCandidates(context.canonical, ownerIndexes),
      ...collectHistoricalCandidates(context.canonical, historical),
      ...collectFormalizationCandidates(context.canonical, phase6),
    ],
    context.canonical,
  );

  const finalized = buildFinalizedAssumptions(
    mergedCandidates,
    context.canonical,
    phase6,
    context.getDerivedState,
  );
  const clustered = buildClusters(finalized, context.canonical);
  const proposals = clustered.assumptions
    .map((assumption) => buildProposal(context, assumption))
    .filter((proposal): proposal is ModelProposal => proposal !== null);

  const gaps: string[] = [];
  if (clustered.assumptions.length === 0) {
    gaps.push("No assumptions were extracted from the accepted model state.");
  }
  if (
    clustered.assumptions.some(
      (assumption) =>
        assumption.sensitivity === "critical" &&
        assumption.evidence_quality !== "direct_evidence",
    )
  ) {
    gaps.push(
      "One or more critical assumptions rely on inference rather than direct evidence.",
    );
  }

  const status: PhaseResult = {
    status: "complete",
    phase: 7,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps,
  };

  return {
    phase: 7,
    status,
    assumptions: clustered.assumptions.map((assumption) => ({
      temp_id: assumption.temp_id,
      statement: assumption.statement,
      type: assumption.type,
      sensitivity: assumption.sensitivity,
      what_if_wrong: assumption.what_if_wrong,
      game_theoretic_vs_empirical: assumption.game_theoretic_vs_empirical,
      correlated_cluster_id: assumption.correlated_cluster_id,
      evidence_quality: assumption.evidence_quality,
      evidence_refs: assumption.evidence_refs,
      affected_conclusions: assumption.affected_conclusions,
      confidence: assumption.confidence,
    })),
    correlated_clusters: clustered.clusters,
    sensitivity_summary: buildSensitivitySummary(
      clustered.assumptions,
      clustered.clusters,
    ),
    proposals,
  };
}
