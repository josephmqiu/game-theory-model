/**
 * MCP store — server config + connection status.
 */

import { createStore, useStore } from "zustand";
import type {
  McpServerConfig,
  McpConnectionStatus,
} from "shared/game-theory/types/mcp";

export interface McpState {
  config: McpServerConfig;
  connections: McpConnectionStatus[];
}

interface McpActions {
  updateConfig: (config: Partial<McpServerConfig>) => void;
  setConnectionStatus: (status: McpConnectionStatus) => void;
  resetMcp: () => void;
}

type McpStore = McpState & McpActions;

const initialState: McpState = {
  config: {
    name: "game-theory-analysis",
    version: "0.1.0",
    stdio_enabled: true,
    http_enabled: false,
    http_port: 3100,
    http_host: "127.0.0.1",
  },
  connections: [],
};

export const mcpStore = createStore<McpStore>((set, get) => ({
  ...initialState,

  updateConfig(config) {
    set({ config: { ...get().config, ...config } });
  },

  setConnectionStatus(status) {
    const connections = get().connections.filter(
      (c) => c.transport !== status.transport,
    );
    set({ connections: [...connections, status] });
  },

  resetMcp() {
    set(initialState);
  },
}));

export function useMcpStore<T>(selector: (state: McpStore) => T): T {
  return useStore(mcpStore, selector);
}
