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
import { executeAppCommand } from "@/services/app-command-runner";
import type { AppCommandEnvelope } from "shared/game-theory/types/command-bus";
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
    analysisMeta: {
      persistedRevision: analysis.eventLog.cursor,
      fileMeta: {
        filePath: analysis.fileMeta.filePath,
        name: analysis.fileMeta.name,
        description: analysis.fileMeta.description ?? null,
        metadata: analysis.fileMeta.metadata,
      },
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
  const executingCommandsRef = useRef(new Set<string>());

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
              pipelineStore.setState((current) => ({
                ...current,
                analysis_state:
                  state.pipelineState?.analysis_state as ReturnType<
                    typeof pipelineStore.getState
                  >["analysis_state"],
                phase_results:
                  state.pipelineState?.phase_results as ReturnType<
                    typeof pipelineStore.getState
                  >["phase_results"],
              }));
            }

            if (state.runtimeState) {
              pipelineStore.setState((current) => ({
                ...current,
                prompt_registry:
                  state.runtimeState?.prompt_registry as ReturnType<
                    typeof pipelineStore.getState
                  >["prompt_registry"],
                active_rerun_cycle:
                  state.runtimeState?.active_rerun_cycle as ReturnType<
                    typeof pipelineStore.getState
                  >["active_rerun_cycle"],
                pending_revalidation_approvals:
                  state.runtimeState?.pending_revalidation_approvals as ReturnType<
                    typeof pipelineStore.getState
                  >["pending_revalidation_approvals"],
              }));
            }

            if (state.conversationState) {
              conversationStore.setState((current) => ({
                ...current,
                messages:
                  state.conversationState?.messages as ReturnType<
                    typeof conversationStore.getState
                  >["messages"],
                proposal_review:
                  state.conversationState?.proposal_review as ReturnType<
                    typeof conversationStore.getState
                  >["proposal_review"],
                proposals_by_id:
                  state.conversationState?.proposals_by_id as ReturnType<
                    typeof conversationStore.getState
                  >["proposals_by_id"],
              }));
            }
          } else if (data.type === "command:queued") {
            const command = data.command as AppCommandEnvelope | undefined;
            if (
              !command ||
              command.sourceClientId === clientIdRef.current ||
              executingCommandsRef.current.has(command.id) ||
              !clientIdRef.current
            ) {
              return;
            }

            void (async () => {
              try {
                const claimResponse = await fetch(
                  `${getBaseUrl()}/api/mcp/command-claim`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      id: command.id,
                      ownerClientId: clientIdRef.current,
                    }),
                  },
                );
                const claimResult = (await claimResponse.json()) as {
                  status: "claimed" | "busy" | "missing" | "error";
                };

                if (!claimResponse.ok || claimResult.status !== "claimed") {
                  return;
                }

                executingCommandsRef.current.add(command.id);
                const result = await executeAppCommand(command);
                await fetch(`${getBaseUrl()}/api/mcp/command-result`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: command.id,
                    status: "completed",
                    result,
                    sourceClientId: clientIdRef.current,
                  }),
                });
              } catch (error) {
                await fetch(`${getBaseUrl()}/api/mcp/command-result`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: command.id,
                    status: "failed",
                    error:
                      error instanceof Error
                        ? error.message
                        : "Unknown command execution error",
                    sourceClientId: clientIdRef.current,
                  }),
                });
              } finally {
                executingCommandsRef.current.delete(command.id);
                pushStateToServer(clientIdRef.current);
              }
            })();
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
