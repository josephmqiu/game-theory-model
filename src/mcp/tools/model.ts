import { z } from 'zod'

import type { Command } from '../../engine/commands'
import { entityTypes, STORE_KEY, type EntityType } from '../../types/canonical'
import type { ModelQueryResult } from '../../types/mcp'
import { getConversationState, getEvidenceProposal, registerProposalGroup, updateProposalStatus } from '../../store/conversation'
import { createEntityPreview } from '../../pipeline'
import { setPipelineProposalReview } from '../../store/pipeline'
import type { McpServerLike, RuntimeToolContext } from '../context'

const entityTypeSchema = z.enum(entityTypes as unknown as [string, ...string[]])

function buildCommandForProposal(input: {
  action: 'create' | 'update' | 'delete'
  entity_type: EntityType
  entity_id?: string
  data: Record<string, unknown>
}): Command {
  if (input.action === 'create') {
    return {
      kind: `add_${input.entity_type}`,
      id: input.entity_id,
      payload: input.data,
    } as Command
  }

  if (input.action === 'update') {
    return {
      kind: `update_${input.entity_type}`,
      payload: {
        id: input.entity_id,
        ...input.data,
      },
    } as Command
  }

  return {
    kind: `delete_${input.entity_type}`,
    payload: {
      id: input.entity_id,
    },
  } as Command
}

export function registerModelTools(server: McpServerLike, context: RuntimeToolContext): void {
  server.registerTool({
    name: 'get_model_summary',
    description: 'Get a structured summary of the current analysis: entity counts by type, phase completion status, and key findings.',
    inputSchema: z.object({}),
    execute(): ModelQueryResult {
      const model = context.getModel()
      const counts = Object.fromEntries(entityTypes.map((entityType) => {
        const key = STORE_KEY[entityType]
        return [entityType, Object.keys(context.getCanonicalStore()[key]).length]
      }))

      return {
        success: true,
        data: {
          has_model: Boolean(model),
          entity_counts: counts,
          phase_statuses: context.getAllPhaseStatuses(),
        },
      }
    },
  })

  server.registerTool({
    name: 'get_entities',
    description: 'Read all entities of a given type from the canonical model.',
    inputSchema: z.object({
      entity_type: entityTypeSchema,
      filter: z.record(z.unknown()).optional(),
    }),
    execute(rawInput): ModelQueryResult {
      const input = rawInput as { entity_type: EntityType }
      const entities = [...context.getEntities(input.entity_type)]
      return {
        success: true,
        data: entities,
        entity_count: entities.length,
      }
    },
  })

  server.registerTool({
    name: 'get_entity',
    description: 'Read a single entity by its ID.',
    inputSchema: z.object({
      entity_id: z.string(),
    }),
    execute(rawInput): ModelQueryResult {
      const input = rawInput as { entity_id: string }
      for (const entityType of entityTypes) {
        const key = STORE_KEY[entityType]
        const entity = context.getCanonicalStore()[key][input.entity_id]
        if (entity) {
          return {
            success: true,
            data: entity,
            entity_count: 1,
          }
        }
      }

      return {
        success: false,
        data: null,
        entity_count: 0,
      }
    },
  })

  server.registerTool({
    name: 'propose_entity',
    description: 'Propose a new entity or modification for user review without directly mutating the canonical model.',
    inputSchema: z.object({
      action: z.enum(['create', 'update', 'delete']),
      entity_type: entityTypeSchema,
      entity_id: z.string().optional(),
      data: z.record(z.unknown()),
      rationale: z.string(),
      phase: z.number().optional(),
    }),
    execute(rawInput): ModelQueryResult {
      const input = rawInput as {
        action: 'create' | 'update' | 'delete'
        entity_type: EntityType
        entity_id?: string
        data: Record<string, unknown>
        rationale: string
        phase?: number
      }
      const proposalId = `proposal_${crypto.randomUUID()}`
      const entityId = input.entity_id ?? `${input.entity_type}_${crypto.randomUUID()}`
      const command = buildCommandForProposal({
        action: input.action,
        entity_type: input.entity_type,
        entity_id: entityId,
        data: input.data,
      })

      registerProposalGroup({
        phase: input.phase ?? 1,
        content: input.rationale,
        proposals: [
          {
            id: proposalId,
            description: input.rationale,
            phase: input.phase ?? 1,
            phase_execution_id: `phase_execution_${crypto.randomUUID()}`,
            base_revision: context.getPersistedRevision(),
            status: 'pending',
            commands: [command],
            entity_previews: [
              createEntityPreview(
                input.entity_type,
                input.action === 'create' ? 'add' : input.action === 'update' ? 'update' : 'delete',
                input.action === 'delete' ? input.entity_id ?? entityId : entityId,
                input.data,
              ),
            ],
            conflicts: [],
          },
        ],
      })
      setPipelineProposalReview(getConversationState().proposal_review)

      return {
        success: true,
        data: {
          proposal_id: proposalId,
          entity_id: entityId,
        },
      }
    },
  })

  server.registerTool({
    name: 'accept_proposal',
    description: 'Accept a pending proposal by ID. This dispatches the corresponding commands through the command spine.',
    inputSchema: z.object({
      proposal_id: z.string(),
    }),
    execute(rawInput): ModelQueryResult {
      const input = rawInput as { proposal_id: string }
      const proposal = getEvidenceProposal(input.proposal_id)
      if (!proposal) {
        return {
          success: false,
          data: { error: 'Proposal not found.' },
        }
      }

      const result = context.dispatch({
        kind: 'batch',
        label: proposal.description,
        base_revision: proposal.base_revision,
        commands: proposal.commands,
      })

      if (result.status === 'committed') {
        updateProposalStatus(input.proposal_id, 'accepted', 'accepted')
        return {
          success: true,
          data: { proposal_id: input.proposal_id },
        }
      }

      updateProposalStatus(input.proposal_id, 'conflict', 'modified')
      return {
        success: false,
        data: {
          proposal_id: input.proposal_id,
          error: result.status === 'rejected' ? result.errors : ['Proposal was not committed.'],
        },
      }
    },
  })
}
