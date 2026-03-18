import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { useAIStore } from '@/stores/ai-store'
import { useAnalysisStore } from '@/stores/analysis-store'
import { streamChat } from '@/services/ai/ai-service'
import { ANALYSIS_CHAT_SYSTEM_PROMPT, ANALYSIS_EDIT_PLANNER_PROMPT } from '@/services/ai/analysis-ai-prompts'
import {
  applyAnalysisWorkflowOperations,
  buildAnalysisAIContext,
  classifyAnalysisIntent,
  parseAnalysisAIPlannerResult,
} from '@/services/ai/analysis-ai-helpers'
import type {
  AnalysisAIPlannerResult,
  AnalysisAIOperation,
} from '@/services/ai/analysis-ai-types'
import { createAnalysisInsights } from '@/services/analysis/analysis-insights'
import { areAnalysesEqual } from '@/services/analysis/analysis-normalization'
import {
  createAnalysisSummary,
  type AnalysisSummary,
} from '@/services/analysis/analysis-summary'
import {
  canTransitionToWorkflowStage,
  GUIDED_WORKFLOW_STAGE_LABELS,
  getAnalysisWorkflowStageSummary,
  createAnalysisWorkflow,
} from '@/services/analysis/analysis-workflow'
import { validateAnalysis } from '@/services/analysis/analysis-validation'
import type { AnalysisValidation, GuidedWorkflowStage } from '@/types/analysis'
import { trimChatHistory } from '@/services/ai/context-optimizer'
import type { ChatMessage as ChatMessageType } from '@/services/ai/ai-types'
import { CHAT_STREAM_THINKING_CONFIG } from '@/services/ai/ai-runtime-config'
import {
  needsSimplifiedPrompt,
  resolveModelProfile,
} from '@/services/ai/model-profiles'
import type { AIProviderType } from '@/types/agent-settings'

async function generateText(
  system: string,
  message: string,
  model: string,
  provider: AIProviderType | undefined,
  abortSignal: AbortSignal,
): Promise<string> {
  const response = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      message,
      model,
      provider,
    }),
    signal: abortSignal,
  })

  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Planner request failed: ${response.status} ${errText}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(String(data.error))
  }

  return String(data.text ?? '')
}

function buildAnalysisPlannerUserMessage(
  request: string,
  context: string,
): string {
  return [
    'USER REQUEST:',
    request,
    '',
    context,
  ].join('\n')
}

function buildAnalysisPlannerRepairPrompt(
  request: string,
  context: string,
  rawOutput: string,
): string {
  return [
    'Your previous response was not valid JSON for the required planner schema.',
    'Return only valid JSON now. Do not add markdown, prose, or code fences.',
    '',
    'USER REQUEST:',
    request,
    '',
    context,
    '',
    'PREVIOUS INVALID OUTPUT:',
    rawOutput,
  ].join('\n')
}

function formatAnalysisOperation(operation: AnalysisAIOperation): string {
  switch (operation.type) {
    case 'rename-analysis':
      return `Rename the analysis to "${operation.name}".`
    case 'rename-player':
      return `Rename player ${operation.playerId} to "${operation.name}".`
    case 'add-strategy':
      return `Add strategy "${operation.name}" (${operation.strategyId}) to player ${operation.playerId}.`
    case 'rename-strategy':
      return `Rename strategy ${operation.strategyId} for player ${operation.playerId} to "${operation.name}".`
    case 'set-profile-payoffs':
      return `Set payoffs for ${operation.player1StrategyId} vs ${operation.player2StrategyId} to [${String(operation.payoffs[0])}, ${String(operation.payoffs[1])}].`
    case 'set-workflow-stage':
      return `Set workflow stage to ${operation.stage}.`
  }
}

function formatWorkflowStage(stage: GuidedWorkflowStage): string {
  return GUIDED_WORKFLOW_STAGE_LABELS[stage]
}

export function buildAnalysisSuccessMessage(
  operations: AnalysisAIOperation[],
  summary: AnalysisSummary,
  workflowStage: GuidedWorkflowStage | null = null,
): string {
  const appliedLines = operations.map((operation) => `[done] ${formatAnalysisOperation(operation)}`)
  const workflowLine = workflowStage
    ? `<step title="Workflow stage" status="done">[done] Workflow moved to ${formatWorkflowStage(workflowStage)}.</step>`
    : null

  return [
    `<step title="Applied changes" status="done">${appliedLines.join('\n')}</step>`,
    `<step title="Current analysis" status="done">[done] ${summary.statusLabel}\n[done] ${summary.progressLabel}</step>`,
    workflowLine,
    `Applied ${operations.length} analysis change${operations.length === 1 ? '' : 's'}. ${summary.statusLabel}. ${summary.progressLabel}.`,
  ].filter(Boolean).join('\n\n')
}

