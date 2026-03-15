import type { ZodTypeAny } from 'zod'

import type { McpServerConfig } from '../types/mcp'
import type {
  McpServerLike,
  RegisteredPrompt,
  RegisteredResource,
  RegisteredTool,
} from './context'

export interface McpServer extends McpServerLike {
  config: McpServerConfig
  tools: Map<string, RegisteredTool>
  resources: Map<string, RegisteredResource>
  prompts: Map<string, RegisteredPrompt>
  callTool: <T = unknown>(name: string, input: unknown) => Promise<T>
  readResource: (uri: string) => unknown
  renderPrompt: (name: string, args: Record<string, string>) => string
}

function ensureSchema(schema: ZodTypeAny, input: unknown): unknown {
  return schema.parse(input)
}

export function createMcpServer(config: McpServerConfig): McpServer {
  const tools = new Map<string, RegisteredTool>()
  const resources = new Map<string, RegisteredResource>()
  const prompts = new Map<string, RegisteredPrompt>()

  return {
    config,
    tools,
    resources,
    prompts,
    registerTool(tool) {
      tools.set(tool.name, tool)
    },
    registerResource(resource) {
      resources.set(resource.uri, resource)
    },
    registerPrompt(prompt) {
      prompts.set(prompt.name, prompt)
    },
    async callTool<T = unknown>(name: string, input: unknown): Promise<T> {
      const tool = tools.get(name)
      if (!tool) {
        throw new Error(`Unknown MCP tool: ${name}`)
      }

      const parsed = ensureSchema(tool.inputSchema, input)
      return Promise.resolve(tool.execute(parsed) as T)
    },
    readResource(uri) {
      const resource = resources.get(uri)
      if (!resource) {
        throw new Error(`Unknown MCP resource: ${uri}`)
      }
      return resource.read()
    },
    renderPrompt(name, args) {
      const prompt = prompts.get(name)
      if (!prompt) {
        throw new Error(`Unknown MCP prompt: ${name}`)
      }
      return prompt.render(args)
    },
  }
}

export async function startServer(server: McpServer, transport: { kind: string }): Promise<void> {
  void server
  void transport
}

export async function stopServer(server: McpServer): Promise<void> {
  void server
}
