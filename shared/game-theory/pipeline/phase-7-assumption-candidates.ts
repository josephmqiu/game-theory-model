import type { PipelineHost } from "./host";
import type {
  CanonicalStore,
  EntityRef,
  EstimateValue,
  Formalization,
} from "../types";
import type {
  FormalizationResult,
  HistoricalGameResult,
  PhaseExecution,
  ProposedAssumptionFull,
} from "../types/analysis-pipeline";
import { asEntityRef, createConfidenceEstimate } from "./helpers";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export interface Phase7RunnerContext {
  canonical: CanonicalStore;
  baseRevision: number;
  phaseExecution: PhaseExecution;
  phaseResults?: Record<number, unknown>;
  getDerivedState: PipelineHost["getDerivedState"];
}

export type OwnerAttachment =
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

export interface CandidateAssumption {
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

export interface FinalizedAssumption extends ProposedAssumptionFull {
  existing_id: string | null;
  supported_by_ids: string[];
  contradicted_by_ids: string[];
  owners: OwnerAttachment[];
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function getHistoricalResult(
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

export function getFormalizationResult(
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

export function normalizeStatement(statement: string): string {
  return statement
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function uniqueRefs(refs: EntityRef[]): EntityRef[] {
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

export function uniqueOwners(owners: OwnerAttachment[]): OwnerAttachment[] {
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

export function titleCase(value: string): string {
  return value
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function createStableTempId(
  statement: string,
  ownerKey?: string,
): string {
  const normalized =
    normalizeStatement(statement).replace(/\s+/g, "_").slice(0, 48) ||
    "assumption";
  const ownerSuffix = ownerKey
    ? normalizeStatement(ownerKey).replace(/\s+/g, "_").slice(0, 24)
    : "derived";
  return `assumption_temp_${normalized}_${ownerSuffix}`;
}

export function humanizeKind(kind: Formalization["kind"]): string {
  return kind.replace(/_/g, " ");
}

export function pickTopToken(statement: string): string {
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

export function inferEvidenceQuality(
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

export function confidenceForCandidate(
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

// ---------------------------------------------------------------------------
// Owner index building
// ---------------------------------------------------------------------------

export function buildOwnerIndexes(
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

// ---------------------------------------------------------------------------
// Affected conclusions
// ---------------------------------------------------------------------------

export function gatherAffectedConclusions(
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

// ---------------------------------------------------------------------------
// Candidate collection
// ---------------------------------------------------------------------------

export function collectCanonicalCandidates(
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

export function collectHistoricalCandidates(
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

export function collectFormalizationCandidates(
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

// ---------------------------------------------------------------------------
// Candidate merging
// ---------------------------------------------------------------------------

export function mergeCandidates(
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
