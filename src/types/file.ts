import type { StepResult } from '../engine/migration'
import type { EventLog } from '../engine/events'
import type { InverseIndex } from '../engine/inverse-index'
import type { CanonicalStore } from './canonical'

export const analysisEntityKeys = [
  'games',
  'formalizations',
  'players',
  'nodes',
  'edges',
  'sources',
  'observations',
  'claims',
  'inferences',
  'assumptions',
  'contradictions',
  'derivations',
  'latent_factors',
  'cross_game_links',
  'scenarios',
  'playbooks',
] as const

export type AnalysisEntityKey = (typeof analysisEntityKeys)[number]
export type CurrentAnalysisFile = import('zod').infer<
  typeof import('./schemas').analysisFileSchema
>
export interface VersionedAnalysisFile {
  schema_version: number
  [key: string]: unknown
}
export type AnalysisFile = CurrentAnalysisFile
export type AnalysisFileMeta = Omit<
  AnalysisFile,
  'schema_version' | AnalysisEntityKey
>

export interface StructuralIssue {
  kind: 'missing_id' | 'duplicate_id' | 'cross_type_collision'
  message: string
  entity_collection?: AnalysisEntityKey
  id?: string
  colliding_collections?: AnalysisEntityKey[]
}

export type LoadResult =
  | {
      status: 'success'
      path: string | null
      analysis: AnalysisFile
      store: CanonicalStore
      derived: {
        inverse_index: InverseIndex
      }
      integrity: {
        ok: true
        warnings?: string[]
      }
      event_log: EventLog
      migration: {
        from: number
        to: number
        steps_applied: StepResult[]
        discarded_data?: Array<{
          step: { from: number; to: number }
          description: string
          fields: string[]
          values: Record<string, unknown>
        }>
      }
    }
  | {
      status: 'recovery'
      stage: 'parse' | 'migration' | 'validation' | 'structural'
      raw_json: string
      parsed_json?: unknown
      error: {
        message: string
        issues?: unknown[]
        structural_issues?: StructuralIssue[]
      }
    }
