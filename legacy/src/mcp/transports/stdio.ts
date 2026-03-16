import type { Readable, Writable } from 'node:stream'

export function createStdioTransport(options?: {
  stdin?: Readable
  stdout?: Writable
}) {
  return {
    kind: 'stdio' as const,
    stdin: options?.stdin,
    stdout: options?.stdout,
  }
}
