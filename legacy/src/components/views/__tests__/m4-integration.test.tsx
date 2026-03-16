import { useEffect } from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { PlatformProvider } from '../../../platform'
import {
  StoreProvider,
  useAppStore,
} from '../../../store'
import { MatrixView } from '../matrix/MatrixView'
import { TreeView } from '../tree/TreeView'
import { resetDerivedState } from '../../../store/derived'
import {
  createExtensiveFormStore,
  createNormalFormStore,
  createSuccessLoadResult,
} from '../../../test-support/m4-fixtures'

function MatrixHarness() {
  const loadFromResult = useAppStore((state) => state.loadFromResult)
  const setActiveGame = useAppStore((state) => state.setActiveGame)
  const setActiveFormalization = useAppStore((state) => state.setActiveFormalization)

  useEffect(() => {
    const store = createNormalFormStore()
    loadFromResult(createSuccessLoadResult(store))
    setActiveGame('game_1')
    setActiveFormalization('formalization_1')
  }, [loadFromResult, setActiveFormalization, setActiveGame])

  return <MatrixView />
}

function TreeHarness() {
  const loadFromResult = useAppStore((state) => state.loadFromResult)
  const setActiveGame = useAppStore((state) => state.setActiveGame)
  const setActiveFormalization = useAppStore((state) => state.setActiveFormalization)

  useEffect(() => {
    const store = createExtensiveFormStore()
    loadFromResult(createSuccessLoadResult(store))
    setActiveGame('game_1')
    setActiveFormalization('formalization_1')
  }, [loadFromResult, setActiveFormalization, setActiveGame])

  return <TreeView />
}

describe('M4 integration', () => {
  beforeEach(() => {
    resetDerivedState()
  })

  it('runs Nash from the matrix view and shows results', async () => {
    render(
      <PlatformProvider>
        <StoreProvider>
          <MatrixHarness />
        </StoreProvider>
      </PlatformProvider>,
    )

    await waitFor(() => expect(screen.getByText('Run Nash')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Run Nash'))

    await waitFor(() => expect(screen.getByText('Nash Result')).toBeInTheDocument())
    expect(screen.getByText(/equilibrium/i)).toBeInTheDocument()
  })

  it('runs backward induction from the tree view and shows the solution path', async () => {
    render(
      <PlatformProvider>
        <StoreProvider>
          <TreeHarness />
        </StoreProvider>
      </PlatformProvider>,
    )

    await waitFor(() => expect(screen.getByText('Run Backward Induction')).toBeInTheDocument())
    fireEvent.click(screen.getByText('Run Backward Induction'))

    await waitFor(() => expect(screen.getByText('Backward Induction')).toBeInTheDocument())
    expect(screen.getByText(/edge_left/i)).toBeInTheDocument()
  })
})
