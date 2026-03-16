import type { CanonicalStore, EntityRef } from '../types'
import type {
  AdversarialChallenge,
  AdversarialResult,
  AssumptionExtractionResult,
  ChallengeCategory,
  FinalTestAnswer,
  FormalizationResult,
  MetaCheckAnswer,
  MetaCheckResult,
  PhaseExecution,
  PhaseResult,
  ScenarioGenerationResult,
} from '../types/analysis-pipeline'
import type { RevalidationTrigger } from '../types/evidence'
import { asEntityRef, createEntityId } from './helpers'

interface Phase10RunnerContext {
  canonical: CanonicalStore
  baseRevision: number
  phaseExecution: PhaseExecution
  phaseResults?: Record<number, unknown>
}

// ── Prior phase result accessors ──

function getFormalizationResult(phaseResults?: Record<number, unknown>): FormalizationResult | null {
  const result = phaseResults?.[6]
  return result && typeof result === 'object' && 'phase' in result && result.phase === 6
    ? (result as FormalizationResult)
    : null
}

function getAssumptionResult(phaseResults?: Record<number, unknown>): AssumptionExtractionResult | null {
  const result = phaseResults?.[7]
  return result && typeof result === 'object' && 'phase' in result && result.phase === 7
    ? (result as AssumptionExtractionResult)
    : null
}

function getScenarioResult(phaseResults?: Record<number, unknown>): ScenarioGenerationResult | null {
  const result = phaseResults?.[9]
  return result && typeof result === 'object' && 'phase' in result && result.phase === 9
    ? (result as ScenarioGenerationResult)
    : null
}

function hasPhase4History(phaseResults?: Record<number, unknown>): boolean {
  const result = phaseResults?.[4]
  return Boolean(result && typeof result === 'object' && 'phase' in result && result.phase === 4)
}

// ── A. Meta-check (10 questions) ──

const META_CHECK_QUESTIONS: readonly string[] = [
  'Which player have I spent the least time analyzing?',
  'Which game am I most confident about?',
  'What\'s the strongest counterargument to my central thesis?',
  'What information would most change my predictions?',
  'Which claim is most dependent on discretionary judgment rather than formal structure?',
  'Have I treated a public statement as more informative than it deserves?',
  'Have I treated a stated red line as lexicographic without evidence?',
  'Did I add complexity because the event is complex, or because I was reluctant to simplify?',
  'Could a smaller model explain 80% of the behavior just as well?',
  'Which adjacent analytical tool did I use, and did I label it correctly?',
] as const

function countPlayerReferences(canonical: CanonicalStore): Map<string, number> {
  const counts = new Map<string, number>()
  for (const playerId of Object.keys(canonical.players)) {
    counts.set(playerId, 0)
  }

  for (const game of Object.values(canonical.games)) {
    for (const playerId of game.players) {
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
    }
  }

  for (const formalization of Object.values(canonical.formalizations)) {
    for (const playerId of Object.keys(formalization.strategies)) {
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1)
    }
  }

  for (const assumption of Object.values(canonical.assumptions)) {
    for (const ref of assumption.supported_by ?? []) {
      if (counts.has(ref)) {
        counts.set(ref, (counts.get(ref) ?? 0) + 1)
      }
    }
  }

  return counts
}

