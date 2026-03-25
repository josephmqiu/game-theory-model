// transport/index.ts
// Barrel export for the WebSocket transport layer.
// Initialize once at app startup via `initTransportLayer()`.

import { initWsTransport, destroyWsTransport } from "./ws-client";
import { bindEntityGraphAdapter } from "./entity-graph-ws-adapter";
import { bindRunStatusAdapter } from "./run-status-ws-adapter";
import { bindProgressAdapter } from "./analysis-rpc";

export {
  getWsTransport,
  initWsTransport,
  destroyWsTransport,
  type WsConnectionState,
  type WsRpcResponse,
  ANALYSIS_CHANNELS,
} from "./ws-client";
export { bindEntityGraphAdapter } from "./entity-graph-ws-adapter";
export { bindRunStatusAdapter } from "./run-status-ws-adapter";
export {
  startAnalysis,
  abortAnalysis,
  updateEntity,
  hydrateAnalysisState,
  isAnalysisRunning,
  onAnalysisProgress,
  handleChatEntitySnapshot,
  type AnalysisProgressStreamEvent,
} from "./analysis-rpc";

/**
 * Initialize the full transport layer: WebSocket connection + store adapters.
 * Call once at app startup. Returns a teardown function.
 *
 * @param wsUrl - WebSocket server URL (e.g. "ws://localhost:3001")
 */
export function initTransportLayer(wsUrl: string): () => void {
  initWsTransport(wsUrl);

  const unbindEntityGraph = bindEntityGraphAdapter();
  const unbindRunStatus = bindRunStatusAdapter();
  const unbindProgress = bindProgressAdapter();

  return () => {
    unbindEntityGraph();
    unbindRunStatus();
    unbindProgress();
    destroyWsTransport();
  };
}
