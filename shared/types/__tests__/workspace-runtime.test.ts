import { describe, expect, it } from "vitest";
import type {
  WorkspaceRuntimeBootstrapEnvelope,
  WorkspaceRuntimeClientHello,
  WorkspaceRuntimePushEnvelope,
  WorkspaceRuntimeRequest,
  WorkspaceRuntimeResponse,
  WorkspaceTransportDiagnostic,
} from "../workspace-runtime";

describe("workspace-runtime transport types", () => {
  it("accepts a client hello with channel revisions", () => {
    const hello: WorkspaceRuntimeClientHello = {
      type: "client_hello",
      connectionId: "conn-prev",
      workspaceId: "workspace-1",
      activeThreadId: "thread-1",
      lastSeenByChannel: {
        threads: 2,
        "thread-detail": 4,
        "run-detail": 3,
      },
    };

    expect(hello.type).toBe("client_hello");
    expect(hello.lastSeenByChannel?.["thread-detail"]).toBe(4);
  });

  it("accepts a bootstrap envelope for the migrated slice", () => {
    const bootstrap: WorkspaceRuntimeBootstrapEnvelope = {
      type: "bootstrap",
      payload: {
        workspaceId: "workspace-1",
        threads: [],
        activeThreadId: "thread-1",
        activeThreadDetail: null,
        latestRun: null,
        latestPhaseTurns: [],
        channelRevisions: {
          threads: 1,
          "thread-detail": 2,
        },
        serverConnectionId: "conn-1",
      },
    };

    expect(bootstrap.payload.serverConnectionId).toBe("conn-1");
  });

  it("accepts typed requests and responses", () => {
    const request: WorkspaceRuntimeRequest<"workspace.thread.create"> = {
      type: "request",
      requestId: "req-1",
      kind: "workspace.thread.create",
      payload: {
        workspaceId: "workspace-1",
        title: "New Thread",
      },
    };
    const response: WorkspaceRuntimeResponse<{ threadId: string }> = {
      type: "response",
      requestId: request.requestId,
      ok: true,
      result: {
        threadId: "thread-2",
      },
    };

    expect(response.requestId).toBe(request.requestId);
    expect(response.result?.threadId).toBe("thread-2");
  });

  it("accepts typed pushes by channel", () => {
    const push: WorkspaceRuntimePushEnvelope<"run-detail"> = {
      type: "push",
      channel: "run-detail",
      revision: 5,
      scope: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
      },
      payload: {
        workspaceId: "workspace-1",
        threadId: "thread-1",
        latestRun: null,
        latestPhaseTurns: [],
      },
      replayed: true,
    };

    expect(push.channel).toBe("run-detail");
    expect(push.replayed).toBe(true);
  });

  it("accepts structured transport diagnostics", () => {
    const diagnostic: WorkspaceTransportDiagnostic = {
      id: "diag-1",
      source: "client",
      code: "reconnect-scheduled",
      level: "warn",
      timestamp: 123,
      message: "Scheduling reconnect after close",
      connectionId: "conn-1",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      data: {
        backoffMs: 2000,
      },
    };

    expect(diagnostic.data?.backoffMs).toBe(2000);
  });
});
