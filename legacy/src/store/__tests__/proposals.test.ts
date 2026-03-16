import { beforeEach, describe, expect, it } from 'vitest'

import { resetPersistedEventStore } from '../../engine/event-persistence'
import type { EvidenceProposal } from '../../types/analysis-pipeline'
import { createAppStore } from '../app-store'
import {
  getEvidenceProposal,
  registerProposalGroup,
  resetConversationStore,
  resetPipelineStore,
} from '../index'
import { acceptConversationProposal } from '../proposals'

function createSourceProposal(params: {
  id: string
  sourceId: string
  baseRevision: number
  description?: string
}): EvidenceProposal {
  return {
    id: params.id,
    description: params.description ?? `Add ${params.sourceId}`,
    phase: 1,
    phase_execution_id: 'phase_execution_1',
    base_revision: params.baseRevision,
    status: 'pending',
    commands: [
      {
        kind: 'add_source',
        id: params.sourceId,
        payload: {
          kind: 'manual',
          title: params.sourceId,
          captured_at: '2026-03-15T00:00:00Z',
          quality_rating: 'high',
        },
      },
    ],
    entity_previews: [
      {
        entity_type: 'source',
        action: 'add',
        entity_id: params.sourceId,
        preview: { title: params.sourceId },
        accepted: false,
      },
    ],
    conflicts: [],
  }
}

describe('acceptConversationProposal', () => {
  beforeEach(() => {
    resetPersistedEventStore()
    resetConversationStore()
    resetPipelineStore()
  })

  it('commits a pending proposal when its base revision still matches', () => {
    const appStore = createAppStore()
    const baseRevision = appStore.getState().eventLog.persisted_revision

    registerProposalGroup({
      phase: 1,
      content: 'Review source proposal.',
      proposals: [
        createSourceProposal({
          id: 'proposal_source_exact',
          sourceId: 'source_exact',
          baseRevision,
        }),
      ],
    })

    const outcome = acceptConversationProposal({
      proposalId: 'proposal_source_exact',
      canonical: appStore.getState().canonical,
      currentPersistedRevision: appStore.getState().eventLog.persisted_revision,
      dispatch: (command) => appStore.getState().dispatch(command),
    })

    expect(outcome.status).toBe('accepted')
    expect(appStore.getState().canonical.sources.source_exact).toBeDefined()
    expect(getEvidenceProposal('proposal_source_exact')?.status).toBe('accepted')
  })

  it('safely rebases append-only proposals from the same original revision', () => {
    const appStore = createAppStore()
    const baseRevision = appStore.getState().eventLog.persisted_revision

    registerProposalGroup({
      phase: 1,
      content: 'Review both sources.',
      proposals: [
        createSourceProposal({
          id: 'proposal_source_1',
          sourceId: 'source_one',
          baseRevision,
        }),
        createSourceProposal({
          id: 'proposal_source_2',
          sourceId: 'source_two',
          baseRevision,
        }),
      ],
    })

    const firstOutcome = acceptConversationProposal({
      proposalId: 'proposal_source_1',
      canonical: appStore.getState().canonical,
      currentPersistedRevision: appStore.getState().eventLog.persisted_revision,
      dispatch: (command) => appStore.getState().dispatch(command),
    })
    const secondOutcome = acceptConversationProposal({
      proposalId: 'proposal_source_2',
      canonical: appStore.getState().canonical,
      currentPersistedRevision: appStore.getState().eventLog.persisted_revision,
      dispatch: (command) => appStore.getState().dispatch(command),
    })

    expect(firstOutcome.status).toBe('accepted')
    expect(secondOutcome.status).toBe('accepted')
    expect(Object.keys(appStore.getState().canonical.sources)).toHaveLength(2)
  })

  it('marks stale update proposals as conflicts instead of mutating canonical state', () => {
    const appStore = createAppStore()

    appStore.getState().dispatch({
      kind: 'add_source',
      id: 'source_conflict_target',
      payload: {
        kind: 'manual',
        title: 'Original title',
        captured_at: '2026-03-15T00:00:00Z',
        quality_rating: 'high',
      },
    })
    const baseRevision = appStore.getState().eventLog.persisted_revision

    registerProposalGroup({
      phase: 1,
      content: 'Review stale update.',
      proposals: [
        {
          id: 'proposal_source_update',
          description: 'Update source title',
          phase: 1,
          phase_execution_id: 'phase_execution_1',
          base_revision: baseRevision,
          status: 'pending',
          commands: [
            {
              kind: 'update_source',
              payload: {
                id: 'source_conflict_target',
                title: 'Updated title',
              },
            },
          ],
          entity_previews: [
            {
              entity_type: 'source',
              action: 'update',
              entity_id: 'source_conflict_target',
              preview: { title: 'Updated title' },
              accepted: false,
            },
          ],
          conflicts: [],
        },
      ],
    })

    appStore.getState().dispatch({
      kind: 'add_source',
      id: 'source_newer_revision',
      payload: {
        kind: 'manual',
        title: 'Another source',
        captured_at: '2026-03-15T00:00:01Z',
        quality_rating: 'medium',
      },
    })

    const outcome = acceptConversationProposal({
      proposalId: 'proposal_source_update',
      canonical: appStore.getState().canonical,
      currentPersistedRevision: appStore.getState().eventLog.persisted_revision,
      dispatch: (command) => appStore.getState().dispatch(command),
    })
    const storedProposal = getEvidenceProposal('proposal_source_update')

    expect(outcome.status).toBe('rejected')
    if (outcome.status !== 'rejected') {
      throw new Error('Expected proposal acceptance to be rejected.')
    }
    expect(outcome.reason).toBe('revision_conflict')
    expect(appStore.getState().canonical.sources.source_conflict_target?.title).toBe(
      'Original title',
    )
    expect(storedProposal?.status).toBe('conflict')
    expect(storedProposal?.conflicts).toEqual([
      {
        kind: 'revision_mismatch',
        message:
          'Proposal proposal_source_update cannot be rebased because update_source is not append-only.',
      },
    ])
  })
})
