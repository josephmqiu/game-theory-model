import { defineEventHandler, readRawBody, setResponseStatus } from 'h3'
import { appendRunLogEntries } from '../../utils/ai-logger'

interface LogFlushBody {
  runId?: string
  entries?: Array<Record<string, unknown>>
}

export default defineEventHandler(async (event) => {
  const body = await readRawBody(event, 'utf8').catch(() => null)
  const parsed = normalizeBody(body)

  if (!parsed || !parsed.runId || !Array.isArray(parsed.entries)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid log payload.' }
  }

  const ok = appendRunLogEntries(parsed.runId, parsed.entries)
  if (!ok) {
    setResponseStatus(event, 500)
    return { error: 'Failed to append run log.' }
  }

  return { ok: true }
})

function normalizeBody(
  body: LogFlushBody | string | Uint8Array<ArrayBufferLike> | null | undefined,
): LogFlushBody | null {
  if (!body) return null

  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as LogFlushBody
    } catch {
      return null
    }
  }

  if (body instanceof Uint8Array) {
    try {
      return JSON.parse(new TextDecoder('utf8').decode(body)) as LogFlushBody
    } catch {
      return null
    }
  }

  return body
}
