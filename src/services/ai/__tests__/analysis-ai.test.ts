import { describe, expect, it } from 'vitest'
import {
  applyAnalysisOperations,
  applyAnalysisWorkflowOperations,
  buildAnalysisAIContext,
  classifyAnalysisIntent,
  parseAnalysisAIPlannerResult,
} from '@/services/ai/analysis-ai-helpers'
import { createAnalysisInsights } from '@/services/analysis/analysis-insights'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { createAnalysisSummary } from '@/services/analysis/analysis-summary'
import { createAnalysisWorkflow } from '@/services/analysis/analysis-workflow'
import { validateAnalysis } from '@/services/analysis/analysis-validation'

function makeAnalysis() {
  const analysis = createDefaultAnalysis()
  analysis.name = 'Pricing Game'
  analysis.players[0].name = 'Incumbent'
  analysis.players[1].name = 'Entrant'
  analysis.players[0].strategies[0].name = 'High price'
  analysis.players[0].strategies[1].name = 'Low price'
  analysis.players[1].strategies[0].name = 'Enter'
  analysis.players[1].strategies[1].name = 'Stay out'
  analysis.profiles[0].payoffs = [6, -2]
  analysis.profiles[1].payoffs = [4, 1]
  analysis.profiles[2].payoffs = [2, 3]
  analysis.profiles[3].payoffs = [1, 5]
  return analysis
}

