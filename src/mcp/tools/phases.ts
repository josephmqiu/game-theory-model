import { z } from 'zod'

import type { PhaseToolResult } from '../../types/mcp'
import type { EvidenceProposal } from '../../types/analysis-pipeline'
import type { RuntimeToolContext, McpServerLike } from '../context'
import { getPipelineState } from '../../store/pipeline'

const phaseDefinitions = {
  1: {
    name: 'run_phase_1_grounding',
    phase_name: 'Situational Grounding',
    description: 'Phase 1: Situational Grounding. Research the strategic situation described by the user and produce evidence proposals across the 7 evidence categories.',
    schema: z.object({
      situation_description: z.string(),
      focus_areas: z.array(z.string()).optional(),
      attachments: z.array(z.string()).optional(),
    }),
  },
  2: {
    name: 'run_phase_2_players',
    phase_name: 'Player Identification',
    description: 'Phase 2: Identify strategic players, objectives, and information asymmetries. Requires Phase 1 to be complete.',
    schema: z.object({
      additional_context: z.string().optional(),
    }),
  },
  3: {
    name: 'run_phase_3_baseline',
    phase_name: 'Baseline Strategic Model',
    description: 'Phase 3: Build the smallest baseline strategic model and canonical game mapping. Requires Phase 2 to be complete.',
    schema: z.object({
      game_type_hints: z.array(z.string()).optional(),
    }),
  },
  4: {
    name: 'run_phase_4_history',
    phase_name: 'Historical Repeated Game',
    description: 'Phase 4: Map historical interactions, trust, and repeated-game patterns. Requires Phase 3 to be complete.',
    schema: z.object({
      time_horizon: z.string().optional(),
    }),
  },
} as const

function proposalsToResult(proposals: EvidenceProposal[]): PhaseToolResult['proposals'] {
  return proposals.map((proposal) => ({
    id: proposal.id,
    description: proposal.description,
    status: 'pending',
  }))
}

function entitiesFromProposals(proposals: EvidenceProposal[]): PhaseToolResult['entities_created'] {
  return proposals.flatMap((proposal) =>
    proposal.entity_previews
      .filter((preview) => preview.entity_id)
      .map((preview) => ({
        type: preview.entity_type,
        id: preview.entity_id!,
        label: String(preview.preview.name ?? preview.preview.title ?? preview.preview.statement ?? preview.preview.text ?? preview.entity_type),
      })),
  )
}

function successResult(params: {
  phase: 1 | 2 | 3 | 4
  summary: string
  proposals: EvidenceProposal[]
  nextStep?: string
  warnings?: string[]
}): PhaseToolResult {
  const def = phaseDefinitions[params.phase]
  return {
    success: true,
    phase: params.phase,
    phase_name: def.phase_name,
    summary: params.summary,
    entities_created: entitiesFromProposals(params.proposals),
    proposals: proposalsToResult(params.proposals),
    next_step: params.nextStep,
    warnings: params.warnings ?? [],
  }
}

function failureResult(phase: number, phase_name: string, error: string): PhaseToolResult {
  return {
    success: false,
    phase,
    phase_name,
    summary: error,
    entities_created: [],
    proposals: [],
    warnings: [],
    error,
  }
}

