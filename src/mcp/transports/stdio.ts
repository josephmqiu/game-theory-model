export function createStdioTransport() {
  return {
    kind: 'stdio' as const,
  }
}