describe('analysis AI helpers', () => {
  it('routes explicit edit prompts locally and keeps ambiguous prompts in answer mode', () => {
    expect(classifyAnalysisIntent('Please add a strategy for player 1')).toBe('edit')
    expect(classifyAnalysisIntent('Set the payoff cell for High price versus Enter')).toBe('edit')
    expect(classifyAnalysisIntent('Set the workflow stage to review')).toBe('edit')
    expect(classifyAnalysisIntent('What is the Nash equilibrium?')).toBe('answer')
    expect(classifyAnalysisIntent('Summarize this game')).toBe('answer')
  })

  it('builds a deterministic analysis context snapshot with ids, payoffs, validation, insights, and workflow state', () => {
    const analysis = makeAnalysis()
    const validation = validateAnalysis(analysis)
    const summary = createAnalysisSummary(analysis, validation)
    const insights = createAnalysisInsights(analysis, validation)
    const workflow = createAnalysisWorkflow(analysis, validation, summary, insights, 'review')
    const { prompt, workflow: contextWorkflow } = buildAnalysisAIContext(
      analysis,
      validation,
      summary,
      insights,
      7,
      workflow.currentStage,
    )

    expect(prompt).toContain('Revision: 7')
    expect(prompt).toContain('Pricing Game')
    expect(prompt).toContain('Incumbent')
    expect(prompt).toContain('Enter')
    expect(prompt).toContain('WORKFLOW')
    expect(prompt).toContain('PAYOFF PROFILES')
    expect(prompt).toContain('VALIDATION ISSUES')
    expect(prompt).toContain('STRATEGIC INSIGHTS')
    expect(contextWorkflow.currentStage).toBe(workflow.currentStage)
    expect(contextWorkflow.stages).toHaveLength(5)
  })

  it('parses edit and cannot-edit planner results from strict JSON', () => {
    const edit = parseAnalysisAIPlannerResult(
      [
        '```json',
        '{',
        '  "kind": "edit",',
        '  "operations": [',
        '    {',
        '      "type": "add-strategy",',
        '      "playerId": "player-1",',
        '      "strategyId": "player-1-middle",',
        '      "name": "Middle"',
        '    }',
        '  ]',
        '}',
        '```',
      ].join('\n'),
    )

    expect(edit).toEqual({
      kind: 'edit',
      operations: [
        {
          type: 'add-strategy',
          playerId: 'player-1',
          strategyId: 'player-1-middle',
          name: 'Middle',
        },
      ],
    })

    const stageEdit = parseAnalysisAIPlannerResult(
      '{"kind":"edit","operations":[{"type":"set-workflow-stage","stage":"review"}]}',
    )

    expect(stageEdit).toEqual({
      kind: 'edit',
      operations: [
        {
          type: 'set-workflow-stage',
          stage: 'review',
        },
      ],
    })

    const cannotEdit = parseAnalysisAIPlannerResult(
      '{"kind":"cannot_edit","reason":"Deleting a strategy is out of scope."}',
    )

    expect(cannotEdit).toEqual({
      kind: 'cannot_edit',
      reason: 'Deleting a strategy is out of scope.',
    })
  })

  it('rejects unsupported partial planner results', () => {
    expect(
      parseAnalysisAIPlannerResult(
        '{"kind":"edit","operations":[{"type":"set-payoff","playerId":"player-1","payoff":9}]}',
      ),
    ).toBeNull()

    expect(
      parseAnalysisAIPlannerResult(
        '{"kind":"edit","operations":[{"type":"remove-strategy","playerId":"player-1","strategyId":"s1"}]}',
      ),
    ).toBeNull()
  })

  it('applies ordered operations with explicit strategy ids and renormalizes the matrix', () => {
    const analysis = makeAnalysis()
    const originalProfileCount = analysis.profiles.length

    const nextAnalysis = applyAnalysisOperations(analysis, [
      {
        type: 'add-strategy',
        playerId: analysis.players[0].id,
        strategyId: 'player-1-middle',
        name: 'Middle',
      },
      {
        type: 'set-profile-payoffs',
        player1StrategyId: 'player-1-middle',
        player2StrategyId: analysis.players[1].strategies[0].id,
        payoffs: [9, 2],
      },
    ])

    expect(analysis.players[0].strategies).toHaveLength(2)
    expect(nextAnalysis.players[0].strategies.map((strategy) => strategy.id)).toContain(
      'player-1-middle',
    )
    expect(nextAnalysis.profiles).toHaveLength(originalProfileCount + 2)
    expect(
      nextAnalysis.profiles.find(
        (profile) =>
          profile.player1StrategyId === 'player-1-middle' &&
          profile.player2StrategyId === analysis.players[1].strategies[0].id,
      )?.payoffs,
    ).toEqual([9, 2])
    expect(
      nextAnalysis.profiles.find(
        (profile) =>
          profile.player1StrategyId === analysis.players[0].strategies[0].id &&
          profile.player2StrategyId === analysis.players[1].strategies[0].id,
      )?.payoffs,
    ).toEqual([6, -2])
  })

  it('applies mixed analysis and workflow operations as one batch result', () => {
    const analysis = makeAnalysis()
    const result = applyAnalysisWorkflowOperations(analysis, [
      {
        type: 'rename-analysis',
        name: 'Pricing Game Revised',
      },
      {
        type: 'set-workflow-stage',
        stage: 'review',
      },
    ])

    expect(result.analysis.name).toBe('Pricing Game Revised')
    expect(result.workflowStage).toBe('review')
    expect(result.workflowStageChanged).toBe(true)
    expect(result.analysisOperationCount).toBe(1)
  })

  it('aborts the full batch when any operation is invalid', () => {
    const analysis = makeAnalysis()
    const snapshot = structuredClone(analysis)

    expect(() =>
      applyAnalysisOperations(analysis, [
        {
          type: 'rename-analysis',
          name: 'Changed',
        },
        {
          type: 'rename-player',
          playerId: 'missing-player',
          name: 'Unknown',
        },
      ]),
    ).toThrow('player id "missing-player" was not found')

    expect(analysis).toEqual(snapshot)
  })

  it('throws a dedicated error when workflow stage operations skip the workflow batch helper', () => {
    const analysis = makeAnalysis()

    expect(() =>
      applyAnalysisOperations(analysis, [
        {
          type: 'set-workflow-stage',
          stage: 'review',
        },
      ]),
    ).toThrow('set-workflow-stage must be handled by applyAnalysisWorkflowOperations')
  })
})
