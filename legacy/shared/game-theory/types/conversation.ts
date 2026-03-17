import type { EntityRef, EntityType } from './canonical'

export interface RevalidationActionCard {
  event_id: string
  trigger_condition: string
  source_phase: number
  target_phases: number[]
  description: string
  pass_number: number
  resolution: 'pending' | 'approved' | 'rerun_complete' | 'dismissed'
  entity_refs: EntityRef[]
}

export interface EntityPreview {
  entity_type: EntityType
  action: 'add' | 'update' | 'delete'
  entity_id: string | null
  preview: Record<string, unknown>
  accepted: boolean
}

export interface Proposal {
  id: string
  description: string
  entity_previews: EntityPreview[]
  status: 'pending' | 'accepted' | 'rejected' | 'modified'
}

export interface ProposalGroup {
  id: string
  phase: number
  proposals: ReadonlyArray<Proposal>
  status: 'pending' | 'partially_accepted' | 'accepted' | 'rejected'
}

export interface StructuredContent {
  proposals?: ProposalGroup[]
  entity_refs?: EntityRef[]
  revalidation_actions?: RevalidationActionCard[]
  scenario_cards?: EntityRef[]
  thesis?: EntityRef
  findings_summary?: ReadonlyArray<{
    label: string
    count: number
    entity_type: EntityType
  }>
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'ai'
  timestamp: string
  content: string
  structured_content?: StructuredContent
  phase?: number
  message_type?: 'phase_transition' | 'finding' | 'proposal' | 'result' | 'revalidation' | 'steering_ack'
}

export interface ProposalConflict {
  kind: 'revision_mismatch' | 'integrity' | 'validation'
  message: string
}

export interface MergeLogEntry {
  proposal_id: string
  action: 'accepted' | 'rejected' | 'modified'
  timestamp: string
}

export interface DiffReviewState {
  proposals: ReadonlyArray<string>
  active_proposal_index: number
  merge_log: MergeLogEntry[]
}
