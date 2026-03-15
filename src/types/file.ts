import type { StepResult } from '../engine/migration'
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
export type AnalysisFile = import('zod').infer<typeof import('./schemas').analysisFileSchema>
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
      analysis: AnalysisFile
      store: CanonicalStore
      derived: {
        inverse_index: null
      }
      integrity: {
        ok: true
      }
      event_log: {
        cursor: 0
      }
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