export function buildAnalysisNoopMessage(
  reason: string,
  title = 'No changes applied',
): string {
  return [
    '<step title="Reviewing request" status="done">[done] Checked the request against the supported analysis edit set.</step>',
    `<step title="${title}" status="error">[error] ${reason}</step>`,
    'No changes were applied.',
  ].join('\n\n')
}

function buildAnalysisAnswerSystemPrompt(contextPrompt: string): string {
  return `${ANALYSIS_CHAT_SYSTEM_PROMPT}\n\n${contextPrompt}`
}

function getWorkflowSnapshot() {
  const state = useAnalysisStore.getState()
  return {
    currentStage: state.workflow.currentStage,
    workflowRevision: state.workflowRevision,
  }
}

function getIntroducedValidationIssues(
  previousValidation: AnalysisValidation,
  nextValidation: AnalysisValidation,
): string[] {
  const previousIssues = new Set(
    previousValidation.issues.map((issue) => `${issue.path}::${issue.message}`),
  )

  return nextValidation.issues
    .filter((issue) => !previousIssues.has(`${issue.path}::${issue.message}`))
    .map((issue) => issue.message)
}

export async function requestAnalysisPlannerResult(
  messageText: string,
  context: string,
  model: string,
  provider: AIProviderType | undefined,
  abortSignal: AbortSignal,
): Promise<AnalysisAIPlannerResult> {
  const profile = resolveModelProfile(model)
  const inlineSystem = needsSimplifiedPrompt(profile)
  const basePrompt = buildAnalysisPlannerUserMessage(messageText, context)
  const systemPrompt = inlineSystem ? '' : ANALYSIS_EDIT_PLANNER_PROMPT
  const firstMessage = inlineSystem
    ? `${ANALYSIS_EDIT_PLANNER_PROMPT}\n\n---\n\n${basePrompt}`
    : basePrompt

  const firstOutput = await generateText(
    systemPrompt,
    firstMessage,
    model,
    provider,
    abortSignal,
  )
  const parsedFirst = parseAnalysisAIPlannerResult(firstOutput)
  if (parsedFirst) {
    return parsedFirst
  }

  const repairMessage = buildAnalysisPlannerRepairPrompt(
    messageText,
    context,
    firstOutput,
  )
  const repairedOutput = await generateText(
    systemPrompt,
    inlineSystem
      ? `${ANALYSIS_EDIT_PLANNER_PROMPT}\n\n---\n\n${repairMessage}`
      : repairMessage,
    model,
    provider,
    abortSignal,
  )
  const parsedRepair = parseAnalysisAIPlannerResult(repairedOutput)
  if (parsedRepair) {
    return parsedRepair
  }

  throw new Error('The assistant could not produce a valid analysis edit plan.')
}

