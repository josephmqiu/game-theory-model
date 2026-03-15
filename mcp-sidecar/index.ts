import { createMcpServer, createStdioTransport, startServer } from '../src/mcp'

async function main() {
  const server = createMcpServer({
    name: 'game-theory-analysis',
    version: '0.1.0',
    stdio_enabled: true,
    http_enabled: false,
    http_host: 'localhost',
    http_port: 3117,
  })

  await startServer(server, createStdioTransport())
}

void main()
