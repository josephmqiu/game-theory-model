import { useState, useCallback } from 'react'
import { nanoid } from 'nanoid'
import { useAIStore } from '@/stores/ai-store'
import { useAnalysisStore } from '@/stores/analysis-store'
import { useCanvasStore } from '@/stores/canvas-store'
import { useDocumentStore } from '@/stores/document-store'
import { streamChat } from '@/services/ai/ai-service'
import { CHAT_SYSTEM_PROMPT } from '@/services/ai/ai-prompts'
import { ANALYSIS_CHAT_SYSTEM_PROMPT, ANALYSIS_EDIT_PLANNER_PROMPT } from '@/services/ai/analysis-ai-prompts'
import {
  applyAnalysisOperations,
  buildAnalysisAIContext,
  classifyAnalysisIntent,
  parseAnalysisAIPlannerResult,
} from '@/services/ai/analysis-ai-helpers'
import type { AnalysisAIPlannerResult, AnalysisAIOperation } from '@/services/ai/analysis-ai-types'
import {
  generateDesign,
  generateDesignModification,
  animateNodesToCanvas,
  extractAndApplyDesignModification,
} from '@/services/ai/design-generator'
import { createAnalysisInsights } from '@/services/analysis/analysis-insights'
import {
  createAnalysisSummary,
  type AnalysisSummary,
} from '@/services/analysis/analysis-summary'
import { trimChatHistory } from '@/services/ai/context-optimizer'
import type { ChatMessage as ChatMessageType } from '@/services/ai/ai-types'
import { CHAT_STREAM_THINKING_CONFIG } from '@/services/ai/ai-runtime-config'
import {
  needsSimplifiedPrompt,
  resolveModelProfile,
} from '@/services/ai/model-profiles'
import type { AIProviderType } from '@/types/agent-settings'

type ChatMode = 'design' | 'analysis'

/** Intent classification prompt — lightweight LLM call to determine message routing */
const CLASSIFY_PROMPT = `You are a UI design tool assistant. Classify the user's message intent.
Reply with EXACTLY one of these tags, nothing else:
- DESIGN — user wants to create, generate, or modify any UI element, component, screen, or page
- CHAT — user is asking a question, seeking help, or having a conversation`

/** Classify user intent via a lightweight LLM call instead of hardcoded keyword matching */
async function classifyIntent(
  text: string,
  model: string,
  provider?: string,
): Promise<{ isDesign: boolean }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8_000)

    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: CLASSIFY_PROMPT,
        message: text,
        model,
        provider,
      }),
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!response.ok) throw new Error('classify failed')
    const data = await response.json()
    const upper = (data.text ?? '').trim().toUpperCase()

    return { isDesign: upper.includes('DESIGN') }
  } catch {
    // Fallback: in a design tool, default to design mode
    return { isDesign: true }
  }
}

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
  }
}

