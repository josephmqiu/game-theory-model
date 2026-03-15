import { describe, it, expect, beforeEach, vi } from 'vitest'

import { createAppStore } from '../app-store'
import type { AppStore, ViewType } from '../app-store'
import { emptyCanonicalStore } from '../../types/canonical'
import { resetPersistedEventStore } from '../../engine/event-persistence'
import type { Command } from '../../engine/commands'
import type { EntityRef } from '../../types/canonical'
import type { FileService } from '../../platform'
import { createSampleAnalysisMeta, createSampleCanonicalStore } from '../../test-support/sample-analysis'
import { buildInverseIndex } from '../../engine/inverse-index'
import { createEventLog } from '../../engine/events'
import { storeToAnalysisFile } from '../../utils/serialization'
import type { LoadResult } from '../../types/file'

type StoreApi = ReturnType<typeof createAppStore>

function getState(store: StoreApi): AppStore {
  return store.getState()
}

describe('AppStore', () => {
  let store: StoreApi
  let fileService: FileService

  beforeEach(() => {
    resetPersistedEventStore()
    fileService = {
      openFile: vi.fn(async (): Promise<LoadResult> => ({
        status: 'recovery',
        stage: 'parse',
        raw_json: '',
        error: { message: 'No file selected.' },
      })),
      openFilePath: vi.fn(async (): Promise<LoadResult> => ({
        status: 'recovery',
        stage: 'parse',
        raw_json: '',
        error: { message: 'Missing recent file.' },
      })),
      saveFile: vi.fn(async (path) => ({ success: true, path })),
      saveFileAs: vi.fn(async () => ({ success: true, path: 'saved-analysis.gta.json' })),
      getRecentFiles: vi.fn(async () => []),
      loadFixture: vi.fn(async () => makeSuccessLoadResult()),
    }
    store = createAppStore({ fileService })
  })

  it('initializes with welcome view', () => {
    const state = getState(store)

    expect(state.viewState.activeView).toBe('welcome')
    expect(state.viewState.activeGameId).toBeNull()
    expect(state.viewState.activeFormalizationId).toBeNull()
    expect(state.viewState.inspectedRefs).toEqual([])
    expect(state.viewState.sidebarCollapsed).toBe(false)
  })

  it('initializes with empty canonical store', () => {
    const state = getState(store)

    expect(state.canonical).toEqual(emptyCanonicalStore())
  })

  it('initializes with clean file meta', () => {
    const state = getState(store)

    expect(state.fileMeta.path).toBeNull()
    expect(state.fileMeta.meta).toBeNull()
    expect(state.fileMeta.lastSaved).toBeNull()
    expect(state.fileMeta.dirty).toBe(false)
    expect(state.fileMeta.error).toBeNull()
  })

  it('initializes with inactive recovery', () => {
    const state = getState(store)

    expect(state.recovery).toEqual({ active: false })
  })

  it('sets active view', () => {
    const views: ViewType[] = ['board', 'graph', 'matrix', 'timeline', 'player_lens']

    for (const view of views) {
      getState(store).setActiveView(view)
      expect(getState(store).viewState.activeView).toBe(view)
    }
  })

  it('sets active game and clears on null', () => {
    getState(store).setActiveGame('game_123')
    expect(getState(store).viewState.activeGameId).toBe('game_123')

    getState(store).setActiveGame(null)
    expect(getState(store).viewState.activeGameId).toBeNull()
  })

  it('sets active formalization', () => {
    getState(store).setActiveFormalization('form_1')
    expect(getState(store).viewState.activeFormalizationId).toBe('form_1')

    getState(store).setActiveFormalization(null)
    expect(getState(store).viewState.activeFormalizationId).toBeNull()
  })

  it('sets inspected refs', () => {
    const refs: EntityRef[] = [
      { type: 'game', id: 'game_1' },
      { type: 'player', id: 'player_1' },
    ]

    getState(store).setInspectedRefs(refs)
    expect(getState(store).viewState.inspectedRefs).toEqual(refs)

    getState(store).setInspectedRefs([])
    expect(getState(store).viewState.inspectedRefs).toEqual([])
  })

  it('dispatches add command and marks dirty', () => {
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Test Game',
        description: 'A test game',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    const result = getState(store).dispatch(command)

    expect(result.status).toBe('committed')
    expect(getState(store).fileMeta.dirty).toBe(true)

    const games = getState(store).canonical.games
    const gameIds = Object.keys(games)
    expect(gameIds).toHaveLength(1)
    expect(games[gameIds[0]].name).toBe('Test Game')
  })

  it('dispatch dry run does not commit changes', () => {
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Dry Run Game',
        description: 'Should not be committed',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    const result = getState(store).dispatch(command, { dryRun: true })

    expect(result.status).toBe('dry_run')
    expect(getState(store).fileMeta.dirty).toBe(false)
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(0)
  })

  it('undo returns false when nothing to undo', () => {
    const result = getState(store).undo()

    expect(result).toBe(false)
  })

  it('redo returns false when nothing to redo', () => {
    const result = getState(store).redo()

    expect(result).toBe(false)
  })

  it('undo reverts last dispatch', () => {
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Undo Test Game',
        description: 'Will be undone',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    getState(store).dispatch(command)
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(1)

    const undoResult = getState(store).undo()
    expect(undoResult).toBe(true)
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(0)
  })

  it('redo restores undone dispatch', () => {
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Redo Test Game',
        description: 'Will be undone then redone',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    getState(store).dispatch(command)
    getState(store).undo()
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(0)

    const redoResult = getState(store).redo()
    expect(redoResult).toBe(true)
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(1)
  })

  it('blocks dispatch during recovery mode', () => {
    store.setState({
      recovery: {
        active: true,
        stage: 'parse',
        raw_json: '{}',
        error: { message: 'Parse error' },
      },
    })

    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Blocked Game',
        description: 'Should be rejected',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    const result = getState(store).dispatch(command)

    expect(result.status).toBe('rejected')
    if (result.status === 'rejected') {
      expect(result.errors).toContain('Cannot dispatch while in recovery mode')
    }
  })

  it('newAnalysis resets all state', () => {
    // First, add some data
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Will Be Reset',
        description: 'Should disappear after newAnalysis',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    getState(store).dispatch(command)
    getState(store).setActiveView('board')
    expect(getState(store).fileMeta.dirty).toBe(true)

    // Reset
    getState(store).newAnalysis()

    const state = getState(store)
    expect(state.canonical).toEqual(emptyCanonicalStore())
    expect(state.viewState.activeView).toBe('welcome')
    expect(state.fileMeta.dirty).toBe(false)
    expect(state.fileMeta.path).toBeNull()
    expect(state.recovery).toEqual({ active: false })
    expect(state.eventLog.events).toHaveLength(0)
    expect(state.eventLog.cursor).toBe(0)
  })

  it('multiple dispatches increment event log cursor', () => {
    const makeAddGameCommand = (name: string): Command => ({
      kind: 'add_game',
      payload: {
        name,
        description: `Description for ${name}`,
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    })

    getState(store).dispatch(makeAddGameCommand('Game 1'))
    getState(store).dispatch(makeAddGameCommand('Game 2'))

    expect(getState(store).eventLog.cursor).toBe(2)
    expect(getState(store).eventLog.events).toHaveLength(2)
    expect(Object.keys(getState(store).canonical.games)).toHaveLength(2)
  })

  it('loadFile hydrates canonical state from the file service', async () => {
    const result = makeSuccessLoadResult('loaded-analysis.gta.json')
    fileService.openFile = vi.fn(async () => result)

    await getState(store).loadFile()

    expect(getState(store).canonical).toEqual(result.store)
    expect(getState(store).fileMeta.path).toBe('loaded-analysis.gta.json')
    expect(getState(store).viewState.activeView).toBe('board')
    expect(getState(store).recovery).toEqual({ active: false })
  })

  it('saveFile uses saveFileAs when no path exists and clears dirty state', async () => {
    const command: Command = {
      kind: 'add_game',
      payload: {
        name: 'Save Test',
        description: 'Needs persistence',
        semantic_labels: [],
        players: [],
        status: 'active',
        formalizations: [],
        coupling_links: [],
        key_assumptions: [],
        created_at: '2026-03-14T00:00:00Z',
        updated_at: '2026-03-14T00:00:00Z',
      },
    }

    getState(store).dispatch(command)
    await getState(store).saveFile()

    expect(fileService.saveFileAs).toHaveBeenCalledOnce()
    expect(getState(store).fileMeta.dirty).toBe(false)
    expect(getState(store).fileMeta.path).toBe('saved-analysis.gta.json')
    expect(getState(store).fileMeta.error).toBeNull()
  })

  it('loadFile enters recovery mode on parse failure with raw content', async () => {
    fileService.openFile = vi.fn(async (): Promise<LoadResult> => ({
      status: 'recovery',
      stage: 'validation',
      raw_json: '{"bad":true}',
      parsed_json: { bad: true },
      error: { message: 'Invalid analysis file.' },
    }))

    await getState(store).loadFile()

    expect(getState(store).recovery).toMatchObject({
      active: true,
      stage: 'validation',
      raw_json: '{"bad":true}',
    })
    expect(getState(store).fileMeta.error).toContain('validation')
  })
})

function makeSuccessLoadResult(path: string | null = null): Extract<LoadResult, { status: 'success' }> {
  const store = createSampleCanonicalStore()
  const meta = createSampleAnalysisMeta()

  return {
    status: 'success',
    path,
    analysis: storeToAnalysisFile(store, meta),
    store,
    derived: {
      inverse_index: buildInverseIndex(store),
    },
    integrity: {
      ok: true,
    },
    event_log: createEventLog(path ?? meta.name),
    migration: {
      from: 5,
      to: 5,
      steps_applied: [],
    },
  }
}
