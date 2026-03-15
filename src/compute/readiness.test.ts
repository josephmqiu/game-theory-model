import { describe, expect, it } from 'vitest'

import { computeReadiness } from './readiness'
import { createEstimate, createNormalFormStore } from '../test-support/m4-fixtures'
import type { NormalFormModel } from '../types/formalizations'

describe('computeReadiness', () => {
  it('returns ready for a complete 2x2 normal-form game', () => {
    const store = createNormalFormStore()

    const report = computeReadiness(store.formalizations.formalization_1, store)

    expect(report.readiness.overall).toBe('ready')
    expect(report.readiness.supported_solvers).toContain('nash')
    expect(report.readiness.supported_solvers).toContain('dominance')
  })

  it('returns not_ready when payoff cells are missing', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel
    formalization.payoff_cells = formalization.payoff_cells.slice(0, 2)

    const report = computeReadiness(formalization, store)

    expect(report.readiness.overall).toBe('not_ready')
    expect(report.readiness.blockers.join(' ')).toContain('Missing payoff cells')
  })

  it('warns on stale assumptions and ordinal-only Nash inputs', () => {
    const store = createNormalFormStore()
    const formalization = store.formalizations.formalization_1 as NormalFormModel
    store.assumptions.assumption_1.stale_markers = [
      {
        reason: 'Evidence changed',
        stale_since: '2026-03-15T00:00:00Z',
        caused_by: { type: 'claim', id: 'claim_1' },
      },
    ]
    formalization.payoff_cells[0]!.payoffs.player_1 = createEstimate(1, {
      representation: 'ordinal_rank',
      value: undefined,
      ordinal_rank: 1,
    })

    const report = computeReadiness(formalization, store)

    expect(report.readiness.warnings.join(' ')).toContain('stale')
    expect(report.per_solver.nash?.blockers.join(' ')).toContain('Mixed-strategy Nash requires cardinal payoffs')
  })
})
