import { beforeEach, describe, expect, it } from 'vitest'

import { createAppStore } from './app-store'
import { ensureReadiness, getDerivedStore, resetDerivedState } from './derived'
import { createEstimate, createNormalFormStore } from '../test-support/m4-fixtures'

describe('derived store invalidation', () => {
  beforeEach(() => {
    resetDerivedState()
  })

  it('marks affected formalizations dirty after a payoff update', () => {
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
})