export function registerPhaseTools(server: McpServerLike, context: RuntimeToolContext): void {
  server.registerTool({
    name: phaseDefinitions[1].name,
    description: phaseDefinitions[1].description,
    inputSchema: phaseDefinitions[1].schema,
    async execute(input) {
      try {
        const currentAnalysis = getPipelineState().analysis_state
        if (!currentAnalysis || currentAnalysis.event_description !== input.situation_description) {
          await context.orchestrator.startAnalysis(input.situation_description)
        }
        await context.orchestrator.runPhase(1)
        const phaseResult = getPipelineState().phase_results[1] as { proposals: EvidenceProposal[] } | undefined
        return successResult({
          phase: 1,
          summary: `Phase 1 complete. ${phaseResult?.proposals.length ?? 0} evidence proposal groups are ready for review.`,
          proposals: phaseResult?.proposals ?? [],
          nextStep: 'Proceed with run_phase_2_players to identify strategic actors.',
        })
      } catch (error) {
        return failureResult(1, phaseDefinitions[1].phase_name, error instanceof Error ? error.message : 'Phase 1 failed.')
      }
    },
  })

  server.registerTool({
    name: phaseDefinitions[2].name,
    description: phaseDefinitions[2].description,
    inputSchema: phaseDefinitions[2].schema,
    async execute() {
      try {
        await context.orchestrator.runPhase(2)
        const phaseResult = getPipelineState().phase_results[2] as { proposals: EvidenceProposal[] } | undefined
        return successResult({
          phase: 2,
          summary: `Phase 2 complete. ${phaseResult?.proposals.length ?? 0} player proposals are ready for review.`,
          proposals: phaseResult?.proposals ?? [],
          nextStep: 'Proceed with run_phase_3_baseline after reviewing player proposals.',
        })
      } catch (error) {
        return failureResult(2, phaseDefinitions[2].phase_name, error instanceof Error ? error.message : 'Phase 2 failed.')
      }
    },
  })

  server.registerTool({
    name: phaseDefinitions[3].name,
    description: phaseDefinitions[3].description,
    inputSchema: phaseDefinitions[3].schema,
    async execute() {
      try {
        await context.orchestrator.runPhase(3)
        const phaseResult = getPipelineState().phase_results[3] as { proposals: EvidenceProposal[] } | undefined
        return successResult({
          phase: 3,
          summary: `Phase 3 complete. ${phaseResult?.proposals.length ?? 0} baseline model proposals are ready for review.`,
          proposals: phaseResult?.proposals ?? [],
          nextStep: 'Proceed with run_phase_4_history after accepting the baseline model proposals.',
        })
      } catch (error) {
        return failureResult(3, phaseDefinitions[3].phase_name, error instanceof Error ? error.message : 'Phase 3 failed.')
      }
    },
  })

  server.registerTool({
    name: phaseDefinitions[4].name,
    description: phaseDefinitions[4].description,
    inputSchema: phaseDefinitions[4].schema,
    async execute() {
      try {
        await context.orchestrator.runPhase(4)
        const phaseResult = getPipelineState().phase_results[4] as { proposals: EvidenceProposal[] } | undefined
        return successResult({
          phase: 4,
          summary: `Phase 4 complete. ${phaseResult?.proposals.length ?? 0} history and trust proposals are ready for review.`,
          proposals: phaseResult?.proposals ?? [],
          nextStep: 'Phase 4 complete. Revalidation or Phase 6 formalization would follow in later milestones.',
        })
      } catch (error) {
        return failureResult(4, phaseDefinitions[4].phase_name, error instanceof Error ? error.message : 'Phase 4 failed.')
      }
    },
  })

  const stubPhaseSchema = z.object({})
  const stubs: Array<{ phase: number; name: string; phase_name: string; description: string }> = [
    { phase: 5, name: 'run_phase_5_revalidation', phase_name: 'Recursive Revalidation', description: 'Phase 5: Recursive Revalidation.' },
    { phase: 6, name: 'run_phase_6_formalization', phase_name: 'Full Formalization', description: 'Phase 6: Full formal modeling.' },
    { phase: 7, name: 'run_phase_7_assumptions', phase_name: 'Assumption Extraction', description: 'Phase 7: Assumption extraction.' },
    { phase: 8, name: 'run_phase_8_elimination', phase_name: 'Elimination', description: 'Phase 8: Eliminate implausible outcomes.' },
    { phase: 9, name: 'run_phase_9_scenarios', phase_name: 'Scenario Generation', description: 'Phase 9: Scenario generation.' },
    { phase: 10, name: 'run_phase_10_metacheck', phase_name: 'Meta-check', description: 'Phase 10: Meta-check and adversarial challenge.' },
  ]

  for (const stub of stubs) {
    server.registerTool({
      name: stub.name,
      description: stub.description,
      inputSchema: stubPhaseSchema,
      execute() {
        return failureResult(stub.phase, stub.phase_name, `Phase ${stub.phase} is not implemented in this M5 milestone.`)
      },
    })
  }
}
