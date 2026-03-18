// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildAnalysisNoopMessage,
  buildAnalysisSuccessMessage,
  handleAnalysisRequest,
  requestAnalysisPlannerResult,
} from '@/components/panels/ai-chat-handlers'
import { useAnalysisStore } from '@/stores/analysis-store'
import { createDefaultAnalysis } from '@/services/analysis/analysis-normalization'
import { createAnalysisSummary } from '@/services/analysis/analysis-summary'
import { validateAnalysis } from '@/services/analysis/analysis-validation'

const { streamChatMock } = vi.hoisted(() => ({
  streamChatMock: vi.fn(async function* () {
    yield { type: 'text', content: 'Answer from analysis context.' }
  }),
}))
vi.mock('@/services/ai/ai-service', () => ({
  streamChat: streamChatMock,
}))

function resetAnalysisStore() {
  useAnalysisStore.setState(useAnalysisStore.getInitialState(), true)
}

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

function makeResponse(text: string) {
  return {
    ok: true,
    json: async () => ({ text }),
    text: async () => text,
  } as Response
}

describe('analysis chat handlers', () => {
  beforeEach(() => {
    resetAnalysisStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    streamChatMock.mockClear()
    resetAnalysisStore()
  })

  it('keeps analysis context in the system prompt for answer mode', async () => {
    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
    })

    const abortController = new AbortController()
    const result = await handleAnalysisRequest({
      messageText: 'What are the best responses?',
      messages: [
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Previous answer',
          timestamp: Date.now(),
        },
      ],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController,
    })

    const calls = streamChatMock.mock.calls as Array<unknown[]>
    const systemPrompt = calls[0]?.[0]
    const history = calls[0]?.[1] as Array<{ role: string; content: string }> | undefined

    expect(result).toBe('Answer from analysis context.')
    expect(String(systemPrompt)).toContain('ANALYSIS CONTEXT')
    expect(String(systemPrompt)).toContain('Pricing Game')
    expect(String(systemPrompt)).toContain('Revision')
    expect(history).toBeDefined()
    expect(Array.isArray(history)).toBe(true)
    expect(history?.at(-1)?.content).toBe('What are the best responses?')
  })

  it('formats the success message with applied changes and current analysis only', () => {
    const analysis = makeAnalysis()
    const validation = validateAnalysis(analysis)
    const summary = createAnalysisSummary(analysis, validation)

    const message = buildAnalysisSuccessMessage(
      [
        {
          type: 'rename-analysis',
          name: 'Pricing Game',
        },
      ],
      summary,
    )

    expect(message).toContain('Applied changes')
    expect(message).toContain('Current analysis')
    expect(message).not.toContain('Planned changes')
  })

  it('includes a workflow stage line in the success message when requested', () => {
    const analysis = makeAnalysis()
    const validation = validateAnalysis(analysis)
    const summary = createAnalysisSummary(analysis, validation)

    const message = buildAnalysisSuccessMessage(
      [
        {
          type: 'set-workflow-stage',
          stage: 'review',
        },
      ],
      summary,
      'review',
    )

    expect(message).toContain('Workflow moved to Review')
    expect(message).toContain('Set workflow stage to review.')
  })

  it('formats noop responses with the supplied error reason', () => {
    const message = buildAnalysisNoopMessage(
      'The analysis changed while AI was working; no changes were applied.',
      'Stale analysis snapshot',
    )

    expect(message).toContain('Stale analysis snapshot')
    expect(message).toContain('The analysis changed while AI was working; no changes were applied.')
    expect(message).toContain('No changes were applied.')
  })

  it('returns a stale snapshot noop when the analysis changes during planning', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeResponse(JSON.stringify({
      kind: 'edit',
      operations: [
        {
          type: 'rename-analysis',
          name: 'Updated Analysis',
        },
      ],
    }))))
    vi.stubGlobal('fetch', fetchMock)

    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
    })

    const abortController = new AbortController()
    const request = handleAnalysisRequest({
      messageText: 'Rename the analysis',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController,
    })

    useAnalysisStore.getState().renameAnalysis('Changed while planning')
    const result = await request

    expect(result).toContain('Stale analysis snapshot')
    expect(useAnalysisStore.getState().analysis.name).toBe('Changed while planning')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('returns a stale snapshot noop when the workflow stage changes during planning', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(makeResponse(JSON.stringify({
      kind: 'edit',
      operations: [
        {
          type: 'set-workflow-stage',
          stage: 'review',
        },
      ],
    }))))
    vi.stubGlobal('fetch', fetchMock)

    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
      workflow: { currentStage: 'details' },
      analysisRevision: 0,
      workflowRevision: 0,
    } as any)

    const abortController = new AbortController()
    const request = handleAnalysisRequest({
      messageText: 'Set the workflow stage to review',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController,
    })

    useAnalysisStore.getState().setWorkflowStage('strategies')
    const result = await request

    expect(result).toContain('Stale analysis snapshot')
    expect(useAnalysisStore.getState().workflow.currentStage).toBe('strategies')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats same-value analysis edits as no-ops', async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'rename-analysis',
                name: 'Pricing Game',
              },
            ],
          }),
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
      analysisRevision: 0,
      workflowRevision: 0,
      isDirty: false,
    } as any)

    const result = await handleAnalysisRequest({
      messageText: 'Rename the analysis to Pricing Game',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })

    expect(result).toContain('No changes were applied.')
    expect(useAnalysisStore.getState().analysisRevision).toBe(0)
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)
    expect(useAnalysisStore.getState().isDirty).toBe(false)
  })

  it('retries the planner once after invalid JSON and succeeds on the repaired response', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse('not valid json'))
      .mockResolvedValueOnce(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'rename-analysis',
                name: 'Pricing Game Revised',
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
    })

    const abortController = new AbortController()
    const result = await handleAnalysisRequest({
      messageText: 'Rename the analysis',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController,
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toContain('Applied 1 analysis change')
    expect(useAnalysisStore.getState().analysis.name).toBe('Pricing Game Revised')
  })

  it('applies workflow stage changes through the combined analysis-workflow commit path', async () => {
    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
      workflow: { currentStage: 'details' },
      analysisRevision: 0,
      workflowRevision: 0,
    } as any)

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'rename-analysis',
                name: 'Pricing Game Revised',
              },
              {
                type: 'set-workflow-stage',
                stage: 'review',
              },
            ],
          }),
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await handleAnalysisRequest({
      messageText: 'Rename the analysis and move it to review',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })

    expect(useAnalysisStore.getState().analysis.name).toBe('Pricing Game Revised')
    expect(useAnalysisStore.getState().workflow.currentStage).toBe('review')
    expect(useAnalysisStore.getState().analysisRevision).toBe(1)
    expect(useAnalysisStore.getState().workflowRevision).toBe(1)
    expect(result).toContain('Workflow moved to Review')
  })

  it('rejects batches that introduce new validation issues', async () => {
    const analysis = makeAnalysis()
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'rename-player',
                playerId: analysis.players[1].id,
                name: 'Incumbent',
              },
            ],
          }),
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
      analysisRevision: 0,
      workflowRevision: 0,
    } as any)

    const result = await handleAnalysisRequest({
      messageText: 'Rename player 2 to Incumbent',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })

    expect(result).toContain('Invalid analysis changes')
    expect(useAnalysisStore.getState().analysis.players[1].name).toBe('Entrant')
    expect(useAnalysisStore.getState().analysisRevision).toBe(0)
  })

  it('rejects blocked workflow stage requests', async () => {
    const analysis = createDefaultAnalysis()
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'set-workflow-stage',
                stage: 'review',
              },
            ],
          }),
        ),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
      workflow: { currentStage: 'details' },
      analysisRevision: 0,
      workflowRevision: 0,
    } as any)

    const result = await handleAnalysisRequest({
      messageText: 'Set the workflow stage to review',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })

    expect(result).toContain('Blocked workflow stage')
    expect(useAnalysisStore.getState().workflow.currentStage).toBe('details')
    expect(useAnalysisStore.getState().workflowRevision).toBe(0)
  })

  it('propagates apply failures for unsupported operations', async () => {
    const applyFailureFetch = vi.fn(async () =>
      makeResponse(
        JSON.stringify({
          kind: 'edit',
          operations: [
            {
              type: 'rename-player',
              playerId: 'missing-player',
              name: 'Unknown',
            },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', applyFailureFetch)

    const analysis = makeAnalysis()
    useAnalysisStore.setState({
      analysis,
      validation: validateAnalysis(analysis),
    })

    await expect(handleAnalysisRequest({
      messageText: 'Rename a player that does not exist',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })).rejects.toThrow(
      'Analysis AI operation 1 player id "missing-player" was not found.',
    )
  })

  it('surfaces planner failures after retry through the no-op message format', async () => {
    const plannerFailureFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse('still not json'))
      .mockResolvedValueOnce(makeResponse('still not json'))
    vi.stubGlobal('fetch', plannerFailureFetch)

    await expect(handleAnalysisRequest({
      messageText: 'Rename the analysis',
      messages: [],
      model: 'claude-sonnet-4-5-20250929',
      provider: 'anthropic',
      updateLastMessage: vi.fn(),
      abortController: new AbortController(),
    })).rejects.toThrow('The assistant could not produce a valid analysis edit plan.')

    expect(plannerFailureFetch).toHaveBeenCalledTimes(2)
  })

  it('parses planner output through the exported retry helper', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse('broken output'))
      .mockResolvedValueOnce(
        makeResponse(
          JSON.stringify({
            kind: 'edit',
            operations: [
              {
                type: 'rename-analysis',
                name: 'Pricing Game Revised',
              },
            ],
          }),
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await requestAnalysisPlannerResult(
      'Rename the analysis',
      'ANALYSIS CONTEXT\nRevision: 7\nAnalysis: Pricing Game (analysis-1)',
      'claude-sonnet-4-5-20250929',
      'anthropic',
      new AbortController().signal,
    )

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({
      kind: 'edit',
      operations: [
        {
          type: 'rename-analysis',
          name: 'Pricing Game Revised',
        },
      ],
    })
  })
})
