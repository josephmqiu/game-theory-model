import { createStore } from 'zustand/vanilla'

import type { CanonicalStore, EntityRef } from '../types/canonical'
import { emptyCanonicalStore } from '../types/canonical'
import type { AnalysisFileMeta, LoadResult } from '../types/file'
import type { FileService } from '../platform'
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
import { loadAnalysisJson } from '../utils/file-io'
import { BrowserFileService } from '../platform/browser-file-service'
import { invalidateDerivedForCommand, resetDerivedState } from './derived'
import { setConversationActiveAnalysis } from './conversation'
import { setPipelineActiveAnalysis } from './pipeline'

export type ViewType =
  | 'welcome'
  | 'new_analysis'
  | 'overview'
  | 'timeline'
  | 'scenarios'
  | 'playout'
  | 'game_map'
  | 'evidence'
  | 'players'
  | 'assumptions'
  | 'phase_1' | 'phase_2' | 'phase_3' | 'phase_4' | 'phase_5'
  | 'phase_6' | 'phase_7' | 'phase_8' | 'phase_9' | 'phase_10'
  | 'settings'
  // Legacy views (kept for drill-down access)
  | 'board'
  | 'players_registry'
  | 'evidence_library'
  | 'graph'
  | 'matrix'
  | 'tree'
  | 'evidence_notebook'
  | 'player_lens'
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
    manualMode: boolean
    inspectorState: {
      inspectedEntity: EntityRef | null
      breadcrumb: string[]
    }
    phaseStatuses: Record<number, 'pending' | 'active' | 'complete' | 'needs_rerun' | 'partial' | 'review_needed'>
  }

  eventLog: EventLog
  inverseIndex: InverseIndex
  fileMeta: {
    path: string | null
    meta: AnalysisFileMeta | null
    lastSaved: number | null
    dirty: boolean
    error: string | null
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
  saveFileAs: () => Promise<void>
  loadFromResult: (result: Extract<LoadResult, { status: 'success' }>) => void
  retryRecovery: (rawJson: string) => Promise<void>
  newAnalysis: () => void
  resetAnalysisSession: () => void
  clearFileError: () => void

  // L2 actions
  setActiveView: (view: ViewType) => void
  setActiveGame: (gameId: string | null) => void
  setActiveFormalization: (formId: string | null) => void
  setInspectedRefs: (refs: EntityRef[]) => void
  setManualMode: (manualMode: boolean) => void
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
      manualMode: false,
      inspectorState: { inspectedEntity: null, breadcrumb: [] },
      phaseStatuses: {} as Record<number, 'pending' | 'active' | 'complete' | 'needs_rerun' | 'partial' | 'review_needed'>,
    },
    eventLog: createEventLog(analysisId),
    inverseIndex: {} as InverseIndex,
    fileMeta: {
      path: null as string | null,
      meta: null as AnalysisFileMeta | null,
      lastSaved: null as number | null,
      dirty: false,
      error: null as string | null,
    },
    recovery: { active: false } as RecoveryState,
  }
}

function createSessionResetState(
  viewState: AppStore['viewState'],
): ReturnType<typeof createInitialState> {
  const nextState = createInitialState()
  return {
    ...nextState,
    viewState: {
      ...nextState.viewState,
      activeView: viewState.activeView,
      sidebarCollapsed: viewState.sidebarCollapsed,
      manualMode: false,
    },
  }
}

function createDefaultMeta(existing: AnalysisFileMeta | null): AnalysisFileMeta {
  const now = new Date().toISOString()
  return {
    name: existing?.name ?? 'Untitled analysis',
    description: existing?.description ?? '',
    created_at: existing?.created_at ?? now,
    updated_at: now,
    metadata: existing?.metadata ?? { tags: [] },
  }
}

function fileErrorFromResult(result: Exclude<LoadResult, { status: 'success' }>): string {
  return `${result.stage}: ${result.error.message}`
}

export interface AppStoreDependencies {
  fileService: FileService
}

