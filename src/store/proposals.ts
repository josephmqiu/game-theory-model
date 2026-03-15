import type { Command } from '../engine/commands'
import { parseCrudCommandKind } from '../engine/commands'
import type { DispatchResult } from '../engine/dispatch'
import type { EvidenceProposal } from '../types/analysis-pipeline'
import type { ProposalConflict } from '../types/conversation'
import type { CanonicalStore } from '../types/canonical'
import { STORE_KEY } from '../types/canonical'

import { getEvidenceProposal, updateProposalStatus } from './conversation'

type DispatchFn = (command: Command) => DispatchResult

export type AcceptConversationProposalResult =
  | {
      status: 'accepted'
      proposal: EvidenceProposal
      result: Extract<DispatchResult, { status: 'committed' }>
    }
  | {
      status: 'rejected'
      proposal: EvidenceProposal | null
      reason: Extract<DispatchResult, { status: 'rejected' }>['reason']
      errors: string[]
    }

const SAFE_REBASE_COMMAND_KINDS = new Set<Command['kind']>([
  'attach_player_to_game',
  'attach_formalization_to_game',
  'trigger_revalidation',
])

function flattenCommands(commands: ReadonlyArray<Command>): Command[] {
  return commands.flatMap((command) =>
    command.kind === 'batch' ? flattenCommands(command.commands) : [command],
  )
}

function rebaseConflict(message: string): ProposalConflict {
  return {
    kind: 'revision_mismatch',
    message,
  }
}

function ensureGameExists(
  proposal: EvidenceProposal,
  canonical: CanonicalStore,
  gameId: string,
): ProposalConflict | null {
  if (canonical.games[gameId]) {
    return null
  }

  return rebaseConflict(
    `Proposal ${proposal.id} cannot be rebased because game "${gameId}" does not exist in the current model.`,
  )
}

function validateSafeRebase(
  proposal: EvidenceProposal,
  canonical: CanonicalStore,
): ProposalConflict | null {
  for (const command of flattenCommands(proposal.commands)) {
    const descriptor = parseCrudCommandKind(command.kind)
    if (descriptor?.operation === 'add') {
      const addCommand = command as Extract<Command, { kind: `add_${string}` }>
      if (typeof addCommand.id !== 'string' || addCommand.id.length === 0) {
        return rebaseConflict(
          `Proposal ${proposal.id} cannot be rebased because ${command.kind} is missing a stable target id.`,
        )
      }

      const record = canonical[STORE_KEY[descriptor.entityType]]
      if (addCommand.id in record) {
        return rebaseConflict(
          `Proposal ${proposal.id} cannot be rebased because ${descriptor.entityType} "${addCommand.id}" already exists.`,
        )
      }

      continue
    }

    if (SAFE_REBASE_COMMAND_KINDS.has(command.kind)) {
      if (command.kind === 'attach_player_to_game') {
        const gameConflict = ensureGameExists(proposal, canonical, command.payload.game_id)
        if (gameConflict) {
          return gameConflict
        }

        if (!(command.payload.player_id in canonical.players)) {
          return rebaseConflict(
            `Proposal ${proposal.id} cannot be rebased because player "${command.payload.player_id}" does not exist in the current model.`,
          )
        }

        if (canonical.games[command.payload.game_id]?.players.includes(command.payload.player_id)) {
          return rebaseConflict(
            `Proposal ${proposal.id} cannot be rebased because player "${command.payload.player_id}" is already attached to game "${command.payload.game_id}".`,
          )
        }
      }

      if (command.kind === 'attach_formalization_to_game') {
        const gameConflict = ensureGameExists(proposal, canonical, command.payload.game_id)
        if (gameConflict) {
          return gameConflict
        }

        if (!(command.payload.formalization_id in canonical.formalizations)) {
          return rebaseConflict(
            `Proposal ${proposal.id} cannot be rebased because formalization "${command.payload.formalization_id}" does not exist in the current model.`,
          )
        }

        if (canonical.games[command.payload.game_id]?.formalizations.includes(command.payload.formalization_id)) {
          return rebaseConflict(
            `Proposal ${proposal.id} cannot be rebased because formalization "${command.payload.formalization_id}" is already attached to game "${command.payload.game_id}".`,
          )
        }
      }

      continue
    }

    return rebaseConflict(
      `Proposal ${proposal.id} cannot be rebased because ${command.kind} is not append-only.`,
    )
  }

  return null
}

function proposalConflictFromDispatch(
  result: Exclude<DispatchResult, { status: 'committed' | 'dry_run' }>,
): ProposalConflict {
  switch (result.reason) {
    case 'revision_conflict':
      return {
        kind: 'revision_mismatch',
        message: result.errors[0] ?? 'Proposal base revision does not match the current model revision.',
      }
    case 'invariant_violated':
      return {
        kind: 'integrity',
        message: result.errors[0] ?? 'Proposal violates model integrity constraints.',
      }
    case 'validation_failed':
    case 'error':
      return {
        kind: 'validation',
        message: result.errors[0] ?? 'Proposal failed validation.',
      }
  }
}

function rejectionReasonForConflict(
  conflict: ProposalConflict,
): Extract<DispatchResult, { status: 'rejected' }>['reason'] {
  switch (conflict.kind) {
    case 'revision_mismatch':
      return 'revision_conflict'
    case 'integrity':
      return 'invariant_violated'
    case 'validation':
      return 'validation_failed'
  }
}

export function acceptConversationProposal(params: {
  proposalId: string
  canonical: CanonicalStore
  currentPersistedRevision: number
  dispatch: DispatchFn
}): AcceptConversationProposalResult {
  const proposal = getEvidenceProposal(params.proposalId)
  if (!proposal) {
    return {
      status: 'rejected',
      proposal: null,
      reason: 'error',
      errors: ['Proposal not found.'],
    }
  }

  if (proposal.status !== 'pending') {
    return {
      status: 'rejected',
      proposal,
      reason: 'error',
      errors: [`Proposal ${proposal.id} is ${proposal.status} and cannot be accepted.`],
    }
  }

  let baseRevision = proposal.base_revision
  if (baseRevision !== params.currentPersistedRevision) {
    const rebaseError = validateSafeRebase(proposal, params.canonical)
    if (rebaseError) {
      updateProposalStatus(params.proposalId, 'conflict', 'modified', {
        conflicts: [rebaseError],
      })
      return {
        status: 'rejected',
        proposal,
        reason: rejectionReasonForConflict(rebaseError),
        errors: [rebaseError.message],
      }
    }

    baseRevision = params.currentPersistedRevision
  }

  const result = params.dispatch({
    kind: 'batch',
    label: proposal.description,
    base_revision: baseRevision,
    commands: proposal.commands,
  })

  if (result.status === 'committed') {
    updateProposalStatus(params.proposalId, 'accepted', 'accepted')
    return {
      status: 'accepted',
      proposal,
      result,
    }
  }

  if (result.status !== 'rejected') {
    return {
      status: 'rejected',
      proposal,
      reason: 'error',
      errors: ['Proposal acceptance unexpectedly returned a dry-run result.'],
    }
  }

  const conflict = proposalConflictFromDispatch(result)
  updateProposalStatus(params.proposalId, 'conflict', 'modified', {
    conflicts: [conflict],
  })
  return {
    status: 'rejected',
    proposal,
    reason: result.reason,
    errors: result.errors,
  }
}
