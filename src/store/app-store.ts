import { createStore } from 'zustand/vanilla'

import type { CanonicalStore, EntityRef } from '../types/canonical'
import { emptyCanonicalStore } from '../types/canonical'
import type { AnalysisFileMeta, LoadResult } from '../types/file'
import type { Command } from '../engine/commands'
import type { EventLog, ModelEvent } from '../engine/events'
import { createEventLog } from '../engine/events'
import {
  dispatch as engineDispatch,
  undo as engineUndo,
  redo as engineRedo,
  type DispatchResult,
} from '../engine/dispatch'
import { buildInverseIndex, type InverseIndex } from '../engine/inverse-index'

export type ViewType =
  | 'welcome'
  | 'board'
  | 'players_registry'
  | 'evidence_library'
  | 'graph'
  | 'matrix'
  | 'tree'
  | 'timeline'
  | 'player_lens'
  | 'evidence_notebook'
  | 'scenario'
  | 'play'
  | 'diff'

export type RecoveryState =
  | { active: false }
  | {
      active: true
      stage: 'parse' | 'migration' | 'validation' | 'structural'
      raw_json: string
      parsed_json?: unknown
      error: {
        message: string
        issues?: unknown[]
        structural_issues?: unknown[]
      }
    }

export interface AppStore {
  canonical: CanonicalStore

  viewState: {
    activeView: ViewType
    activeGameId: string | null
    activeFormalizationId: string | null
    inspectedRefs: EntityRef[]
    sidebarCollapsed: boolean
  }

  eventLog: EventLog
  inverseIndex: InverseIndex
  fileMeta: {
    path: string | null
    meta: AnalysisFileMeta | null
    lastSaved: number | null
    dirty: boolean
  }

  recovery: RecoveryState

  // L1 actions
  dispatch: (
    command: Command,
    opts?: {
      dryRun?: boolean
      source?: ModelEvent['source']
    },
  ) => DispatchResult

  undo: () => boolean
  redo: () => boolean

  // File actions
  loadFile: (filepath?: string) => Promise<void>
  saveFile: () => Promise<void>
  loadFromResult: (result: Extract<LoadResult, { status: 'success' }>) => void
  newAnalysis: () => void

  // L2 actions
  setActiveView: (view: ViewType) => void
  setActiveGame: (gameId: string | null) => void
  setActiveFormalization: (formId: string | null) => void
  setInspectedRefs: (refs: EntityRef[]) => void
}

function createInitialAnalysisId(): string {
  return crypto.randomUUID()
}

function createInitialState() {
  const analysisId = createInitialAnalysisId()
  return {
    canonical: emptyCanonicalStore(),
    viewState: {
      activeView: 'welcome' as ViewType,
      activeGameId: null as string | null,
      activeFormalizationId: null as string | null,
      inspectedRefs: [] as EntityRef[],
      sidebarCollapsed: false,
    },
    eventLog: createEventLog(analysisId),
    inverseIndex: {} as InverseIndex,
    fileMeta: {
      path: null as string | null,
      meta: null as AnalysisFileMeta | null,
      lastSaved: null as number | null,
      dirty: false,
    },
    recovery: { active: false } as RecoveryState,
  }
}

export function createAppStore() {
  return createStore<AppStore>((set, get) => ({
    ...createInitialState(),

    dispatch: (command, opts) => {
      const state = get()

      if (state.recovery.active) {
        return {
          status: 'rejected',
          reason: 'error',
          errors: ['Cannot dispatch while in recovery mode'],
        }
      }

      const result = engineDispatch(state.canonical, state.eventLog, command, opts)

      if (result.status === 'committed') {
        set({
          canonical: result.store,
          eventLog: result.event_log,
          inverseIndex: result.inverse_index,
          fileMeta: {
            ...state.fileMeta,
            dirty: true,
          },
        })
      }

      // dry_run: don't commit changes to store
      // rejected: nothing to commit

      return result
    },

    undo: () => {
      const state = get()
      const result = engineUndo(state.canonical, state.eventLog)

      if (!result) {
        return false
      }

      set({
        canonical: result.store,
        eventLog: result.eventLog,
        inverseIndex: buildInverseIndex(result.store),
        fileMeta: {
          ...state.fileMeta,
          dirty: true,
        },
      })

      return true
    },

    redo: () => {
      const state = get()
      const result = engineRedo(state.canonical, state.eventLog)

      if (!result) {
        return false
      }

      set({
        canonical: result.store,
        eventLog: result.eventLog,
        inverseIndex: buildInverseIndex(result.store),
        fileMeta: {
          ...state.fileMeta,
          dirty: true,
        },
      })

      return true
    },

    loadFile: async (_filepath?: string) => {
      console.warn('File loading not yet wired to platform service')
    },

    saveFile: async () => {
      console.warn('File saving not yet wired to platform service')
    },

    loadFromResult: (result) => {
      set({
        canonical: result.store,
        eventLog: result.event_log,
        inverseIndex: result.derived.inverse_index,
        fileMeta: {
          path: null,
          meta: {
            name: result.analysis.name,
            description: result.analysis.description,
            created_at: result.analysis.created_at,
            updated_at: result.analysis.updated_at,
            metadata: result.analysis.metadata,
          },
          lastSaved: Date.now(),
          dirty: false,
        },
        recovery: { active: false },
      })
    },

    newAnalysis: () => {
      set({
        ...createInitialState(),
      })
    },

    setActiveView: (view) => {
      set((state) => ({
        viewState: {
          ...state.viewState,
          activeView: view,
        },
      }))
    },

    setActiveGame: (gameId) => {
      const state = get()
      const game = gameId ? state.canonical.games[gameId] : null
      const firstFormalizationId =
        game && game.formalizations.length > 0 ? game.formalizations[0]! : null
      set({
        viewState: {
          ...state.viewState,
          activeGameId: gameId,
          activeFormalizationId: firstFormalizationId,
        },
      })
    },

    setActiveFormalization: (formId) => {
      set((state) => ({
        viewState: {
          ...state.viewState,
          activeFormalizationId: formId,
        },
      }))
    },

    setInspectedRefs: (refs) => {
      set((state) => ({
        viewState: {
          ...state.viewState,
          inspectedRefs: refs,
        },
      }))
    },
  }))
}