export function createAppStore(
  { fileService = new BrowserFileService() }: Partial<AppStoreDependencies> = {},
) {
  const initialState = createInitialState()
  setConversationActiveAnalysis(initialState.eventLog.analysis_id)
  setPipelineActiveAnalysis(initialState.eventLog.analysis_id)

  return createStore<AppStore>((set, get) => ({
    ...initialState,

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
        invalidateDerivedForCommand(command, state.canonical, result.store)
        set({
          canonical: result.store,
          eventLog: result.event_log,
          inverseIndex: result.inverse_index,
          fileMeta: {
            ...state.fileMeta,
            dirty: true,
            error: null,
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

      invalidateDerivedForCommand(null, state.canonical, result.store)
      set({
        canonical: result.store,
        eventLog: result.eventLog,
        inverseIndex: buildInverseIndex(result.store),
        fileMeta: {
          ...state.fileMeta,
          dirty: true,
          error: null,
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

      invalidateDerivedForCommand(null, state.canonical, result.store)
      set({
        canonical: result.store,
        eventLog: result.eventLog,
        inverseIndex: buildInverseIndex(result.store),
        fileMeta: {
          ...state.fileMeta,
          dirty: true,
          error: null,
        },
      })

      return true
    },

    loadFile: async (filepath?: string) => {
      const result = filepath
        ? await fileService.openFilePath(filepath)
        : await fileService.openFile()

      if (result.status === 'success') {
        get().loadFromResult(result)
        return
      }

      if (result.raw_json.length === 0 && result.parsed_json === undefined) {
        set((state) => ({
          fileMeta: {
            ...state.fileMeta,
            error: fileErrorFromResult(result),
          },
        }))
        return
      }

      set((state) => ({
        recovery: {
          active: true,
          stage: result.stage,
          raw_json: result.raw_json,
          parsed_json: result.parsed_json,
          error: result.error,
        },
        fileMeta: {
          ...state.fileMeta,
          error: fileErrorFromResult(result),
        },
      }))
    },

    saveFile: async () => {
      const state = get()
      const meta = createDefaultMeta(state.fileMeta.meta)

      const saveResult = state.fileMeta.path
        ? await fileService.saveFile(state.fileMeta.path, state.canonical, meta)
        : await fileService.saveFileAs(state.canonical, meta)

      if (!saveResult.success) {
        set({
          fileMeta: {
            ...state.fileMeta,
            error: saveResult.error ?? 'Failed to save analysis.',
          },
        })
        return
      }

      set({
        fileMeta: {
          path: saveResult.path,
          meta: {
            ...meta,
            updated_at: new Date().toISOString(),
          },
          lastSaved: Date.now(),
          dirty: false,
          error: null,
        },
      })
    },

    saveFileAs: async () => {
      const state = get()
      const meta = createDefaultMeta(state.fileMeta.meta)
      const saveResult = await fileService.saveFileAs(state.canonical, meta)

      if (!saveResult.success) {
        set({
          fileMeta: {
            ...state.fileMeta,
            error: saveResult.error ?? 'Failed to save analysis.',
          },
        })
        return
      }

      set({
        fileMeta: {
          path: saveResult.path,
          meta: {
            ...meta,
            updated_at: new Date().toISOString(),
          },
          lastSaved: Date.now(),
          dirty: false,
          error: null,
        },
      })
    },

    loadFromResult: (result) => {
      resetDerivedState()
      setConversationActiveAnalysis(result.event_log.analysis_id)
      setPipelineActiveAnalysis(result.event_log.analysis_id)
      set({
        canonical: result.store,
        eventLog: result.event_log,
        inverseIndex: result.derived.inverse_index,
        fileMeta: {
          path: result.path,
          meta: {
            name: result.analysis.name,
            description: result.analysis.description,
            created_at: result.analysis.created_at,
            updated_at: result.analysis.updated_at,
            metadata: result.analysis.metadata,
          },
          lastSaved: Date.now(),
          dirty: false,
          error: null,
        },
        recovery: { active: false },
        viewState: {
          ...get().viewState,
          activeView: 'overview',
          manualMode: false,
        },
      })
    },

    retryRecovery: async (rawJson) => {
      const result = await loadAnalysisJson(rawJson)
      if (result.status === 'success') {
        get().loadFromResult(result)
        return
      }

      set((state) => ({
        recovery: {
          active: true,
          stage: result.stage,
          raw_json: result.raw_json,
          parsed_json: result.parsed_json,
          error: result.error,
        },
        fileMeta: {
          ...state.fileMeta,
          error: fileErrorFromResult(result),
        },
      }))
    },

    newAnalysis: () => {
      resetDerivedState()
      const nextState = createInitialState()
      setConversationActiveAnalysis(nextState.eventLog.analysis_id)
      setPipelineActiveAnalysis(nextState.eventLog.analysis_id)
      set(nextState)
    },

    resetAnalysisSession: () => {
      resetDerivedState()
      const nextState = createSessionResetState(get().viewState)
      setConversationActiveAnalysis(nextState.eventLog.analysis_id)
      setPipelineActiveAnalysis(nextState.eventLog.analysis_id)
      set(nextState)
    },

    clearFileError: () => {
      set((state) => ({
        fileMeta: {
          ...state.fileMeta,
          error: null,
        },
      }))
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

    setManualMode: (manualMode) => {
      set((state) => ({
        viewState: {
          ...state.viewState,
          manualMode,
        },
      }))
    },
  }))
}
