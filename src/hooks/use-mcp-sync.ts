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

function hasOwnKey<T extends object>(
  value: T,
  key: PropertyKey,
): key is keyof T {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pushStateToServer(clientId: string | null): void {
  if (!clientId) return;
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
function shallowEqualRecord(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every((key) => Object.is(left[key], right[key]));
}

function isSameSnapshot(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function useMcpSync(enabled = true): void {
  const clientIdRef = useRef<string | null>(null);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipPushUntilRef = useRef(0);
  const executingCommandsRef = useRef(new Set<string>());
  const lastAppliedVersionRef = useRef(0);
  const bootstrapCompleteRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      bootstrapCompleteRef.current = false;
      return;
    }

    bootstrapCompleteRef.current = true;
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
            if (
              typeof data.version === "number" &&
              data.version <= lastAppliedVersionRef.current
            ) {
              return;
            }
            if (typeof data.version === "number") {
              lastAppliedVersionRef.current = data.version;
            }

            // MCP-originated update — apply to renderer stores
            // Suppress push-back briefly to avoid echo
            skipPushUntilRef.current = Date.now() + 200;

            const state = data.state as Partial<SyncState>;

            // Non-L1 state can be applied as snapshots
            // L1 canonical changes from MCP should come as proposed commands
            // (not handled here — MCP writes go through proposal flow)
            if (state.pipelineState) {
              pipelineStore.setState((current) => {
                const nextAnalysisState = hasOwnKey(
                  state.pipelineState,
                  "analysis_state",
                )
                  ? state.pipelineState.analysis_state
                  : current.analysis_state;
                const nextPhaseResults = hasOwnKey(
                  state.pipelineState,
                  "phase_results",
                )
                  ? state.pipelineState.phase_results
                  : current.phase_results;

                if (
                  isSameSnapshot(current.analysis_state, nextAnalysisState) &&
                  isSameSnapshot(current.phase_results, nextPhaseResults)
                ) {
                  return current;
                }

                return {
                  ...current,
                  analysis_state:
                    nextAnalysisState as ReturnType<
                      typeof pipelineStore.getState
                    >["analysis_state"],
                  phase_results:
                    nextPhaseResults as ReturnType<
                      typeof pipelineStore.getState
                    >["phase_results"],
                };
              });
            }

            if (state.runtimeState) {
              pipelineStore.setState((current) => {
                const nextPromptRegistry = hasOwnKey(
                  state.runtimeState,
                  "prompt_registry",
                )
                  ? state.runtimeState.prompt_registry
                  : current.prompt_registry;
                const nextActiveRerunCycle = hasOwnKey(
                  state.runtimeState,
                  "active_rerun_cycle",
                )
                  ? state.runtimeState.active_rerun_cycle
                  : current.active_rerun_cycle;
                const nextPendingRevalidations = hasOwnKey(
                  state.runtimeState,
                  "pending_revalidation_approvals",
                )
                  ? state.runtimeState.pending_revalidation_approvals
                  : current.pending_revalidation_approvals;

                if (
                  isSameSnapshot(current.prompt_registry, nextPromptRegistry) &&
                  isSameSnapshot(
                    current.active_rerun_cycle,
                    nextActiveRerunCycle,
                  ) &&
                  isSameSnapshot(
                    current.pending_revalidation_approvals,
                    nextPendingRevalidations,
                  )
                ) {
                  return current;
                }

                return {
                  ...current,
                  prompt_registry:
                    nextPromptRegistry as ReturnType<
                      typeof pipelineStore.getState
                    >["prompt_registry"],
                  active_rerun_cycle:
                    nextActiveRerunCycle as ReturnType<
                      typeof pipelineStore.getState
                    >["active_rerun_cycle"],
                  pending_revalidation_approvals:
                    nextPendingRevalidations as ReturnType<
                      typeof pipelineStore.getState
                    >["pending_revalidation_approvals"],
                };
              });
            }

            if (state.conversationState) {
              conversationStore.setState((current) => {
                const nextMessages = hasOwnKey(
                  state.conversationState,
                  "messages",
                )
                  ? state.conversationState.messages
                  : current.messages;
                const nextProposalReview = hasOwnKey(
                  state.conversationState,
                  "proposal_review",
                )
                  ? state.conversationState.proposal_review
                  : current.proposal_review;
                const nextProposalsById = hasOwnKey(
                  state.conversationState,
                  "proposals_by_id",
                )
                  ? state.conversationState.proposals_by_id
                  : current.proposals_by_id;

                if (
                  isSameSnapshot(current.messages, nextMessages) &&
                  isSameSnapshot(
                    current.proposal_review,
                    nextProposalReview,
                  ) &&
                  shallowEqualRecord(
                    current.proposals_by_id as Record<string, unknown>,
                    nextProposalsById as Record<string, unknown>,
                  )
                ) {
                  return current;
                }

                return {
                  ...current,
                  messages:
                    nextMessages as ReturnType<
                      typeof conversationStore.getState
                    >["messages"],
                  proposal_review:
                    nextProposalReview as ReturnType<
                      typeof conversationStore.getState
                    >["proposal_review"],
                  proposals_by_id:
                    nextProposalsById as ReturnType<
                      typeof conversationStore.getState
                    >["proposals_by_id"],
                };
              });
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
      if (
        !bootstrapCompleteRef.current ||
        !clientIdRef.current ||
        Date.now() < skipPushUntilRef.current
      ) {
        return;
      }
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushStateToServer(clientIdRef.current);
      }, PUSH_DEBOUNCE_MS);
    });

    const unsubPipeline = pipelineStore.subscribe(() => {
      if (
        !bootstrapCompleteRef.current ||
        !clientIdRef.current ||
        Date.now() < skipPushUntilRef.current
      ) {
        return;
      }
      if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
      pushTimerRef.current = setTimeout(() => {
        pushStateToServer(clientIdRef.current);
      }, PUSH_DEBOUNCE_MS);
    });

    const unsubConversation = conversationStore.subscribe(() => {
      if (
        !bootstrapCompleteRef.current ||
        !clientIdRef.current ||
        Date.now() < skipPushUntilRef.current
      ) {
        return;
      }
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
      bootstrapCompleteRef.current = false;
    };
  }, [enabled]);
}
