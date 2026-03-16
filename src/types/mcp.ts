import type { DispatchResult } from '../engine/dispatch'
import type { Command } from '../engine/commands'
import type { EntityType } from './canonical'
import type { AnalysisFile } from './file'
import type { ConversationMessage } from './conversation'

export interface McpServerConfig {
  name: 'game-theory-analysis'
  version: string
  stdio_enabled: boolean
  http_enabled: boolean
  http_port?: number
  http_host?: string
}

export interface McpConnectionStatus {
  transport: 'stdio' | 'http'
  connected: boolean
  client_name?: string
  connected_at: string | null
  last_activity: string | null
  error?: string
}

export type McpUiPhaseStatus = 'idle' | 'running' | 'complete' | 'stale' | 'blocked'

export interface ToolContext {
  getModel: () => AnalysisFile | null
  dispatch: (command: Command) => DispatchResult
  getPhaseStatus: (phase: number) => McpUiPhaseStatus
  getAllPhaseStatuses: () => ReadonlyArray<{ phase: number; status: McpUiPhaseStatus }>
  getEntities: <T>(type: EntityType) => ReadonlyArray<T>
  emitConversationMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void
}

export interface PhaseToolResult {
  success: boolean
  phase: number
  phase_name: string
  summary: string
  entities_created: ReadonlyArray<{
    type: EntityType
    id: string
    label: string
  }>
  proposals: ReadonlyArray<{
    id: string
    description: string
    status: 'pending' | 'auto_accepted'
  }>
  next_step?: string
  warnings: ReadonlyArray<string>
  error?: string
  revalidation?: {
    action: 'status' | 'approve' | 'dismiss'
    pending_events: ReadonlyArray<{
      id: string
      trigger_condition: string
      source_phase: number
      target_phases: number[]
      resolution: 'pending' | 'approved' | 'rerun_complete' | 'dismissed'
      pass_number: number
    }>
    active_rerun_cycle?: {
      event_id: string
      earliest_phase: number
      pass_number: number
      status: string
    } | null
  }
}

export interface ModelQueryResult {
  success: boolean
  data: unknown
  entity_count?: number
}
