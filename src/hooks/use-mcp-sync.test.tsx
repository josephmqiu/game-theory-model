/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, waitFor } from "@testing-library/react";
import type { Mock } from "vitest";
import { useMcpSync } from "@/hooks/use-mcp-sync";
import { executeAppCommand } from "@/services/app-command-runner";
import { analysisStore } from "@/stores/analysis-store";
import { pipelineStore } from "@/stores/pipeline-store";
import { conversationStore } from "@/stores/conversation-store";
import { renderWithShell } from "@/test-support/render-router";

const TEST_CLIENT_ID = "test-client-id";

interface FakeEventSourceMessage {
  data: string;
}

interface FakeEventSourceInit {
  onmessage: ((event: FakeEventSourceMessage) => void) | null;
  onerror: ((error: Event) => void) | null;
  close: Mock<() => void>;
  dispatchMessage: (payload: unknown) => void;
  dispatchError: () => void;
}

vi.mock("@/services/app-command-runner", () => ({
  executeAppCommand: vi.fn(),
}));

describe("useMcpSync", () => {
  const eventSources: FakeEventSourceInit[] = [];
  const renderedShells: Array<ReturnType<typeof renderWithShell>> = [];

  const createJsonResponse = (payload: unknown): Response =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  beforeEach(() => {
    eventSources.length = 0;
    analysisStore.getState().newAnalysis();
    pipelineStore.getState().resetPipeline();
    conversationStore.getState().resetConversation();

    const FakeEventSource = vi.fn((_url: string) => {
      const instance: FakeEventSourceInit = {
        onmessage: null,
        onerror: null,
        close: vi.fn(),
        dispatchMessage: (payload) => {
          if (instance.onmessage) {
            instance.onmessage({ data: JSON.stringify(payload) });
          }
        },
        dispatchError: () => {
          if (instance.onerror) {
            instance.onerror(new Event("error"));
          }
        },
      };

      eventSources.push(instance);
      return instance;
    }) as unknown as typeof EventSource;

    vi.stubGlobal("EventSource", FakeEventSource);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: RequestInfo | URL, _init?: RequestInit) => {
        const target = request.toString();
        if (target.includes("/api/mcp/command-claim")) {
          return createJsonResponse({ status: "claimed" });
        }

        return createJsonResponse({});
      }) as typeof fetch,
    );

    vi.mocked(executeAppCommand).mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    while (renderedShells.length > 0) {
      renderedShells.pop()?.unmount();
    }
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("claims MCP queued commands, executes them, and posts command results", async () => {
    function Harness() {
      useMcpSync();
      return null;
    }

    renderedShells.push(renderWithShell(<Harness />));

    await waitFor(() => {
      expect(eventSources).toHaveLength(1);
    });
    const source = eventSources[0]!;

    act(() => {
      source.dispatchMessage({
        type: "client:id",
        clientId: TEST_CLIENT_ID,
      });
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/mcp/state"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    act(() => {
      source.dispatchMessage({
        type: "command:queued",
        command: {
          id: "command-1",
          type: "send_chat",
          payload: {
            system: "",
            provider: "anthropic",
            model: "claude-sonnet-4-6",
            messages: [{ role: "user", content: "Can you test?" }],
          },
        },
      });
    });

    await waitFor(() => {
      expect(vi.mocked(executeAppCommand)).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(executeAppCommand)).toHaveBeenCalledWith({
      id: "command-1",
      type: "send_chat",
      payload: {
        system: "",
        provider: "anthropic",
        model: "claude-sonnet-4-6",
        messages: [{ role: "user", content: "Can you test?" }],
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/mcp/command-result"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("does not execute queued commands missing claim", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (request: RequestInfo | URL) => {
        const target = request.toString();
        if (target.includes("/api/mcp/command-claim")) {
          return createJsonResponse({ status: "busy" });
        }

        return createJsonResponse({});
      }) as typeof fetch,
    );

    function Harness() {
      useMcpSync();
      return null;
    }

    renderedShells.push(renderWithShell(<Harness />));

    await waitFor(() => {
      expect(eventSources).toHaveLength(1);
    });
    const source = eventSources[0]!;

    act(() => {
      source.dispatchMessage({
        type: "client:id",
        clientId: TEST_CLIENT_ID,
      });
    });

    act(() => {
      source.dispatchMessage({
        type: "command:queued",
        command: {
          id: "command-2",
          type: "send_chat",
          payload: {
            system: "",
            provider: "anthropic",
            model: "claude-sonnet-4-6",
            messages: [{ role: "user", content: "Should not run" }],
          },
          sourceClientId: "other-client",
        },
      });
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });

    expect(vi.mocked(executeAppCommand)).not.toHaveBeenCalled();
  });

  it("hydrates pipeline/runtime/conversation snapshots from state:update events", async () => {
    function Harness() {
      useMcpSync();
      return null;
    }

    renderedShells.push(renderWithShell(<Harness />));

    await waitFor(() => {
      expect(eventSources).toHaveLength(1);
    });
    const source = eventSources[0]!;

    act(() => {
      source.dispatchMessage({
        type: "state:update",
        state: {
          pipelineState: {
            analysis_state: {
              id: "analysis-1",
              event_description: "Test event",
              domain: "geopolitics",
              current_phase: 2,
              phase_states: {},
              pass_number: 1,
              status: "running",
              started_at: "2026-03-16T10:00:00.000Z",
              completed_at: null,
              classification: null,
            },
            phase_results: {
              2: { status: "ok" },
            },
          },
          runtimeState: {
            prompt_registry: {
              versions: {},
              active_versions: {},
              official_versions: {},
            },
            active_rerun_cycle: null,
            pending_revalidation_approvals: {
              "event-1": {
                event_id: "event-1",
              },
            },
          },
          conversationState: {
            messages: [
              {
                id: "msg-1",
                role: "ai",
                content: "Hydrated",
                timestamp: "2026-03-16T10:00:00.000Z",
              },
            ],
            proposal_review: {
              proposals: [],
              active_proposal_index: 0,
              merge_log: [],
            },
            proposals_by_id: {},
          },
        },
      });
    });

    await waitFor(() => {
      expect(pipelineStore.getState().analysis_state?.id).toBe("analysis-1");
      expect(pipelineStore.getState().phase_results[2]).toEqual({ status: "ok" });
      expect(
        pipelineStore.getState().pending_revalidation_approvals["event-1"],
      ).toBeDefined();
      expect(conversationStore.getState().messages).toHaveLength(1);
      expect(conversationStore.getState().messages[0]?.content).toBe("Hydrated");
    });
  });
});
