import { z } from 'zod'

import type { PhaseToolResult } from '../../types/mcp'
import type {
  AssumptionExtractionResult,
  EvidenceProposal,
  FormalizationResult,
  Phase6Subsection,
} from '../../types/analysis-pipeline'
import type { RuntimeToolContext, McpServerLike } from '../context'
import { getPipelineState } from '../../store/pipeline'
import { getPipelineRuntimeState } from '../../store/pipeline-runtime'

const phaseDefinitions = {
  1: {
    name: 'run_phase_1_grounding',
    phase_name: 'Situational Grounding',
    description: 'Phase 1: Situational Grounding. Research the strategic situation described by the user and produce evidence proposals across the 7 evidence categories.',
    schema: z.object({
      situation_description: z.string(),
      focus_areas: z.array(z.string()).optional(),
    }).strict(),
  },
  2: {
    name: 'run_phase_2_players',
    phase_name: 'Player Identification',
    description: 'Phase 2: Identify strategic players, objectives, and information asymmetries. Requires Phase 1 to be complete.',
    schema: z.object({
      additional_context: z.string().optional(),
    }).strict(),
  },
  3: {
    name: 'run_phase_3_baseline',
    phase_name: 'Baseline Strategic Model',
    description: 'Phase 3: Build the smallest baseline strategic model and canonical game mapping. Requires Phase 2 to be complete.',
    schema: z.object({}).strict(),
  },
  4: {
    name: 'run_phase_4_history',
    phase_name: 'Historical Repeated Game',
    description: 'Phase 4: Map historical interactions, trust, and repeated-game patterns. Requires Phase 3 to be complete.',
    schema: z.object({}).strict(),
  },
  6: {
    name: 'run_phase_6_formalization',
    phase_name: 'Full Formalization',
    description: 'Phase 6: Run full formalization across subsections 6a-6i, using proposal-driven canonical updates and derived solver summaries.',
    schema: z.object({
      subsections: z.array(z.enum(['6a', '6b', '6c', '6d', '6e', '6f', '6g', '6h', '6i'])).optional(),
    }).strict(),
  },
  7: {
    name: 'run_phase_7_assumptions',
    phase_name: 'Assumption Extraction',
    description: 'Phase 7: Extract assumptions, classify empirical versus game-theoretic dependencies, rate sensitivity, and identify correlated clusters.',
    schema: z.object({}).strict(),
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
  phase: 1 | 2 | 3 | 4 | 6 | 7
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
        await context.orchestrator.runPhase(1, {
          focus_areas: input.focus_areas,
        })
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
    async execute(input) {
      try {
        await context.orchestrator.runPhase(2, {
          additional_context: input.additional_context,
        })
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

  server.registerTool({
    name: 'run_phase_5_revalidation',
    description: 'Phase 5: review revalidation state, approve queued reruns, or dismiss pending triggers.',
    inputSchema: z.object({
      action: z.enum(['status', 'approve', 'dismiss']),
      event_id: z.string().optional(),
    }).strict(),
    async execute(input): Promise<PhaseToolResult> {
      try {
        if (input.action === 'status') {
          if (getPipelineState().analysis_state) {
            await context.orchestrator.runPhase(5)
          }
        } else if (!input.event_id) {
          return failureResult(5, 'Recursive Revalidation', 'event_id is required for approve and dismiss actions.')
        } else if (input.action === 'approve') {
          const outcome = await context.orchestrator.approveRevalidation(input.event_id)
          if (!outcome) {
            return failureResult(5, 'Recursive Revalidation', `No pending revalidation event found for ${input.event_id}.`)
          }
        } else {
          context.orchestrator.dismissRevalidation(input.event_id)
        }

        const pendingEvents = context.orchestrator.getPendingRevalidations()
        const pipelineRuntime = getPipelineRuntimeState()

        return {
          success: true,
          phase: 5,
          phase_name: 'Recursive Revalidation',
          summary: input.action === 'status'
            ? `${pendingEvents.length} revalidation event(s) are pending review.`
            : input.action === 'approve'
              ? `Approved revalidation event ${input.event_id}.`
              : `Dismissed revalidation event ${input.event_id}.`,
          entities_created: [],
          proposals: [],
          next_step: pendingEvents.length > 0
            ? 'Review remaining revalidation events or continue the queued rerun cycle.'
            : pipelineRuntime.active_rerun_cycle
              ? 'Continue the queued rerun cycle.'
              : 'No pending revalidation events remain.',
          warnings: [],
          revalidation: {
            action: input.action,
            pending_events: pendingEvents.map((event) => ({
              id: event.id,
              trigger_condition: event.trigger_condition,
              source_phase: event.source_phase,
              target_phases: event.target_phases,
              resolution: event.resolution,
              pass_number: event.pass_number,
            })),
            active_rerun_cycle: pipelineRuntime.active_rerun_cycle
              ? {
                  event_id: pipelineRuntime.active_rerun_cycle.event_id,
                  earliest_phase: pipelineRuntime.active_rerun_cycle.earliest_phase,
                  pass_number: pipelineRuntime.active_rerun_cycle.pass_number,
                  status: pipelineRuntime.active_rerun_cycle.status,
                }
              : null,
          },
        }
      } catch (error) {
        return failureResult(5, 'Recursive Revalidation', error instanceof Error ? error.message : 'Phase 5 failed.')
      }
    },
  })

  server.registerTool({
    name: phaseDefinitions[6].name,
    description: phaseDefinitions[6].description,
    inputSchema: phaseDefinitions[6].schema,
    async execute(input): Promise<PhaseToolResult> {
      try {
        await context.orchestrator.runPhase(6, {
          subsections: input.subsections as Phase6Subsection[] | undefined,
        })
        const phaseResult = getPipelineState().phase_results[6] as FormalizationResult | undefined
        const subsectionSummary = phaseResult?.subsection_statuses
          .map((entry) => `${entry.subsection} ${entry.status}`)
          .join(', ')

        return {
          success: true,
          phase: 6,
          phase_name: phaseDefinitions[6].phase_name,
          summary: phaseResult
            ? `Phase 6 ${phaseResult.status.status}. ${phaseResult.proposals.length} proposal(s) across ${phaseResult.proposal_groups.length} subsection group(s).`
            : 'Phase 6 completed.',
          entities_created: entitiesFromProposals(phaseResult?.proposals ?? []),
          proposals: proposalsToResult(phaseResult?.proposals ?? []),
          next_step: subsectionSummary
            ? `Review Phase 6 proposal groups, then continue with Phase 7. Subsections: ${subsectionSummary}.`
            : 'Review Phase 6 proposal groups, then continue with Phase 7.',
          warnings: [
            ...(phaseResult?.status.gaps ?? []),
            ...(phaseResult?.formal_representations.warnings ?? []),
            ...(phaseResult?.payoff_estimation.warnings ?? []),
            ...(phaseResult?.baseline_equilibria.warnings ?? []),
            ...(phaseResult?.equilibrium_selection.warnings ?? []),
            ...(phaseResult?.behavioral_overlays?.warnings ?? []),
            ...(phaseResult?.cross_game_effects?.warnings ?? []),
          ],
        }
      } catch (error) {
        return failureResult(6, phaseDefinitions[6].phase_name, error instanceof Error ? error.message : 'Phase 6 failed.')
      }
    },
  })

  server.registerTool({
    name: phaseDefinitions[7].name,
    description: phaseDefinitions[7].description,
    inputSchema: phaseDefinitions[7].schema,
    async execute(): Promise<PhaseToolResult> {
      try {
        await context.orchestrator.runPhase(7)
        const phaseResult = getPipelineState().phase_results[7] as AssumptionExtractionResult | undefined
        const criticalWarning = phaseResult?.sensitivity_summary.inference_only_critical
          ? `${phaseResult.sensitivity_summary.inference_only_critical} critical assumption(s) rely on inference-only support.`
          : undefined

        return {
          success: true,
          phase: 7,
          phase_name: phaseDefinitions[7].phase_name,
          summary: phaseResult
            ? `Phase 7 ${phaseResult.status.status}. Extracted ${phaseResult.assumptions.length} assumptions across ${phaseResult.correlated_clusters.length} cluster(s).`
            : 'Phase 7 completed.',
          entities_created: entitiesFromProposals(phaseResult?.proposals ?? []),
          proposals: proposalsToResult(phaseResult?.proposals ?? []),
          next_step: 'Review Phase 7 assumption proposals, then continue with Phase 8.',
          warnings: [
            ...(phaseResult?.status.gaps ?? []),
            ...(criticalWarning ? [criticalWarning] : []),
          ],
        }
      } catch (error) {
        return failureResult(7, phaseDefinitions[7].phase_name, error instanceof Error ? error.message : 'Phase 7 failed.')
      }
    },
  })

  const stubPhaseSchema = z.object({}).strict()
  const stubs: Array<{ phase: number; name: string; phase_name: string; description: string }> = [
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
        return failureResult(stub.phase, stub.phase_name, `Phase ${stub.phase} is not implemented in this milestone.`)
      },
    })
  }
}
