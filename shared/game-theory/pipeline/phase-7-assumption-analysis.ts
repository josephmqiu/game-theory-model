import type { Command } from "../engine/commands";
import type { PipelineHost } from "./host";
import type { CanonicalStore, Formalization } from "../types";
import type {
  AssumptionExtractionResult,
  CorrelatedCluster,
  FormalizationResult,
  ModelProposal,
  ProposedAssumptionFull,
} from "../types/analysis-pipeline";
import type { AssumptionSensitivity } from "../types/solver-results";
import {
  asEntityRef,
  buildModelProposal,
  createEntityPreview,
} from "./helpers";
import type {
  CandidateAssumption,
  FinalizedAssumption,
  OwnerAttachment,
  Phase7RunnerContext,
} from "./phase-7-assumption-candidates";
import {
  confidenceForCandidate,
  humanizeKind,
  inferEvidenceQuality,
  pickTopToken,
  titleCase,
  uniqueOwners,
  uniqueRefs,
  uniqueStrings,
} from "./phase-7-assumption-candidates";

// ---------------------------------------------------------------------------
// Sensitivity analysis
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

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

export function buildClusters(
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

export function buildSensitivitySummary(
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

// ---------------------------------------------------------------------------
// Finalization
// ---------------------------------------------------------------------------

export function buildFinalizedAssumptions(
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

// ---------------------------------------------------------------------------
// Command generation
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Proposal building
// ---------------------------------------------------------------------------

export function buildProposal(
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
