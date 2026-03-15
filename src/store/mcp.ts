import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'

import type { McpConnectionStatus, McpServerConfig } from '../types/mcp'
import { createBrowserPersistenceAdapter } from './persistence'

interface McpSnapshot {
  config: McpServerConfig
  connections: McpConnectionStatus[]
}

interface McpStoreState extends McpSnapshot {}

const persistence = createBrowserPersistenceAdapter<McpSnapshot>('m5:mcp')

function createDefaultConfig(): McpServerConfig {
  return {
    name: 'game-theory-analysis',
    version: '0.1.0',
    stdio_enabled: true,
    http_enabled: false,
    http_port: 3117,
    http_host: 'localhost',
  }
}

function createInitialState(): McpStoreState {
  return {
    config: createDefaultConfig(),
    connections: [
      {
        transport: 'stdio',
        connected: false,
        connected_at: null,
        last_activity: null,
      },
    ],
  }
}

const initialState = persistence.load('global') ?? createInitialState()
const mcpStore = createStore<McpStoreState>(() => initialState)

function persist(state: McpStoreState): void {
  persistence.save('global', state)
}

export function useMcpStore<T>(selector: (state: McpStoreState) => T): T {
  return useStore(mcpStore, selector)
}

export function getMcpStoreState(): McpStoreState {
  return mcpStore.getState()
}

export function resetMcpStore(): void {
  const nextState = createInitialState()
  mcpStore.setState(nextState)
  persist(nextState)
}

export function updateMcpConfig(config: Partial<McpServerConfig>): void {
  mcpStore.setState((state) => {
    const nextState = {
      ...state,
      config: {
        ...state.config,
        ...config,
      },
    }
    persist(nextState)
    return nextState
  })
}

export function setMcpConnectionStatus(status: McpConnectionStatus): void {
  mcpStore.setState((state) => {
    const existing = state.connections.filter((entry) => entry.transport !== status.transport)
    const nextState = {
      ...state,
      connections: [...existing, status],
    }
    persist(nextState)
    return nextState
  })
}

export function useMcpConnectionStatus(): McpConnectionStatus {
  return useMcpStore((state) => {
    return state.connections.find((entry) => entry.connected)
      ?? state.connections[0]
      ?? {
        transport: 'stdio',
        connected: false,
        connected_at: null,
        last_activity: null,
      }
  })
}
