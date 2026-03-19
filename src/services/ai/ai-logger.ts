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

const LOG_ENDPOINT = '/api/ai/log'
const IS_TEST_MODE = import.meta.env.MODE === 'test'

function createEntry(
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

function formatConsole(entry: LogEntry): string {
  const details = Object.entries(entry)
    .filter(([key]) =>
      key !== 'ts'
      && key !== 'side'
      && key !== 'level'
      && key !== 'sub'
      && key !== 'event'
      && key !== 'run',
    )
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ')
  return details.length > 0
    ? `[AI:${entry.sub}] ${entry.event} run=${entry.run} ${details}`
    : `[AI:${entry.sub}] ${entry.event} run=${entry.run}`
}

function appendEntry(buffer: LogEntry[], entry: LogEntry): void {
  buffer.push(entry)

  if (IS_TEST_MODE || entry.level === 'capture') {
    return
  }

  const line = formatConsole(entry)
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
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
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
      appendEntry(buffer, createEntry(runId, level, sub, event, data))
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
