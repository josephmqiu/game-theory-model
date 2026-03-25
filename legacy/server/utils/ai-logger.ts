import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { getServerLogDir } from '../../src/lib/runtime-state-paths'

type ServerLogLevel = 'log' | 'warn' | 'error'
const LOG_ENDPOINT = '/api/ai/log'

export interface ServerLogEntry {
  ts: string
  side: 'server'
  level: ServerLogLevel
  sub: string
  event: string
  run: string
  [key: string]: unknown
}

export interface LogEntry {
  ts: string
  side: 'client'
  level: 'log' | 'warn' | 'error' | 'capture'
  sub: string
  event: string
  run: string
  [key: string]: unknown
}

export interface RunLogger {
  log: (sub: string, event: string, data?: Record<string, unknown>) => void
  warn: (sub: string, event: string, data?: Record<string, unknown>) => void
  error: (sub: string, event: string, data?: Record<string, unknown>) => void
  capture: (sub: string, event: string, data?: Record<string, unknown>) => void
  flush: (options?: { transport?: 'fetch' | 'beacon' }) => Promise<boolean>
  entries: () => LogEntry[]
}

export interface RunContext {
  runId: string
  logger: RunLogger
}

const LOG_DIR = getServerLogDir({ env: process.env })
const IS_TEST_MODE =
  process.env.NODE_ENV === 'test' ||
  process.env.VITEST === 'true' ||
  process.env.VITEST === '1'

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

function createClientEntry(
  runId: string,
  level: LogEntry['level'],
  sub: string,
  event: string,
  data?: Record<string, unknown>,
): LogEntry {
  return {
    ts: new Date().toISOString(),
    side: 'client',
    level,
    sub,
    event,
    run: runId,
    ...(data ?? {}),
  }
}

function formatClientConsole(entry: LogEntry): string {
  const details = Object.entries(entry)
    .filter(([key]) =>
      key !== 'ts'
      && key !== 'side'
      && key !== 'level'
      && key !== 'sub'
      && key !== 'event'
      && key !== 'run',
    )
    .map(([key, value]) =>
      `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`,
    )
    .join(' ')
  return details.length > 0
    ? `[AI:${entry.sub}] ${entry.event} run=${entry.run} ${details}`
    : `[AI:${entry.sub}] ${entry.event} run=${entry.run}`
}

function appendClientEntry(buffer: LogEntry[], entry: LogEntry): void {
  buffer.push(entry)

  if (IS_TEST_MODE || entry.level === 'capture') {
    return
  }

  const line = formatClientConsole(entry)
  if (entry.level === 'warn') {
    console.warn(line)
    return
  }
  if (entry.level === 'error') {
    console.error(line)
    return
  }
  console.log(line)
}

async function postEntries(payload: string): Promise<boolean> {
  const response = await fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  })
  return response.ok
}

function beaconEntries(payload: string): boolean {
  if (
    typeof navigator === 'undefined'
    || typeof navigator.sendBeacon !== 'function'
  ) {
    return false
  }

  try {
    const blob = new Blob([payload], { type: 'application/json' })
    return navigator.sendBeacon(LOG_ENDPOINT, blob)
  } catch {
    return false
  }
}

export function createRunLogger(runId: string): RunLogger {
  const buffer: LogEntry[] = []
  let flushPromise: Promise<boolean> | null = null

  const write = (
    level: LogEntry['level'],
    sub: string,
    event: string,
    data?: Record<string, unknown>,
  ) => {
    try {
      appendClientEntry(buffer, createClientEntry(runId, level, sub, event, data))
    } catch {
      // Diagnostics must never break the main analysis flow.
    }
  }

  const flush = async (
    options: { transport?: 'fetch' | 'beacon' } = {},
  ): Promise<boolean> => {
    if (IS_TEST_MODE || buffer.length === 0) {
      return true
    }

    if (options.transport !== 'beacon' && flushPromise) {
      return flushPromise
    }

    const snapshot = buffer.slice()
    const payload = JSON.stringify({ runId, entries: snapshot })

    const attempt = async (): Promise<boolean> => {
      try {
        const ok = options.transport === 'beacon'
          ? beaconEntries(payload)
          : await postEntries(payload)
        if (ok) {
          buffer.splice(0, snapshot.length)
        }
        return ok
      } catch {
        return false
      }
    }

    if (options.transport === 'beacon') {
      return await attempt()
    }

    flushPromise = attempt()
    try {
      return await flushPromise
    } finally {
      flushPromise = null
    }
  }

  return {
    log: (sub, event, data) => write('log', sub, event, data),
    warn: (sub, event, data) => write('warn', sub, event, data),
    error: (sub, event, data) => write('error', sub, event, data),
    capture: (sub, event, data) => write('capture', sub, event, data),
    flush,
    entries: () => [...buffer],
  }
}

export function timer(): { elapsed(): number } {
  const started = Date.now()
  return {
    elapsed: () => Date.now() - started,
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
