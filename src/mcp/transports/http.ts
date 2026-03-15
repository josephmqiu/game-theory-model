import type { McpServerConfig } from '../../types/mcp'

export function createHttpTransport(config: McpServerConfig) {
  return {
    kind: 'http' as const,
    host: config.http_host ?? 'localhost',
    port: config.http_port ?? 3117,
  }
}