export async function handleAnalysisRequest(args: {
  messageText: string
  messages: ChatMessageType[]
  model: string
  provider: AIProviderType | undefined
  updateLastMessage: (content: string) => void
  abortController: AbortController
}): Promise<string> {
  const {
    messageText,
    messages,
    model,
    provider,
    updateLastMessage,
    abortController,
  } = args

  const analysisState = useAnalysisStore.getState()
  const analysisSnapshot = structuredClone(analysisState.analysis)
  const revisionAtStart = analysisState.analysisRevision
  const workflowSnapshotAtStart = getWorkflowSnapshot()
  const workflowRevisionAtStart = workflowSnapshotAtStart.workflowRevision
  const validationAtStart = analysisState.validation
  const summary = createAnalysisSummary(
    analysisSnapshot,
    validationAtStart,
  )
  const insights = createAnalysisInsights(
    analysisSnapshot,
    validationAtStart,
  )
  const context = buildAnalysisAIContext(
    analysisSnapshot,
    validationAtStart,
    summary,
    insights,
    revisionAtStart,
    workflowSnapshotAtStart.currentStage,
  )
  const intent = classifyAnalysisIntent(messageText)

  if (intent === 'edit') {
    const reviewMessage = '<step title="Reviewing request" status="streaming">Checking whether the requested analysis change is safe and supported.</step>'
    updateLastMessage(reviewMessage)

    const plannerResult = await requestAnalysisPlannerResult(
      messageText,
      context.prompt,
      model,
      provider,
      abortController.signal,
    )

    if (plannerResult.kind === 'cannot_edit') {
      return buildAnalysisNoopMessage(plannerResult.reason)
    }

    if (plannerResult.operations.length === 0) {
      return buildAnalysisNoopMessage(
        'The assistant did not return any supported analysis changes.',
      )
    }

    if (
      useAnalysisStore.getState().analysisRevision !== revisionAtStart ||
      getWorkflowSnapshot().workflowRevision !== workflowRevisionAtStart
    ) {
      return buildAnalysisNoopMessage(
        'The analysis changed while AI was working; no changes were applied.',
        'Stale analysis snapshot',
      )
    }

    const appliedBatch = applyAnalysisWorkflowOperations(
      analysisSnapshot,
      plannerResult.operations,
      workflowSnapshotAtStart.currentStage,
    )
    const workflowStageChanged = appliedBatch.workflowStageChanged
    const workflowStage = appliedBatch.workflowStage
    const nextAnalysis = appliedBatch.analysis
    const analysisChanged = !areAnalysesEqual(analysisSnapshot, nextAnalysis)
    const nextValidation = validateAnalysis(nextAnalysis)
    const introducedValidationIssues = getIntroducedValidationIssues(
      validationAtStart,
      nextValidation,
    )
    const nextSummaryDraft = createAnalysisSummary(
      nextAnalysis,
      nextValidation,
    )
    const nextInsightsDraft = createAnalysisInsights(
      nextAnalysis,
      nextValidation,
    )
    const nextWorkflow = createAnalysisWorkflow(
      nextAnalysis,
      nextValidation,
      nextSummaryDraft,
      nextInsightsDraft,
      workflowSnapshotAtStart.currentStage,
    )

    if (introducedValidationIssues.length > 0) {
      return buildAnalysisNoopMessage(
        `The request would introduce new validation issues: ${introducedValidationIssues.join(' ')}`,
        'Invalid analysis changes',
      )
    }

    if (workflowStageChanged && workflowStage) {
      const requestedStage = getAnalysisWorkflowStageSummary(
        nextWorkflow,
        workflowStage,
      )

      if (!requestedStage || !canTransitionToWorkflowStage(nextWorkflow, workflowStage)) {
        return buildAnalysisNoopMessage(
          requestedStage?.blocker ??
            `Workflow stage ${formatWorkflowStage(workflowStage)} is blocked right now.`,
          'Blocked workflow stage',
        )
      }
    }

    if (!analysisChanged && !workflowStageChanged) {
      return buildAnalysisNoopMessage(
        'The request did not change the analysis or workflow stage.',
      )
    }

    if (
      useAnalysisStore.getState().analysisRevision !== revisionAtStart ||
      getWorkflowSnapshot().workflowRevision !== workflowRevisionAtStart
    ) {
      return buildAnalysisNoopMessage(
        'The analysis changed while AI was working; no changes were applied.',
        'Stale analysis snapshot',
      )
    }

    const planningMessage = [
      '<step title="Reviewing request" status="done">[done] The request maps to supported non-destructive analysis edits.</step>',
      `<step title="Planned changes" status="streaming">${plannerResult.operations.map((operation) => `[pending] ${formatAnalysisOperation(operation)}`).join('\n')}</step>`,
    ].join('\n\n')
    updateLastMessage(planningMessage)

    if (
      useAnalysisStore.getState().analysisRevision !== revisionAtStart ||
      getWorkflowSnapshot().workflowRevision !== workflowRevisionAtStart
    ) {
      return buildAnalysisNoopMessage(
        'The analysis changed while AI was working; no changes were applied.',
        'Stale analysis snapshot',
      )
    }

    if (workflowStageChanged && workflowStage) {
      useAnalysisStore.getState().commitAnalysisWorkflow({
        ...(analysisChanged ? { analysis: nextAnalysis } : {}),
        workflow: { currentStage: workflowStage },
      })
    } else if (analysisChanged) {
      useAnalysisStore.getState().replaceAnalysis(nextAnalysis)
    } else {
      return buildAnalysisNoopMessage(
        'The request did not change the analysis or workflow stage.',
      )
    }
    const nextState = useAnalysisStore.getState()
    const nextSummary = createAnalysisSummary(
      nextState.analysis,
      nextState.validation,
    )

    return buildAnalysisSuccessMessage(
      !analysisChanged && workflowStageChanged
        ? plannerResult.operations.filter(
            (operation) => operation.type === 'set-workflow-stage',
          )
        : plannerResult.operations,
      nextSummary,
      workflowStageChanged ? workflowStage : null,
    )
  }

  const chatHistory = messages.map((message) => ({
    role: message.role,
    content: message.content,
    ...(message.attachments?.length ? { attachments: message.attachments } : {}),
  }))
  chatHistory.push({
    role: 'user',
    content: messageText,
  })

  const trimmedHistory = trimChatHistory(chatHistory)
  let accumulated = ''
  let chatThinking = ''
  for await (const chunk of streamChat(
    buildAnalysisAnswerSystemPrompt(context.prompt),
    trimmedHistory,
    model,
    CHAT_STREAM_THINKING_CONFIG,
    provider,
    abortController.signal,
  )) {
    if (chunk.type === 'thinking') {
      chatThinking += chunk.content
      const thinkingStep = `<step title="Thinking">${chatThinking}</step>`
      updateLastMessage(thinkingStep + (accumulated ? `\n${accumulated}` : ''))
    } else if (chunk.type === 'text') {
      accumulated += chunk.content
      const thinkingPrefix = chatThinking
        ? `<step title="Thinking">${chatThinking}</step>\n`
        : ''
      updateLastMessage(thinkingPrefix + accumulated)
    } else if (chunk.type === 'error') {
      accumulated += `\n\n**Error:** ${chunk.content}`
      updateLastMessage(accumulated)
    }
  }

  return accumulated
}

