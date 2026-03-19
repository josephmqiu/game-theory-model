import { defineEventHandler, getRequestHeader, readBody, setResponseHeaders } from 'h3'
import { resolveClaudeCli } from '../../utils/resolve-claude-cli'
import { runCodexExec } from '../../utils/codex-client'
import {
  buildClaudeAgentEnv,
  getClaudeAgentDebugFilePath,
} from '../../utils/resolve-claude-agent-env'
import { formatOpenCodeError } from './chat'
import { serverError, serverLog, serverWarn } from '../../utils/ai-logger'

interface GenerateBody {
  system: string
  message: string
  model?: string
  provider?: 'anthropic' | 'openai' | 'opencode'
  thinkingMode?: 'adaptive' | 'disabled' | 'enabled'
  thinkingBudgetTokens?: number
  effort?: 'low' | 'medium' | 'high' | 'max'
}

/**
 * Non-streaming AI generation endpoint.
 * Routes to the appropriate provider SDK based on the `provider` field.
 * Requires explicit provider and model; no fallback routing.
 */
export default defineEventHandler(async (event) => {
  const runId = getRequestHeader(event, 'x-run-id')?.trim() || undefined
  const startedAt = Date.now()
  let body: GenerateBody | null = null
  let bodyError: string | undefined

  try {
    body = (await readBody<GenerateBody>(event)) ?? null
  } catch (error) {
    bodyError = error instanceof Error ? error.message : 'Failed to read request body.'
  }

  serverLog(runId, 'generate', 'request-received', {
    provider: body?.provider,
    model: body?.model,
    systemLen: body?.system?.length ?? 0,
    messageLen: body?.message?.length ?? 0,
  })

  let result: { text?: string; error?: string }

  if (bodyError) {
    result = { error: bodyError }
  } else if (!body?.message || !body?.system) {
    setResponseHeaders(event, { 'Content-Type': 'application/json' })
    result = { error: 'Missing required fields: system, message' }
  } else if (!body.provider) {
    setResponseHeaders(event, { 'Content-Type': 'application/json' })
    result = { error: 'Missing provider. Provider fallback is disabled.' }
  } else if (!body.model?.trim()) {
    setResponseHeaders(event, { 'Content-Type': 'application/json' })
    result = { error: 'Missing model. Model fallback is disabled.' }
  } else if (body.provider === 'anthropic') {
    result = await generateViaAgentSDK(body, body.model, runId)
  } else if (body.provider === 'opencode') {
    result = await generateViaOpenCode(body, body.model, runId)
  } else if (body.provider === 'openai') {
    result = await generateViaCodex(body, body.model, runId)
  } else {
    result = { error: 'Missing or unsupported provider. Provider fallback is disabled.' }
  }

  serverLog(runId, 'generate', 'response-sent', {
    elapsedMs: Date.now() - startedAt,
    provider: body?.provider,
    hasText: Boolean(result.text),
    error: result.error,
  })

  return result
})

