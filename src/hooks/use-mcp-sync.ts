/**
 * MCP live-sync hook — pushes renderer state to Nitro cache,
 * receives MCP-originated updates via SSE.
 *
 * Adapted from OpenPencil's use-mcp-sync.ts passive sync pattern.
 * Renderer is authoritative. Nitro is a passive cache for MCP reads.
 */

import { useEffect, useRef } from "react";
import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import type { SyncState } from "../../server/utils/mcp-sync-state";

const PUSH_DEBOUNCE_MS = 2000;
const RECONNECT_DELAY_MS = 3000;

function getBaseUrl(): string {
  return window.location.origin;
}

function buildSyncState(): Partial<SyncState> {
  const analysis = analysisStore.getState();
  const pipeline = pipelineStore.getState();
  const conversation = conversationStore.getState();

  return {
    canonical: analysis.canonical,
    pipelineState: {
      analysis_state: pipeline.analysis_state,
      phase_results: pipeline.phase_results,
    },
    runtimeState: {
      prompt_registry: pipeline.prompt_registry,
      active_rerun_cycle: pipeline.active_rerun_cycle,
      pending_revalidation_approvals: pipeline.pending_revalidation_approvals,
    },
    conversationState: {
      messages: conversation.messages,
      proposal_review: conversation.proposal_review,
      proposals_by_id: conversation.proposals_by_id,
    },
  };
}

function pushStateToServer(clientId: string | null): void {
  const state = buildSyncState();
  fetch(`${getBaseUrl()}/api/mcp/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, sourceClientId: clientId }),
  }).catch(() => {});
}

/**
 * Subscribes the renderer to MCP sync events via SSE.
 * - Pushes local state changes to Nitro so MCP can read them.
 * - Receives MCP-originated state updates and applies to renderer stores.
 */
export function useMcpSync(): void {
  const clientIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPushUntilRef = useRef(0);

  useEffect(() => {
    const baseUrl = getBaseUrl();
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect(): void {
      if (disposed) return;
      eventSource = new EventSource(`${baseUrl}/api/mcp/events`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "client:id") {
            clientIdRef.current = data.clientId;
            // Push current state so MCP can read immediately
            pushStateToServer(data.clientId);
          } else if (data.type === "state:update") {
            // MCP-originated update — apply to renderer stores
            // Suppress push-back briefly to avoid echo
            skipPushUntilRef.current = Date.now() + 200;

            const state = data.state as SyncState;

            // Non-L1 state can be applied as snapshots
            // L1 canonical changes from MCP should come as proposed commands
            // (not handled here — MCP writes go through proposal flow)
            if (state.pipelineState) {
              pipelineStore
                .getState()
                .updateAnalysisState(
                  () =>
                    state.pipelineState?.analysis_state as ReturnType<
                      typeof pipelineStore.getState
                    >["analysis_state"],
                );
            }
          }
        } catch {
          // Ignore malformed events
        }
      };

      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        if (!disposed) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    // Push local state changes to Nitro (debounced)
    const unsubAnalysis = analysisStore.subscribe(() => {
      if (Date.now() < skipPushUntilRef.current) return;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushStateToServer(clientIdRef.current);
      }, PUSH_DEBOUNCE_MS);
    });

    const unsubPipeline = pipelineStore.subscribe(() => {
      if (Date.now() < skipPushUntilRef.current) return;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushStateToServer(clientIdRef.current);
      }, PUSH_DEBOUNCE_MS);
    });

    const unsubConversation = conversationStore.subscribe(() => {
      if (Date.now() < skipPushUntilRef.current) return;
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushStateToServer(clientIdRef.current);
      }, PUSH_DEBOUNCE_MS);
    });

    return () => {
      disposed = true;
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      unsubAnalysis();
      unsubPipeline();
      unsubConversation();
    };
  }, []);
}