export function useChatHandlers() {
  const [input, setInput] = useState('')
  const messages = useAIStore((s) => s.messages)
  const isStreaming = useAIStore((s) => s.isStreaming)
  const model = useAIStore((s) => s.model)
  const availableModels = useAIStore((s) => s.availableModels)
  const isLoadingModels = useAIStore((s) => s.isLoadingModels)
  const addMessage = useAIStore((s) => s.addMessage)
  const updateLastMessage = useAIStore((s) => s.updateLastMessage)
  const setStreaming = useAIStore((s) => s.setStreaming)

  const handleSend = useCallback(
    async (text?: string) => {
      const messageText = text ?? input.trim()
      if (!messageText || isStreaming || isLoadingModels || availableModels.length === 0) {
        return
      }

      setInput('')

      const userMsg: ChatMessageType = {
        id: nanoid(),
        role: 'user',
        content: messageText,
        timestamp: Date.now(),
      }
      addMessage(userMsg)

      const assistantMsg: ChatMessageType = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }
      addMessage(assistantMsg)
      setStreaming(true)

      if (messages.length === 0) {
        const cleanText = messageText.replace(/^(Rename|Add|Set|Update|Change|Explain|Summarize)\s+/i, '')
        const words = cleanText.split(' ').slice(0, 4).join(' ')
        const title = words.length > 30 ? `${words.slice(0, 30)}...` : words
        useAIStore.getState().setChatTitle(title || 'Analysis Chat')
      }

      const currentProvider = useAIStore.getState().modelGroups.find((g) =>
        g.models.some((m) => m.value === model),
      )?.provider as AIProviderType | undefined

      let accumulated = ''
      const abortController = new AbortController()
      useAIStore.getState().setAbortController(abortController)

      try {
        accumulated = await handleAnalysisRequest({
          messageText,
          messages,
          model,
          provider: currentProvider,
          updateLastMessage,
          abortController,
        })
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error'
          accumulated = buildAnalysisNoopMessage(errMsg)
          updateLastMessage(accumulated)
        }
      } finally {
        useAIStore.getState().setAbortController(null)
        setStreaming(false)
      }

      useAIStore.setState((state) => {
        const nextMessages = [...state.messages]
        const lastMessage = nextMessages.find((message) => message.id === assistantMsg.id)
        if (lastMessage) {
          lastMessage.content = accumulated
          lastMessage.isStreaming = false
        }
        return { messages: nextMessages }
      })
    },
    [availableModels.length, input, isLoadingModels, isStreaming, messages, model, addMessage, updateLastMessage, setStreaming],
  )

  return { input, setInput, handleSend, isStreaming }
}
