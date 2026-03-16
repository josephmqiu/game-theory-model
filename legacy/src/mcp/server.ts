import { z, type ZodTypeAny } from 'zod'
import type { Readable, Writable } from 'node:stream'

import type { McpServerConfig } from '../types/mcp'
import type {
  McpServerLike,
  RegisteredPrompt,
  RegisteredResource,
  RegisteredTool,
} from './context'

interface McpRuntime {
  close: () => Promise<void>
}

interface StdioTransportDescriptor {
  kind: 'stdio'
  stdin?: Readable
  stdout?: Writable
}

interface HttpTransportDescriptor {
  kind: 'http'
  host: string
  port: number
}

type McpTransportDescriptor = StdioTransportDescriptor | HttpTransportDescriptor

export interface McpServer extends McpServerLike {
  config: McpServerConfig
  tools: Map<string, RegisteredTool>
  resources: Map<string, RegisteredResource>
  prompts: Map<string, RegisteredPrompt>
  runtime: McpRuntime | null
  callTool: <T = unknown>(name: string, input: unknown) => Promise<T>
  readResource: (uri: string) => unknown
  renderPrompt: (name: string, args: Record<string, string>) => string
}

function ensureSchema(schema: ZodTypeAny, input: unknown): unknown {
  return schema.parse(input)
}

function formatStructuredResult(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function toolResultToSdkPayload(result: unknown) {
  const isError = typeof result === 'object' && result !== null && 'success' in result && result.success === false
  return {
    content: [
      {
        type: 'text' as const,
        text: formatStructuredResult(result),
      },
    ],
    structuredContent: typeof result === 'object' && result !== null ? result as Record<string, unknown> : undefined,
    isError,
  }
}

export function createMcpServer(config: McpServerConfig): McpServer {
  const tools = new Map<string, RegisteredTool>()
  const resources = new Map<string, RegisteredResource>()
  const prompts = new Map<string, RegisteredPrompt>()
  let runtime: McpRuntime | null = null

  return {
    config,
    tools,
    resources,
    prompts,
    get runtime() {
      return runtime
    },
    set runtime(nextRuntime: McpRuntime | null) {
      runtime = nextRuntime
    },
    registerTool(tool) {
      tools.set(tool.name, tool as unknown as RegisteredTool)
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

export async function startServer(server: McpServer, transport: McpTransportDescriptor): Promise<void> {
  if (server.runtime) {
    return
  }

  if (transport.kind !== 'stdio') {
    throw new Error('HTTP MCP transport is deferred in this milestone. Use stdio transport instead.')
  }

  const [{ McpServer: SdkMcpServer }, { StdioServerTransport }] = await Promise.all([
    import('@modelcontextprotocol/sdk/server/mcp.js'),
    import('@modelcontextprotocol/sdk/server/stdio.js'),
  ])

  const sdkServer = new SdkMcpServer({
    name: server.config.name,
    version: server.config.version,
  })

  for (const tool of server.tools.values()) {
    sdkServer.registerTool(tool.name, {
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, async (args) => {
      const result = await tool.execute(args)
      return toolResultToSdkPayload(result)
    })
  }

  for (const resource of server.resources.values()) {
    sdkServer.registerResource(resource.name, resource.uri, {
      title: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }, async () => ({
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: formatStructuredResult(resource.read()),
        },
      ],
    }))
  }

  for (const prompt of server.prompts.values()) {
    const argsSchema = Object.fromEntries(
      prompt.arguments.map((argument) => [
        argument.name,
        argument.required ? z.string().describe(argument.description) : z.string().optional().describe(argument.description),
      ]),
    )

    sdkServer.registerPrompt(prompt.name, {
      title: prompt.name,
      description: prompt.description,
      argsSchema,
    }, async (args) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: prompt.render((args ?? {}) as Record<string, string>),
          },
        },
      ],
    }))
  }

  const sdkTransport = new StdioServerTransport(transport.stdin, transport.stdout)
  await sdkServer.connect(sdkTransport)

  server.runtime = {
    close: () => sdkServer.close(),
  }
}

export async function stopServer(server: McpServer): Promise<void> {
  await server.runtime?.close()
  server.runtime = null
}