function answerQ1LeastAnalyzedPlayer(
  canonical: CanonicalStore,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  const counts = countPlayerReferences(canonical)
  const players = Object.values(canonical.players)

  if (players.length === 0) {
    return {
      answer: 'No players in the model to analyze.',
      concern_level: 'significant',
      revision_triggered: 'new_player_discovered',
      evidence_refs: [],
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => a[1] - b[1])
  const [leastId, leastCount] = sorted[0]!
  const maxCount = sorted[sorted.length - 1]![1]
  const leastPlayer = canonical.players[leastId]
  const ratio = maxCount > 0 ? leastCount / maxCount : 1

  return {
    answer: `"${leastPlayer?.name ?? leastId}" has the fewest model references (${leastCount}). Ratio to most-analyzed: ${ratio.toFixed(2)}.`,
    concern_level: ratio < 0.5 ? 'minor' : 'none',
    revision_triggered: null,
    evidence_refs: [asEntityRef('player', leastId)],
  }
}

function answerQ2MostConfidentGame(
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  if (!phase6 || phase6.baseline_equilibria.analyses.length === 0) {
    return {
      answer: 'No equilibrium analyses available to assess confidence.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  let bestId = ''
  let bestScore = 0
  for (const analysis of phase6.baseline_equilibria.analyses) {
    const score = analysis.readiness.completeness_score * analysis.readiness.confidence_floor
    if (score > bestScore) {
      bestScore = score
      bestId = analysis.formalization_id
    }
  }

  const gameId = canonical.formalizations[bestId]?.game_id
  const gameName = gameId ? canonical.games[gameId]?.name ?? gameId : bestId

  return {
    answer: `"${gameName}" (formalization ${bestId}) has the highest combined confidence score (${bestScore.toFixed(2)}).`,
    concern_level: bestScore > 0.85 ? 'minor' : 'none',
    revision_triggered: null,
    evidence_refs: gameId ? [asEntityRef('game', gameId)] : [],
  }
}

function answerQ3StrongestCounterargument(
  phase7: AssumptionExtractionResult | null,
  phase9: ScenarioGenerationResult | null,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  if (!phase9 || !phase7) {
    return {
      answer: 'Central thesis or assumptions not available; cannot identify counterargument.',
      concern_level: 'minor',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const criticalInferenceOnly = phase7.assumptions.filter(
    (a) => a.sensitivity === 'critical' && a.evidence_quality !== 'direct_evidence',
  )

  if (criticalInferenceOnly.length === 0) {
    return {
      answer: 'No critical assumptions rely solely on inference; central thesis is well-grounded in evidence.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const strongest = criticalInferenceOnly[0]!
  return {
    answer: `Strongest counterargument: the critical assumption "${strongest.statement}" rests on ${strongest.evidence_quality} evidence. If wrong: ${strongest.what_if_wrong}`,
    concern_level: 'significant',
    revision_triggered: 'model_cannot_explain_fact',
    evidence_refs: strongest.evidence_refs,
  }
}

function answerQ4InformationThatWouldChange(
  phase7: AssumptionExtractionResult | null,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  if (!phase7) {
    return {
      answer: 'Assumption data not available.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const assumptionOnly = phase7.assumptions.filter(
    (a) => a.sensitivity === 'critical' && a.evidence_quality === 'assumption_only',
  )

  if (assumptionOnly.length === 0) {
    const inferenceOnly = phase7.assumptions.filter(
      (a) => a.sensitivity === 'critical' && a.evidence_quality === 'inference',
    )
    if (inferenceOnly.length === 0) {
      return {
        answer: 'All critical assumptions have direct evidence. No single piece of information would dramatically shift predictions.',
        concern_level: 'none',
        revision_triggered: null,
        evidence_refs: [],
      }
    }
    return {
      answer: `${inferenceOnly.length} critical assumption(s) rely on inference. Direct evidence for "${inferenceOnly[0]!.statement}" would most change predictions.`,
      concern_level: 'minor',
      revision_triggered: null,
      evidence_refs: inferenceOnly[0]!.evidence_refs,
    }
  }

  return {
    answer: `${assumptionOnly.length} critical assumption(s) have no supporting evidence. Direct evidence for "${assumptionOnly[0]!.statement}" would most change predictions.`,
    concern_level: 'minor',
    revision_triggered: null,
    evidence_refs: assumptionOnly[0]!.evidence_refs,
  }
}

function answerQ5DiscretionaryJudgment(
  phase9: ScenarioGenerationResult | null,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  if (!phase9 || phase9.proposed_scenarios.length === 0) {
    return {
      answer: 'No scenarios to assess forecast basis.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const discretionary = phase9.proposed_scenarios.filter(
    (s) => s.forecast_basis === 'discretionary' || s.forecast_basis === 'mixed',
  )
  const ratio = discretionary.length / phase9.proposed_scenarios.length

  return {
    answer: `${discretionary.length} of ${phase9.proposed_scenarios.length} scenarios (${(ratio * 100).toFixed(0)}%) rely on discretionary or mixed judgment rather than formal equilibrium structure.`,
    concern_level: ratio > 0.5 ? 'minor' : 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function answerQ6PublicStatements(
  canonical: CanonicalStore,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  const signalCount = Object.keys(canonical.signal_classifications).length
  if (signalCount === 0) {
    return {
      answer: 'No signal classifications in the model to assess statement informativeness.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  return {
    answer: `${signalCount} signal classification(s) exist. Heuristic mode cannot determine if any were over-weighted; review recommended.`,
    concern_level: 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function answerQ7RedLines(
  canonical: CanonicalStore,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  const escalationCount = Object.keys(canonical.escalation_ladders).length
  return {
    answer: escalationCount > 0
      ? `${escalationCount} escalation ladder(s) define rung-based thresholds. Whether any stated red line is treated as lexicographic should be verified against observed behavior.`
      : 'No escalation ladders in the model. Red-line treatment check is not applicable.',
    concern_level: 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function answerQ8Complexity(
  canonical: CanonicalStore,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  const gameCount = Object.keys(canonical.games).length
  const formalizationCount = Object.keys(canonical.formalizations).length

  return {
    answer: `The model contains ${gameCount} game(s) and ${formalizationCount} formalization(s). ${gameCount > 3 ? 'Consider whether all games are necessary or if some can be consolidated.' : 'The model size appears proportionate.'}`,
    concern_level: 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function answerQ9SmallerModel(
  canonical: CanonicalStore,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  const gameCount = Object.keys(canonical.games).length
  const playerCount = Object.keys(canonical.players).length

  if (gameCount <= 1 && playerCount <= 2) {
    return {
      answer: 'The current model is already minimal (1 game, 2 or fewer players).',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  return {
    answer: `With ${gameCount} game(s) and ${playerCount} player(s), a simpler 2-player single-game model may capture the core tension. This should be validated against explanatory power.`,
    concern_level: 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function answerQ10AdjacentTools(
  phase6: FormalizationResult | null,
): Pick<MetaCheckAnswer, 'answer' | 'concern_level' | 'revision_triggered' | 'evidence_refs'> {
  if (!phase6 || !phase6.behavioral_overlays) {
    return {
      answer: 'No adjacent analytical tools (behavioral overlays) were applied in this analysis.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const overlays = phase6.behavioral_overlays.overlays
  if (overlays.length === 0) {
    return {
      answer: 'Behavioral overlay section exists but no overlays were identified.',
      concern_level: 'none',
      revision_triggered: null,
      evidence_refs: [],
    }
  }

  const labels = overlays.map((o) => o.label).join(', ')
  return {
    answer: `Adjacent tools used: ${labels}. All are labeled under "${phase6.behavioral_overlays.label}".`,
    concern_level: 'none',
    revision_triggered: null,
    evidence_refs: [],
  }
}

function buildMetaCheckAnswers(
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
  phase7: AssumptionExtractionResult | null,
  phase9: ScenarioGenerationResult | null,
): MetaCheckAnswer[] {
  const answerFunctions = [
    () => answerQ1LeastAnalyzedPlayer(canonical),
    () => answerQ2MostConfidentGame(canonical, phase6),
    () => answerQ3StrongestCounterargument(phase7, phase9),
    () => answerQ4InformationThatWouldChange(phase7),
    () => answerQ5DiscretionaryJudgment(phase9),
    () => answerQ6PublicStatements(canonical),
    () => answerQ7RedLines(canonical),
    () => answerQ8Complexity(canonical),
    () => answerQ9SmallerModel(canonical),
    () => answerQ10AdjacentTools(phase6),
  ]

  return answerFunctions.map((fn, index) => {
    const result = fn()
    return {
      question_number: index + 1,
      question: META_CHECK_QUESTIONS[index]!,
      ...result,
    }
  })
}

// ── B. Final test (6 questions) ──

const FINAL_TEST_QUESTIONS: readonly string[] = [
  'What is the smallest game that captures the core strategic tension?',
  'What did the repeated interaction history do to today\'s incentives and beliefs?',
  'Which strategies are actually feasible once institutional, domestic, and escalation constraints are added?',
  'What equilibrium or near-equilibrium behavior follows from that structure?',
  'Which parts of the final forecast come from the model, and which come from analyst judgment?',
  'What specific evidence would change the central prediction?',
] as const

function answerFT1SmallestGame(
  canonical: CanonicalStore,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  const games = Object.values(canonical.games)
  if (games.length === 0) {
    return {
      answer: 'No games exist in the model.',
      completeness: 'cannot_answer',
      gap_description: 'At least one strategic game is required to identify the core tension.',
    }
  }

  const sorted = [...games].sort((a, b) => {
    const aSize = a.players.length * a.formalizations.length
    const bSize = b.players.length * b.formalizations.length
    return aSize - bSize
  })

  const smallest = sorted[0]!
  return {
    answer: `"${smallest.name}" with ${smallest.players.length} player(s) and ${smallest.formalizations.length} formalization(s) is the smallest game in the model.`,
    completeness: 'fully_answered',
    gap_description: null,
  }
}

function answerFT2RepeatedHistory(
  phaseResults?: Record<number, unknown>,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  if (!hasPhase4History(phaseResults)) {
    return {
      answer: 'Phase 4 history results are not available.',
      completeness: 'partially_answered',
      gap_description: 'Phase 4 repeated-game history analysis was not run or not provided.',
    }
  }

  return {
    answer: 'Phase 4 history data exists. Repeated interaction patterns, trust assessments, and dynamic inconsistency risks have been mapped into the model, shaping current incentive and belief structures.',
    completeness: 'fully_answered',
    gap_description: null,
  }
}

function answerFT3FeasibleStrategies(
  canonical: CanonicalStore,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  const gamesWithConstraints = Object.values(canonical.games).filter(
    (game) => game.institutional_constraints && game.institutional_constraints.length > 0,
  )

  if (gamesWithConstraints.length === 0) {
    const gameCount = Object.keys(canonical.games).length
    if (gameCount === 0) {
      return {
        answer: 'No games in the model.',
        completeness: 'cannot_answer',
        gap_description: 'Games are required to assess strategy feasibility.',
      }
    }

    const allStrategies = Object.values(canonical.formalizations).flatMap((f) =>
      Object.entries(f.strategies).flatMap(([playerId, strategies]) =>
        strategies.map((s) => `${canonical.players[playerId]?.name ?? playerId}: ${s}`),
      ),
    )

    return {
      answer: `No institutional constraints recorded. All ${allStrategies.length} strategies from formalizations are considered feasible by default.`,
      completeness: 'partially_answered',
      gap_description: 'No institutional constraints have been added to any game.',
    }
  }

  const constraintSummary = gamesWithConstraints
    .map((g) => `"${g.name}": ${g.institutional_constraints!.length} constraint(s)`)
    .join('; ')

  return {
    answer: `Institutional constraints exist in ${gamesWithConstraints.length} game(s): ${constraintSummary}. Strategies must satisfy these constraints to be feasible.`,
    completeness: 'fully_answered',
    gap_description: null,
  }
}

function answerFT4Equilibrium(
  phase6: FormalizationResult | null,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  if (!phase6) {
    return {
      answer: 'Phase 6 formalization results are not available.',
      completeness: 'partially_answered',
      gap_description: 'Equilibrium analysis requires Phase 6 formalization results.',
    }
  }

  const analyses = phase6.baseline_equilibria.analyses
  const successCount = analyses.filter(
    (a) => a.solver_summaries.some((s) => s.status === 'success'),
  ).length

  if (analyses.length === 0) {
    return {
      answer: 'No equilibrium analyses were performed.',
      completeness: 'partially_answered',
      gap_description: 'No formalization analyses available from Phase 6.',
    }
  }

  const totalEquilibria = analyses.reduce(
    (sum, a) => sum + a.solver_summaries.reduce((s, solver) => s + (solver.equilibrium_count ?? 0), 0),
    0,
  )

  return {
    answer: `${successCount} of ${analyses.length} formalization(s) have successful equilibrium analysis, identifying ${totalEquilibria} equilibrium/equilibria total.`,
    completeness: successCount > 0 ? 'fully_answered' : 'partially_answered',
    gap_description: successCount === 0 ? 'No solvers succeeded in computing equilibria.' : null,
  }
}

function answerFT5ModelVsJudgment(
  phase9: ScenarioGenerationResult | null,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  if (!phase9 || phase9.proposed_scenarios.length === 0) {
    return {
      answer: 'No scenarios available to decompose forecast sources.',
      completeness: 'partially_answered',
      gap_description: 'Phase 9 scenario generation did not produce scenarios.',
    }
  }

  const equilibriumCount = phase9.proposed_scenarios.filter((s) => s.forecast_basis === 'equilibrium').length
  const discretionaryCount = phase9.proposed_scenarios.filter((s) => s.forecast_basis === 'discretionary').length
  const mixedCount = phase9.proposed_scenarios.filter((s) => s.forecast_basis === 'mixed').length

  return {
    answer: `Of ${phase9.proposed_scenarios.length} scenario(s): ${equilibriumCount} equilibrium-based, ${discretionaryCount} discretionary, ${mixedCount} mixed. Central thesis forecast basis: ${phase9.central_thesis.forecast_basis}.`,
    completeness: 'fully_answered',
    gap_description: null,
  }
}

function answerFT6EvidenceThatWouldChange(
  phase7: AssumptionExtractionResult | null,
  phase9: ScenarioGenerationResult | null,
): Pick<FinalTestAnswer, 'answer' | 'completeness' | 'gap_description'> {
  const conditions: string[] = []

  if (phase9) {
    conditions.push(`Thesis falsification: ${phase9.central_thesis.falsification_condition}`)
  }

  if (phase7) {
    const critical = phase7.assumptions.filter((a) => a.sensitivity === 'critical')
    for (const assumption of critical.slice(0, 3)) {
      conditions.push(`If "${assumption.statement}" is falsified: ${assumption.what_if_wrong}`)
    }
  }

  if (conditions.length === 0) {
    return {
      answer: 'No falsification conditions or critical assumptions available.',
      completeness: 'partially_answered',
      gap_description: 'Phase 7 and Phase 9 data needed to identify prediction-changing evidence.',
    }
  }

  return {
    answer: conditions.join(' | '),
    completeness: 'fully_answered',
    gap_description: null,
  }
}

function buildFinalTestAnswers(
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
  phase7: AssumptionExtractionResult | null,
  phase9: ScenarioGenerationResult | null,
  phaseResults?: Record<number, unknown>,
): FinalTestAnswer[] {
  const answerFunctions = [
    () => answerFT1SmallestGame(canonical),
    () => answerFT2RepeatedHistory(phaseResults),
    () => answerFT3FeasibleStrategies(canonical),
    () => answerFT4Equilibrium(phase6),
    () => answerFT5ModelVsJudgment(phase9),
    () => answerFT6EvidenceThatWouldChange(phase7, phase9),
  ]

  return answerFunctions.map((fn, index) => ({
    question_number: index + 1,
    question: FINAL_TEST_QUESTIONS[index]!,
    ...fn(),
  }))
}

// ── C. Adversarial challenge ──

function buildAdversarialChallenges(
  canonical: CanonicalStore,
  phase6: FormalizationResult | null,
  phase7: AssumptionExtractionResult | null,
  phase9: ScenarioGenerationResult | null,
): AdversarialChallenge[] {
  const challenges: AdversarialChallenge[] = []

  // Omitted actor check
  const playerCount = Object.keys(canonical.players).length
  if (playerCount < 3) {
    challenges.push(makeChallenge(
      'omitted_actor',
      null,
      'medium',
      `Only ${playerCount} player(s) in the model. Strategic situations often involve additional stakeholders, gatekeepers, or background players whose influence is undermodeled.`,
      'Consider adding involuntary, background, or gatekeeper players to capture indirect effects.',
      [],
    ))
  }

  // Overconfident payoff check
  for (const formalization of Object.values(canonical.formalizations)) {
    if (formalization.kind !== 'normal_form') {
      continue
    }
    for (const cell of formalization.payoff_cells) {
      for (const [playerId, estimate] of Object.entries(cell.payoffs)) {
        if (estimate.confidence > 0.9) {
          challenges.push(makeChallenge(
            'overconfident_payoff',
            asEntityRef('formalization', formalization.id),
            'medium',
            `Payoff estimate for ${canonical.players[playerId]?.name ?? playerId} in formalization ${formalization.id} has confidence ${estimate.confidence.toFixed(2)}, which may reflect overconfidence.`,
            'Review the evidence basis for this payoff estimate and consider widening the confidence interval.',
            [asEntityRef('formalization', formalization.id)],
          ))
          break
        }
      }
    }
  }

  // Evidence quality check
  if (phase7) {
    const weakCritical = phase7.assumptions.filter(
      (a) => a.sensitivity === 'critical'
        && (a.evidence_quality === 'inference' || a.evidence_quality === 'assumption_only'),
    )
    for (const assumption of weakCritical) {
      challenges.push(makeChallenge(
        'evidence_quality',
        asEntityRef('assumption', assumption.temp_id),
        'high',
        `Critical assumption "${assumption.statement}" relies on ${assumption.evidence_quality} evidence. The analysis rests on an insufficiently grounded foundation.`,
        `Seek direct evidence for this assumption or downgrade its role in the model.`,
        assumption.affected_conclusions,
      ))
    }
  }

  // Framing choice check
  const gameCount = Object.keys(canonical.games).length
  if (gameCount === 1) {
    const gameId = Object.keys(canonical.games)[0]!
    challenges.push(makeChallenge(
      'framing_choice',
      asEntityRef('game', gameId),
      'low',
      'Only one game exists in the model. The framing choice itself is a key analytical decision that has not been contested with alternative formulations.',
      'Consider whether the strategic situation could be framed differently (e.g., repeated vs. one-shot, bargaining vs. signaling).',
      [asEntityRef('game', gameId)],
    ))
  }

  // Naive independence check
  if (phase7 && phase9) {
    const clusterIds = new Set(phase7.correlated_clusters.map((c) => c.id))
    if (clusterIds.size > 0) {
      const scenarioRefs = phase9.proposed_scenarios.flatMap((s) =>
        s.key_assumptions.map((a) => a.assumption_ref.id),
      )
      const scenarioAssumptionIds = new Set(scenarioRefs)
      const clusteredAssumptionIds = new Set(
        phase7.correlated_clusters.flatMap((c) => c.assumption_ids),
      )
      const referencedClusterAssumptions = [...clusteredAssumptionIds].filter(
        (id) => scenarioAssumptionIds.has(id),
      )

      if (referencedClusterAssumptions.length === 0 && clusteredAssumptionIds.size > 0) {
        challenges.push(makeChallenge(
          'naive_independence',
          null,
          'medium',
          `${clusterIds.size} correlated assumption cluster(s) exist, but scenarios do not reference any clustered assumptions. Correlations between assumptions may be ignored in the forecast.`,
          'Verify that scenario probabilities account for correlated assumption clusters.',
          [],
        ))
      }
    }
  }

  return challenges
}

function makeChallenge(
  category: ChallengeCategory,
  target: EntityRef | null,
  severity: AdversarialChallenge['severity'],
  challenge: string,
  suggestedRevision: string,
  affectedConclusions: EntityRef[],
): AdversarialChallenge {
  return {
    id: createEntityId('challenge'),
    category,
    target,
    severity,
    challenge,
    evidence_against: [],
    suggested_revision: suggestedRevision,
    affected_conclusions: affectedConclusions,
    response_status: 'unaddressed',
    analyst_response: null,
  }
}

function assessOverall(challenges: AdversarialChallenge[]): AdversarialResult['overall_assessment'] {
  const criticalAndHigh = challenges.filter(
    (c) => c.severity === 'critical' || c.severity === 'high',
  ).length

  if (criticalAndHigh === 0) {
    return 'robust'
  }
  if (criticalAndHigh <= 2) {
    return 'defensible'
  }
  if (criticalAndHigh <= 5) {
    return 'vulnerable'
  }
  return 'flawed'
}

// ── D. Completeness determination ──

function determineCompleteness(
  metaCheckAnswers: MetaCheckAnswer[],
  finalTestAnswers: FinalTestAnswer[],
): boolean {
  const hasCannotAnswer = finalTestAnswers.some(
    (ft) => ft.completeness === 'cannot_answer',
  )
  if (hasCannotAnswer) {
    return false
  }

  const hasCriticalWithRevision = metaCheckAnswers.some(
    (mc) => mc.concern_level === 'critical' && mc.revision_triggered !== null,
  )
  if (hasCriticalWithRevision) {
    return false
  }

  return true
}

function collectRevisionsTriggers(
  metaCheckAnswers: MetaCheckAnswer[],
): RevalidationTrigger[] {
  const triggers: RevalidationTrigger[] = []
  const seen = new Set<string>()

  for (const answer of metaCheckAnswers) {
    if (answer.revision_triggered !== null && !seen.has(answer.revision_triggered)) {
      seen.add(answer.revision_triggered)
      triggers.push(answer.revision_triggered)
    }
  }

  return triggers
}

// ── Main runner ──

export function runPhase10MetaCheck(
  context: Phase10RunnerContext,
): MetaCheckResult {
  const phase6 = getFormalizationResult(context.phaseResults)
  const phase7 = getAssumptionResult(context.phaseResults)
  const phase9 = getScenarioResult(context.phaseResults)

  const metaCheckAnswers = buildMetaCheckAnswers(
    context.canonical,
    phase6,
    phase7,
    phase9,
  )

  const finalTestAnswers = buildFinalTestAnswers(
    context.canonical,
    phase6,
    phase7,
    phase9,
    context.phaseResults,
  )

  const challenges = buildAdversarialChallenges(
    context.canonical,
    phase6,
    phase7,
    phase9,
  )

  const adversarialResult: AdversarialResult = {
    challenges,
    overall_assessment: assessOverall(challenges),
  }

  const revisionsTriggered = collectRevisionsTriggers(metaCheckAnswers)
  const analysisComplete = determineCompleteness(metaCheckAnswers, finalTestAnswers)

  const gaps: string[] = []
  if (!phase6) {
    gaps.push('Phase 6 formalization results not available.')
  }
  if (!phase7) {
    gaps.push('Phase 7 assumption results not available.')
  }
  if (!phase9) {
    gaps.push('Phase 9 scenario results not available.')
  }

  const status: PhaseResult = {
    status: 'complete',
    phase: 10,
    execution_id: context.phaseExecution.id,
    retriable: true,
    gaps: gaps.length > 0 ? gaps : undefined,
  }

  return {
    phase: 10,
    status,
    meta_check_answers: metaCheckAnswers,
    final_test_answers: finalTestAnswers,
    adversarial_result: adversarialResult,
    revisions_triggered: revisionsTriggered,
    analysis_complete: analysisComplete,
  }
}