/** Generate via Claude Agent SDK (uses local Claude Code OAuth login, no API key needed) */
async function generateViaAgentSDK(
  body: GenerateBody,
  model: string | undefined,
  runId: string | undefined,
): Promise<{ text?: string; error?: string }> {
  const startedAt = Date.now()
  serverLog(runId, 'generate', 'agent-sdk-start', {
    model,
    systemLen: body.system.length,
    messageLen: body.message.length,
  })

  const runQuery = async (): Promise<{ text?: string; error?: string }> => {
    const { query } = await import('@anthropic-ai/claude-agent-sdk')

    // Remove CLAUDECODE env to allow running from within a CC terminal
    const env = buildClaudeAgentEnv()
    const debugFile = getClaudeAgentDebugFilePath()

    const claudePath = resolveClaudeCli()

    const q = query({
      prompt: body.message,
      options: {
        systemPrompt: body.system,
        ...(model ? { model } : {}),
        maxTurns: 1,
        tools: [],
        plugins: [],
        permissionMode: 'plan',
        persistSession: false,
        env,
        ...(debugFile ? { debugFile } : {}),
        ...(claudePath ? { pathToClaudeCodeExecutable: claudePath } : {}),
      },
    })

    try {
      for await (const message of q) {
        serverLog(runId, 'generate', 'agent-sdk-event', {
          type: message.type,
          subtype: 'subtype' in message ? String(message.subtype) : undefined,
        })

        if (message.type === 'result') {
          const isErrorResult = 'is_error' in message && Boolean((message as { is_error?: boolean }).is_error)
          if (message.subtype === 'success' && !isErrorResult) {
            serverLog(runId, 'generate', 'agent-sdk-result', {
              subtype: message.subtype,
              hasText: Boolean(message.result),
            })
            return { text: message.result }
          }
          const errors = 'errors' in message ? (message.errors as string[]) : []
          const resultText = 'result' in message ? String(message.result ?? '') : ''
          const error = errors.join('; ') || resultText || `Query ended with: ${message.subtype}`
          serverWarn(runId, 'generate', 'agent-sdk-result', {
            subtype: message.subtype,
            error,
          })
          return { error }
        }
      }
    } finally {
      q.close()
    }

    return { error: 'No result received from Claude Agent SDK' }
  }

  try {
    const result = await runQuery()
    serverLog(runId, 'generate', 'agent-sdk-complete', {
      elapsedMs: Date.now() - startedAt,
      hasText: Boolean(result.text),
      error: result.error,
    })
    return result
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    serverError(runId, 'generate', 'agent-sdk-error', {
      elapsedMs: Date.now() - startedAt,
      error: message,
    })
    return { error: message }
  }
}

async function generateViaCodex(
  body: GenerateBody,
  model: string | undefined,
  runId: string | undefined,
): Promise<{ text?: string; error?: string }> {
  const startedAt = Date.now()
  serverLog(runId, 'generate', 'codex-request-start', {
    model,
    systemLen: body.system.length,
    messageLen: body.message.length,
  })

  const result = await runCodexExec(body.message, {
    model,
    systemPrompt: body.system,
    thinkingMode: body.thinkingMode,
    thinkingBudgetTokens: body.thinkingBudgetTokens,
    effort: body.effort,
    runId,
  })

  serverLog(runId, 'generate', 'codex-request-complete', {
    elapsedMs: Date.now() - startedAt,
    hasText: Boolean(result.text),
    error: result.error,
  })

  return result.error ? { error: result.error } : { text: result.text ?? '' }
}

function mapOpenCodeEffort(
  effort?: 'low' | 'medium' | 'high' | 'max',
): 'low' | 'medium' | 'high' | undefined {
  if (!effort) return undefined
  if (effort === 'max') return 'high'
  return effort
}

function buildOpenCodeReasoning(
  body: GenerateBody,
): Record<string, unknown> | undefined {
  const reasoning: Record<string, unknown> = {}
  const effort = mapOpenCodeEffort(body.effort)
  if (effort) {
    reasoning.effort = effort
  }
  if (body.thinkingMode === 'enabled') {
    reasoning.enabled = true
  } else if (body.thinkingMode === 'disabled') {
    reasoning.enabled = false
  }
  if (typeof body.thinkingBudgetTokens === 'number' && body.thinkingBudgetTokens > 0) {
    reasoning.budgetTokens = body.thinkingBudgetTokens
  }
  return Object.keys(reasoning).length > 0 ? reasoning : undefined
}

/** Timeout for OpenCode prompt calls (3 minutes) */
const OPENCODE_PROMPT_TIMEOUT_MS = 180_000

async function promptWithTimeout(
  ocClient: any,
  payload: Record<string, unknown>,
  timeoutMs = OPENCODE_PROMPT_TIMEOUT_MS,
): Promise<{ data: any; error: any }> {
  const result = await Promise.race([
    ocClient.session.prompt(payload),
    new Promise<{ data: null; error: string }>((resolve) =>
      setTimeout(
        () => resolve({ data: null, error: `OpenCode prompt timed out after ${timeoutMs / 1000}s` }),
        timeoutMs,
      ),
    ),
  ])
  return result
}

