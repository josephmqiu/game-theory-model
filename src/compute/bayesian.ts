import type { CanonicalStore } from '../types/canonical'
import type { BayesianGameModel } from '../types/formalizations'
import type { BayesianStep, BayesianUpdateResult, PosteriorBelief } from '../types/solver-results'
import { checkSolverGate, computeReadiness } from './readiness'

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
  const uniqueObservations = [...new Set(signals.map((signal) => signal.label))]
  const updateChain: BayesianStep[] = []
  const posteriorBeliefs: PosteriorBelief[] = []
  const warnings = [...gate.warnings]

  for (const priorDistribution of formalization.priors) {
    let currentPrior = Object.fromEntries(
      priorDistribution.types.map((playerType) => [playerType.label, playerType.prior_probability]),
    )
    let stepNumber = 1

    for (const observation of uniqueObservations) {
      const likelihood: Record<string, number> = {}
      let normalizer = 0
      for (const typeLabel of Object.keys(currentPrior)) {
        const signal = signals.find(
          (candidate) => candidate.label === observation && candidate.type_label === typeLabel,
        )
        const probability = signal?.probability ?? 0
        likelihood[typeLabel] = probability
        normalizer += currentPrior[typeLabel]! * probability
      }

      if (normalizer === 0) {
        return {
          ...result,
          status: 'failed',
          warnings: [...warnings, 'Observation rules out all types — check signal structure.'],
          error: 'Observation rules out all types — check signal structure.',
        }
      }

      const posterior: Record<string, number> = {}
      for (const typeLabel of Object.keys(currentPrior)) {
        const rawPosterior = (currentPrior[typeLabel]! * likelihood[typeLabel]!) / normalizer
        const clampedPosterior = rawPosterior < 1e-10 ? 1e-10 : rawPosterior
        if (clampedPosterior !== rawPosterior) {
          warnings.push(`Near-zero posterior for type ${typeLabel} — numerical precision limit reached.`)
        }
        posterior[typeLabel] = clampedPosterior
      }

      updateChain.push({
        step: stepNumber,
        observation,
        prior: currentPrior,
        likelihood,
        posterior,
      })
      currentPrior = posterior
      stepNumber += 1
    }

    for (const [typeLabel, posterior] of Object.entries(currentPrior)) {
      const originalPrior = priorDistribution.types.find((playerType) => playerType.label === typeLabel)?.prior_probability ?? 0
      posteriorBeliefs.push({
        player_id: priorDistribution.player_id,
        type_label: typeLabel,
        prior: originalPrior,
        posterior,
        evidence_used: uniqueObservations,
      })
    }
  }

  if (posteriorBeliefs.length === 0) {
    return {
      ...result,
      status: 'failed',
      warnings: [...warnings, 'Observation inconsistent with all types.'],
      error: 'Observation inconsistent with all types.',
    }
  }

  return {
    ...result,
    warnings,
    meta: {
      ...result.meta,
      method_id: 'bayesian_update_signal_structure_heuristic',
      assumptions_used: ['Approximate Bayesian update (heuristic)'],
    },
    posterior_beliefs: posteriorBeliefs,
    update_chain: updateChain,
  }
}
