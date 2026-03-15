import { beforeEach, describe, expect, it } from 'vitest'

import { createAppStore } from './app-store'
import { ensureReadiness, getDerivedStore, resetDerivedState, runSolver } from './derived'
import { createEstimate, createNormalFormStore } from '../test-support/m4-fixtures'

describe('derived store invalidation', () => {
  beforeEach(() => {
    resetDerivedState()
  })

  function seedAppStore() {
    const appStore = createAppStore()
    const store = createNormalFormStore()
    appStore.setState({
      canonical: store,
      inverseIndex: {},
      fileMeta: { path: null, meta: null, lastSaved: null, dirty: false, error: null },
      recovery: { active: false },
      eventLog: appStore.getState().eventLog,
      viewState: appStore.getState().viewState,
    })
    return { appStore, store }
  }

  it('marks affected formalizations dirty after a payoff update', () => {
    const { appStore, store } = seedAppStore()

    ensureReadiness('formalization_1', store)
    expect(getDerivedStore().getState().dirtyFormalizations.formalization_1).toBe(false)

    appStore.getState().dispatch({
      kind: 'update_normal_form_payoff',
      payload: {
        formalization_id: 'formalization_1',
        cell_index: 0,
        player_id: 'player_1',
        value: createEstimate(9),
      },
    })

    expect(getDerivedStore().getState().dirtyFormalizations.formalization_1).toBe(true)
  })

  it('marks referenced formalizations dirty after deleting a player', () => {
    const { appStore, store } = seedAppStore()
    ensureReadiness('formalization_1', store)
    runSolver('formalization_1', 'nash', store)

    const result = appStore.getState().dispatch({
      kind: 'delete_player',
      payload: { id: 'player_1' },
    })

    expect(result.status).toBe('committed')
    expect(getDerivedStore().getState().dirtyFormalizations.formalization_1).toBe(true)
  })

  it('marks referenced formalizations dirty after deleting an assumption', () => {
    const { appStore, store } = seedAppStore()
    ensureReadiness('formalization_1', store)
    runSolver('formalization_1', 'nash', store)

    const result = appStore.getState().dispatch({
      kind: 'delete_assumption',
      payload: { id: 'assumption_1' },
    })

    expect(result.status).toBe('committed')
    expect(getDerivedStore().getState().dirtyFormalizations.formalization_1).toBe(true)
  })

  it('removes orphaned derived entries when a formalization is deleted', () => {
    const { appStore, store } = seedAppStore()
    ensureReadiness('formalization_1', store)
    runSolver('formalization_1', 'nash', store)

    const result = appStore.getState().dispatch({
      kind: 'delete_formalization',
      payload: { id: 'formalization_1' },
    })

    expect(result.status).toBe('committed')
    const derivedState = getDerivedStore().getState()
    expect(derivedState.readinessReportsByFormalization.formalization_1).toBeUndefined()
    expect(derivedState.solverResultsByFormalization.formalization_1).toBeUndefined()
    expect(derivedState.sensitivityByFormalizationAndSolver.formalization_1).toBeUndefined()
    expect(derivedState.dirtyFormalizations.formalization_1).toBeUndefined()
  })
})
