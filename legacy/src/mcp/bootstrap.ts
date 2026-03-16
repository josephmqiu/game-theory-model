import { createAppStore } from '../store'
import type { McpServerConfig } from '../types/mcp'
import { createToolContext } from './context'
import { registerPrompts } from './prompts'
import { registerResources } from './resources'
import { createMcpServer, type McpServer } from './server'
import { registerModelTools } from './tools/model'
import { registerPhaseTools } from './tools/phases'
import { registerPlayTools } from './tools/play'

export function registerDefaultMcpSurface(
  server: McpServer,
  context: ReturnType<typeof createToolContext>,
): void {
  registerPhaseTools(server, context)
  registerModelTools(server, context)
  registerPlayTools(server)
  registerResources(server, context)
  registerPrompts(server)
}

export function createConfiguredMcpServer(config: McpServerConfig) {
  const appStore = createAppStore()
  const context = createToolContext(appStore)
  const server = createMcpServer(config)

  registerDefaultMcpSurface(server, context)

  return {
    appStore,
    context,
    server,
  }
}
