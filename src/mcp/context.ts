import type { ZodTypeAny } from 'zod'

import type { EntityType, CanonicalStore, CurrentAnalysisFile, AnalysisFile } from '../types'
import type { ToolContext } from '../types/mcp'
import { STORE_KEY } from '../types/canonical'
import { appendConversationMessage } from '../store/conversation'
import { getPipelineState } from '../store/pipeline'
import { createPipelineOrchestrator } from '../pipeline'
import { storeToAnalysisFile } from '../utils/serialization'
import { createAppStore } from '../store'

export interface RegisteredTool<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  inputSchema: ZodTypeAny
  execute: (input: unknown) => Promise<TOutput> | TOutput
}

export interface RegisteredResource {
  uri: string
  name: string
  description: string
  mimeType: string
  read: () => unknown
}

export interface RegisteredPrompt {
  name: string
  description: string
  arguments: Array<{
    name: string
    description: string
    required: boolean
  }>
  render: (args: Record<string, string>) => string
}

export interface McpServerLike {
  registerTool: (tool: RegisteredTool) => void
  registerResource: (resource: RegisteredResource) => void
  registerPrompt: (prompt: RegisteredPrompt) => void
}

export interface RuntimeToolContext extends ToolContext {
  getCanonicalStore: () => CanonicalStore
  getAnalysisId: () => string
  getPersistedRevision: () => number
  orchestrator: ReturnType<typeof createPipelineOrchestrator>
}

function mapPhaseStatus(phase: number): ToolContext['getPhaseStatus'] extends (phase: number) => infer T ? T : never {
  const phaseState = getPipelineState().analysis_state?.phase_states[phase]
  if (!phaseState) {
    return 'idle' as never
  }
  if (phaseState.status === 'running') {
    return 'running' as never
  }
  if (phaseState.status === 'complete') {
    return 'complete' as never
  }
  if (phaseState.status === 'needs_rerun') {
    return 'stale' as never
  }
  return 'idle' as never
}

export function createToolContext(appStore: ReturnType<typeof createAppStore>): RuntimeToolContext {
  const orchestrator = createPipelineOrchestrator({
    getCanonical: () => appStore.getState().canonical,
    getAnalysisFile: () => {
      const meta = appStore.getState().fileMeta.meta
      if (!meta) {
        return null
      }

      return storeToAnalysisFile(appStore.getState().canonical, meta) as CurrentAnalysisFile
    },
    getPersistedRevision: () => appStore.getState().eventLog.persisted_revision,
    getActiveAnalysisId: () => appStore.getState().eventLog.analysis_id,
    dispatch: (command) => appStore.getState().dispatch(command),
    emitConversationMessage: (message) => {
      appendConversationMessage(message)
    },
  })

  return {
    getModel: (): AnalysisFile | null => {
      const meta = appStore.getState().fileMeta.meta
      if (!meta) {
        return null
      }
      return storeToAnalysisFile(appStore.getState().canonical, meta)
    },
    dispatch: (command) => appStore.getState().dispatch(command),
    getPhaseStatus: (phase) => mapPhaseStatus(phase),
    getAllPhaseStatuses: () => (
      Array.from({ length: 10 }, (_, index) => {
        const phase = index + 1
        return {
          phase,
          status: mapPhaseStatus(phase),
        }
      })
    ),
    getEntities: <T>(type: EntityType): ReadonlyArray<T> => {
      const key = STORE_KEY[type]
      return Object.values(appStore.getState().canonical[key]) as T[]
    },
    emitConversationMessage: (message) => {
      appendConversationMessage(message)
    },
    getCanonicalStore: () => appStore.getState().canonical,
    getAnalysisId: () => appStore.getState().eventLog.analysis_id,
    getPersistedRevision: () => appStore.getState().eventLog.persisted_revision,
    orchestrator,
  }
}
