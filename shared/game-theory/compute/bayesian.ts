import type { CanonicalStore } from '../types/canonical'
import type { BayesianGameModel } from '../types/formalizations'
import type { BayesianStep, BayesianUpdateResult, PosteriorBelief } from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'

function orderedObservations(
  signals: NonNullable<BayesianGameModel['signal_structure']>['signals'],
): string[] {
  const seen = new Set<string>()
  const observations: string[] = []

  for (const signal of signals) {
    if (seen.has(signal.label)) {
      continue
    }

    seen.add(signal.label)
    observations.push(signal.label)
  }

  return observations
}

function normalizeDistribution(distribution: Record<string, number>): Record<string, number> {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0)
  if (total === 0) {
    return distribution
  }

  return Object.fromEntries(
    Object.entries(distribution).map(([label, value]) => [label, value / total]),
  )
}

function baseResult(formalization: BayesianGameModel, store: CanonicalStore): BayesianUpdateResult {
  return {
    id: crypto.randomUUID(),
    formalization_id: formalization.id,
    solver: 'bayesian_update',
    computed_at: new Date().toISOString(),
    readiness_snapshot: computeReadiness(formalization, store).readiness,
    status: 'success',
    warnings: [],
    meta: {
      method_id: 'bayesian_update_signal_structure',
      method_label: 'Bayesian Updating',
      limitations: ['Observations are inferred from the configured signal structure.'],
      assumptions_used: [],
    },
    posterior_beliefs: [],
    update_chain: [],
  }
}

export function computeBayesianUpdate(
  formalization: BayesianGameModel,
  store: CanonicalStore,
): BayesianUpdateResult {
  const gate = checkSolverGate('bayesian_update', formalization, store)
  const result = baseResult(formalization, store)

  if (!gate.eligible) {
    return {
      ...result,
      status: 'failed',
      warnings: [...gate.blockers, ...gate.warnings],
      error: gate.blockers[0] ?? 'Solver readiness gate failed.',
    }
  }

  const signals = formalization.signal_structure?.signals ?? []
  const uniqueObservations = orderedObservations(signals)
  const updateChain: BayesianStep[] = []
  const posteriorBeliefs: PosteriorBelief[] = []
  const warnings = new Set(gate.warnings)
  let successfulObservations = 0
  let totalObservations = 0

  for (const priorDistribution of formalization.priors) {
    let currentPrior = Object.fromEntries(
      priorDistribution.types.map((playerType) => [playerType.label, playerType.prior_probability]),
    )
    const evidenceUsed: string[] = []

    for (const observation of uniqueObservations) {
      totalObservations += 1

      const priorSnapshot = { ...currentPrior }
      const likelihood: Record<string, number> = {}
      let normalizer = 0
      for (const typeLabel of Object.keys(priorSnapshot)) {
        const signal = signals.find(
          (candidate) => candidate.label === observation && candidate.type_label === typeLabel,
        )
        const probability = signal?.probability ?? 0
        likelihood[typeLabel] = probability
        normalizer += priorSnapshot[typeLabel]! * probability
      }

      if (normalizer === 0) {
        warnings.add(`Observation "${observation}" rules out all types and was skipped.`)
        continue
      }

      const posteriorBeforeNormalization: Record<string, number> = {}
      for (const typeLabel of Object.keys(priorSnapshot)) {
        const rawPosterior = (priorSnapshot[typeLabel]! * likelihood[typeLabel]!) / normalizer
        const clampedPosterior = rawPosterior < 1e-10 ? 1e-10 : rawPosterior
        if (clampedPosterior !== rawPosterior) {
          warnings.add(`Near-zero posterior for type ${typeLabel} after observing "${observation}" — numerical precision limit reached.`)
        }
        posteriorBeforeNormalization[typeLabel] = clampedPosterior
      }
      const posterior = normalizeDistribution(posteriorBeforeNormalization)
      evidenceUsed.push(observation)

      updateChain.push({
        step: updateChain.length + 1,
        observation,
        prior: priorSnapshot,
        likelihood,
        posterior,
      })

      for (const [typeLabel, posteriorValue] of Object.entries(posterior)) {
        posteriorBeliefs.push({
          player_id: priorDistribution.player_id,
          type_label: typeLabel,
          prior: priorSnapshot[typeLabel] ?? 0,
          posterior: posteriorValue,
          evidence_used: [...evidenceUsed],
        })
      }

      currentPrior = posterior
      successfulObservations += 1
    }
  }

  if (posteriorBeliefs.length === 0 || successfulObservations === 0) {
    return {
      ...result,
      status: 'failed',
      warnings: [...warnings, 'All configured observations were inconsistent with the current priors and signal structure.'],
      error: 'All configured observations were inconsistent with the current priors and signal structure.',
    }
  }

  return {
    ...result,
    status: successfulObservations < totalObservations ? 'partial' : 'success',
    warnings: [...warnings],
    meta: {
      ...result.meta,
      method_id: 'bayesian_update_signal_structure_heuristic',
      assumptions_used: ['Approximate Bayesian update (heuristic)', 'Observations are applied sequentially in signal-list order.'],
    },
    posterior_beliefs: posteriorBeliefs,
    update_chain: updateChain,
  }
}
