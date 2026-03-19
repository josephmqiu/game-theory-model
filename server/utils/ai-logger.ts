import { appendFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

type ServerLogLevel = 'log' | 'warn' | 'error'

export interface ServerLogEntry {
  ts: string
  side: 'server'
  level: ServerLogLevel
  sub: string
  event: string
  run: string
  [key: string]: unknown
}

const LOG_DIR = join(homedir(), '.game-theory-analyzer', 'logs')
const IS_TEST_MODE = process.env.NODE_ENV === 'test'

export function serverLog(
  runId: string | undefined,
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  writeServerLog('log', runId, sub, event, data)
}

export function serverWarn(
  runId: string | undefined,
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  writeServerLog('warn', runId, sub, event, data)
}

export function serverError(
  runId: string | undefined,
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  writeServerLog('error', runId, sub, event, data)
}

export function appendRunLogEntries(
  runId: string | undefined,
  entries: Array<Record<string, unknown>>,
): boolean {
  if (!runId || entries.length === 0) return true

  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const lines: string[] = []
    for (const entry of entries) {
      try {
        lines.push(JSON.stringify(entry))
      } catch {
        lines.push(
          JSON.stringify({
            ts: new Date().toISOString(),
            side: 'server',
            level: 'error',
            sub: 'ai-logger',
            event: 'serialize-error',
            run: runId,
          }),
        )
      }
    }
    appendFileSync(
      getLogPath(runId),
      lines.join('\n') + '\n',
      'utf-8',
    )
    return true
  } catch {
    return false
  }
}

function writeServerLog(
  level: ServerLogLevel,
  runId: string | undefined,
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): void {
  if (IS_TEST_MODE || !runId) return

  try {
    const entry = createEntry(level, runId, sub, event, data)
    writeConsole(entry)
    appendRunLogEntries(runId, [entry])
  } catch {
    // Logging must never affect the request path.
  }
}

function createEntry(
  level: ServerLogLevel,
  runId: string,
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): ServerLogEntry {
  return {
    ts: new Date().toISOString(),
    side: 'server',
    level,
    sub,
    event,
    run: runId,
    ...sanitizeData(data),
  }
}

function sanitizeData(data?: Record<string, unknown>): Record<string, unknown> {
  if (!data) return {}

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      sanitized[key] = value
    }
  }
  return sanitized
}

function getLogPath(runId: string): string {
  return join(LOG_DIR, `${runId}.jsonl`)
}

function writeConsole(entry: ServerLogEntry): void {
  const method = entry.level === 'warn'
    ? console.warn
    : entry.level === 'error'
      ? console.error
      : console.log

  const extras = Object.entries(entry)
    .filter(([key]) => !['ts', 'side', 'level', 'sub', 'event'].includes(key))
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(' ')

  const suffix = extras.length > 0 ? ` ${extras}` : ''
  method(`[AI:${entry.sub}] ${entry.event}${suffix}`)
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return /\s/.test(value) ? JSON.stringify(value) : value
  }
  if (
    typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  ) {
    return String(value)
  }
  try {
    return JSON.stringify(value) ?? String(value)
  } catch {
    return String(value)
  }
}