async function promptOpenCodeWithThinking(
  ocClient: any,
  basePayload: Record<string, unknown>,
  body: GenerateBody,
  runId: string | undefined,
): Promise<{ data: any; error: any }> {
  const reasoning = buildOpenCodeReasoning(body)
  if (!reasoning) {
    return await promptWithTimeout(ocClient, basePayload)
  }

  const enhanced = { ...basePayload, reasoning }
  const firstTry = await promptWithTimeout(ocClient, enhanced)
  if (!firstTry.error) {
    return firstTry
  }

  serverWarn(runId, 'generate', 'opencode-reasoning-rejected', {
    promptKeys: Object.keys(basePayload),
  })
  return await promptWithTimeout(ocClient, basePayload)
}

/** Generate via OpenCode SDK (connects to a running OpenCode server) */
async function generateViaOpenCode(
  body: GenerateBody,
  model: string | undefined,
  runId: string | undefined,
): Promise<{ text?: string; error?: string }> {
  let ocServer: { close(): void } | undefined
  const startedAt = Date.now()
  serverLog(runId, 'generate', 'opencode-start', {
    model,
    systemLen: body.system.length,
    messageLen: body.message.length,
  })
  try {
    const { getOpencodeClient } = await import('../../utils/opencode-client')
    const oc = await getOpencodeClient()
    const ocClient = oc.client
    ocServer = oc.server

    const { data: session, error: sessionError } = await ocClient.session.create({
      title: 'Game Theory Analyzer Generate',
    })
    if (sessionError || !session) {
      const detail = formatOpenCodeError(sessionError)
      return { error: `Failed to create OpenCode session: ${detail}` }
    }

    // Inject system prompt as context (no AI reply)
    await ocClient.session.prompt({
      sessionID: session.id,
      noReply: true,
      parts: [{ type: 'text', text: body.system }],
    })

    // Parse model string ("providerID/modelID")
    let modelOption: { providerID: string; modelID: string } | undefined
    if (model && model.includes('/')) {
      const idx = model.indexOf('/')
      modelOption = { providerID: model.slice(0, idx), modelID: model.slice(idx + 1) }
    } else if (model) {
      serverWarn(runId, 'generate', 'opencode-model-parse-failed', {
        model,
      })
    }

    // Send main prompt and await full response
    const promptPayload: Record<string, unknown> = {
      sessionID: session.id,
      ...(modelOption ? { model: modelOption } : {}),
      parts: [{ type: 'text', text: body.message }],
    }

    serverLog(runId, 'generate', 'opencode-model', {
      model,
      parsed: modelOption,
    })

    const { data: result, error: promptError } = await promptOpenCodeWithThinking(
      ocClient,
      promptPayload,
      body,
      runId,
    )

    if (promptError) {
      const errorDetail = formatOpenCodeError(promptError)
      serverWarn(runId, 'generate', 'opencode-error', { error: errorDetail })
      return { error: errorDetail }
    }

    // Extract text from response parts
    const texts: string[] = []
    if (result?.parts) {
      for (const part of result.parts) {
        if (part.type === 'text' && part.text) {
          texts.push(part.text)
        }
      }
    }

    if (texts.length === 0) {
      serverWarn(runId, 'generate', 'opencode-empty-response', {
        responsePreview: JSON.stringify(result).slice(0, 500),
      })
      return { error: 'OpenCode returned an empty response. The model may not have generated any output.' }
    }

    serverLog(runId, 'generate', 'opencode-complete', {
      elapsedMs: Date.now() - startedAt,
      hasText: true,
    })
    return { text: texts.join('') }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    serverError(runId, 'generate', 'opencode-error', {
      elapsedMs: Date.now() - startedAt,
      error: message,
    })
    return { error: message }
  } finally {
    const { releaseOpencodeServer } = await import('../../utils/opencode-client')
    releaseOpencodeServer(ocServer)
  }
}
