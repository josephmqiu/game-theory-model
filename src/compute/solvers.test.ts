import { describe, expect, it } from 'vitest'

import { computeBayesianUpdate } from './bayesian'
import { solveBackwardInduction } from './backward-induction'
import { eliminateDominance } from './dominance'
import { solveNash } from './nash'
import { computeExpectedUtility } from './expected-utility'
import { analyzeSensitivity } from './sensitivity'
import {
  createBayesianStore,
  createEstimate,
  createExtensiveFormStore,
  createNormalFormStore,
} from '../test-support/m4-fixtures'
import type {
  BayesianGameModel,
  ExtensiveFormModel,
  NormalFormModel,
} from '../types/formalizations'

describe('M4 solvers', () => {
  it('finds the pure Nash equilibrium in prisoners dilemma', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel

    const result = solveNash(formalization, store)

    expect(result.status).toBe('success')
    expect(result.equilibria.some((equilibrium) => equilibrium.id === 'Defect__Defect')).toBe(true)
  })

  it('eliminates dominated strategies across rounds', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel
    formalization.strategies.player_1.push('Worse')
    formalization.payoff_cells.push(
      {
        strategy_profile: { player_1: 'Worse', player_2: 'Cooperate' },
        payoffs: { player_1: createEstimate(-1), player_2: createEstimate(2) },
      },
      {
        strategy_profile: { player_1: 'Worse', player_2: 'Defect' },
        payoffs: { player_1: createEstimate(-2), player_2: createEstimate(1) },
      },
    )

    const result = eliminateDominance(formalization, store)

    expect(result.eliminated_strategies.some((entry) => entry.strategy === 'Worse')).toBe(true)
    expect(result.rounds.length).toBeGreaterThan(0)
  })

  it('computes expected utility with uniform fallback', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel

    const result = computeExpectedUtility(formalization, store)

    expect(result.status).toBe('success')
    expect(result.warnings.join(' ')).toContain('uniform distribution')
    expect(result.player_utilities.player_1.best_response).toBe('Defect')
  })

  it('solves backward induction on a simple tree', () => {
    const store = createExtensiveFormStore()
    const formalization = store.formalizations.formalization_1 as ExtensiveFormModel

    const result = solveBackwardInduction(formalization, store)

    expect(result.status).toBe('success')
    expect(result.solution_path).toEqual(['edge_left'])
  })

  it('computes Bayesian posterior shifts', () => {
    const store = createBayesianStore()
    const formalization = store.formalizations.formalization_1 as BayesianGameModel

    const result = computeBayesianUpdate(formalization, store)

    expect(result.status).toBe('success')
    const toughPosterior = result.posterior_beliefs.find((belief) => belief.type_label === 'tough')
    expect(toughPosterior?.posterior).toBeGreaterThan(0.5)
  })

  it('produces a sensitivity analysis for Nash results', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel
    const result = solveNash(formalization, store)
    const sensitivity = analyzeSensitivity(formalization, result, store)

    expect(sensitivity.payoff_sensitivities.length).toBeGreaterThan(0)
    expect(['robust', 'sensitive', 'fragile']).toContain(sensitivity.overall_robustness)
  })
})