export function buildAnalysisSuccessMessage(
  operations: AnalysisAIOperation[],
  summary: AnalysisSummary,
): string {
  const appliedLines = operations.map((operation) => `[done] ${formatAnalysisOperation(operation)}`)

  return [
    `<step title="Applied changes" status="done">${appliedLines.join('\n')}</step>`,
    `<step title="Current analysis" status="done">[done] ${summary.statusLabel}\n[done] ${summary.progressLabel}</step>`,
    `Applied ${operations.length} analysis change${operations.length === 1 ? '' : 's'}. ${summary.statusLabel}. ${summary.progressLabel}.`,
  ].join('\n\n')
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

export function buildContextString(): string {
  const selectedIds = useCanvasStore.getState().selection.selectedIds
  const { getFlatNodes, document: doc } = useDocumentStore.getState()
  const flatNodes = getFlatNodes()

  const parts: string[] = []

  if (flatNodes.length > 0) {
    const summary = flatNodes
      .slice(0, 20)
      .map((n) => `${n.type}:${n.name ?? n.id}`)
      .join(', ')
    parts.push(`Document has ${flatNodes.length} nodes: ${summary}`)
  }

  if (selectedIds.length > 0) {
    const selectedNodes = selectedIds
      .map((id) => useDocumentStore.getState().getNodeById(id))
      .filter(Boolean)
    const selectedSummary = selectedNodes
      .map((n) => {
        const dims = 'width' in n! && 'height' in n!
          ? ` (${n!.width}x${n!.height})`
          : ''
        return `${n!.type}:${n!.name ?? n!.id}${dims}`
      })
      .join(', ')
    parts.push(`Selected: ${selectedSummary}`)
  }

  if (doc.variables && Object.keys(doc.variables).length > 0) {
    const varNames = Object.entries(doc.variables)
      .map(([n, d]) => `$${n}(${d.type})`)
      .join(', ')
    parts.push(`Variables: ${varNames}`)
  }

  return parts.length > 0 ? `\n\n[Canvas context: ${parts.join('. ')}]` : ''
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

    if (useAnalysisStore.getState().analysisRevision !== revisionAtStart) {
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

    const nextAnalysis = applyAnalysisOperations(
      analysisSnapshot,
      plannerResult.operations,
    )

    if (useAnalysisStore.getState().analysisRevision !== revisionAtStart) {
      return buildAnalysisNoopMessage(
        'The analysis changed while AI was working; no changes were applied.',
        'Stale analysis snapshot',
      )
    }

    useAnalysisStore.getState().replaceAnalysis(nextAnalysis)
    const nextState = useAnalysisStore.getState()
    const nextSummary = createAnalysisSummary(
      nextState.analysis,
      nextState.validation,
    )

    return buildAnalysisSuccessMessage(plannerResult.operations, nextSummary)
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

/** Shared chat logic hook */
export function useChatHandlers({
  mode = 'design',
}: {
  mode?: ChatMode
} = {}) {
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
      const pendingAttachments = useAIStore.getState().pendingAttachments
      const allowAttachments = mode === 'design'
      const hasAttachments = allowAttachments && pendingAttachments.length > 0
      if ((!messageText && !hasAttachments) || isStreaming || isLoadingModels || availableModels.length === 0) return

      setInput('')
      useAIStore.getState().clearPendingAttachments()

      const userMsg: ChatMessageType = {
        id: nanoid(),
        role: 'user',
        content: messageText || '',
        timestamp: Date.now(),
        ...(hasAttachments ? { attachments: pendingAttachments } : {}),
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
        const cleanText = messageText.replace(/^(Design|Create|Generate|Make|Rename|Add|Set|Update|Change)\s+/i, '')
        const words = cleanText.split(' ').slice(0, 4).join(' ')
        const title = words.length > 30 ? words.slice(0, 30) + '...' : words
        useAIStore.getState().setChatTitle(title || 'New Chat')
      }

      const currentProvider = useAIStore.getState().modelGroups.find((g) =>
        g.models.some((m) => m.value === model),
      )?.provider as AIProviderType | undefined

      let accumulated = ''
      let appliedCount = 0
      let isDesign = false

      const abortController = new AbortController()
      useAIStore.getState().setAbortController(abortController)

      try {
        if (mode === 'analysis') {
          accumulated = await handleAnalysisRequest({
            messageText,
            messages,
            model,
            provider: currentProvider,
            updateLastMessage,
            abortController,
          })
        } else {
          const context = buildContextString()
          const fullUserMessage = messageText + context
          const classified = await classifyIntent(
            messageText,
            model,
            currentProvider,
          )
          isDesign = classified.isDesign
          const selectedIds = useCanvasStore.getState().selection.selectedIds
          const hasSelection = selectedIds.length > 0
          const isModification = isDesign && hasSelection

          if (isDesign) {
            if (isModification) {
              const { getNodeById, document: modDoc } = useDocumentStore.getState()
              const selectedNodes = selectedIds.map(id => getNodeById(id)).filter(Boolean) as any[]

              accumulated = '<step title="Checking guidelines">Analyzing modification request...</step>'
              updateLastMessage(accumulated)

              const { rawResponse, nodes } = await generateDesignModification(selectedNodes, messageText, {
                variables: modDoc.variables,
                themes: modDoc.themes,
                model,
                provider: currentProvider,
              }, abortController.signal)
              accumulated = rawResponse
              updateLastMessage(accumulated)

              const count = extractAndApplyDesignModification(JSON.stringify(nodes))
              appliedCount += count
            } else {
              const doc = useDocumentStore.getState().document
              const concurrency = useAIStore.getState().concurrency
              const { rawResponse, nodes } = await generateDesign({
                prompt: fullUserMessage,
                model,
                provider: currentProvider,
                concurrency,
                context: {
                  canvasSize: { width: 1200, height: 800 },
                  documentSummary: `Current selection: ${hasSelection ? selectedIds.length + ' items' : 'Empty'}`,
                  variables: doc.variables,
                  themes: doc.themes,
                },
              }, {
                animated: true,
                onApplyPartial: (partialCount: number) => {
                  appliedCount += partialCount
                },
                onTextUpdate: (updatedText: string) => {
                  accumulated = updatedText
                  updateLastMessage(updatedText)
                },
              }, abortController.signal)
              accumulated = rawResponse
              if (appliedCount === 0 && nodes.length > 0) {
                animateNodesToCanvas(nodes)
                appliedCount += nodes.length
              }
            }
          } else {
            const chatHistory = messages.map((message) => ({
              role: message.role,
              content: message.content,
              ...(message.attachments?.length ? { attachments: message.attachments } : {}),
            }))
            chatHistory.push({
              role: 'user',
              content: fullUserMessage,
              ...(hasAttachments ? { attachments: pendingAttachments } : {}),
            })
            const trimmedHistory = trimChatHistory(chatHistory)
            let chatThinking = ''
            for await (const chunk of streamChat(
              CHAT_SYSTEM_PROMPT,
              trimmedHistory,
              model,
              CHAT_STREAM_THINKING_CONFIG,
              currentProvider,
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
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted) {
          const errMsg = error instanceof Error ? error.message : 'Unknown error'
          accumulated = mode === 'analysis'
            ? buildAnalysisNoopMessage(errMsg)
            : `${accumulated}\n\n**Error:** ${errMsg}`.trim()
          updateLastMessage(accumulated)
        }
      } finally {
        useAIStore.getState().setAbortController(null)
        setStreaming(false)
      }

      if (isDesign && appliedCount > 0) {
        accumulated += `\n\n<!-- APPLIED -->`
      }

      useAIStore.setState((state) => {
        const nextMessages = [...state.messages]
        const lastMessage = nextMessages.find(message => message.id === assistantMsg.id)
        if (lastMessage) {
          lastMessage.content = accumulated
          lastMessage.isStreaming = false
        }
        return { messages: nextMessages }
      })
    },
    [availableModels.length, input, isLoadingModels, isStreaming, messages, mode, model, addMessage, updateLastMessage, setStreaming],
  )

  return { input, setInput, handleSend, isStreaming }
}
