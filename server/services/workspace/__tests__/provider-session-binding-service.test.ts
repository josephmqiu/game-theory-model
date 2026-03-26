import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceDatabase } from "../workspace-db";
import { createWorkspaceRecordFromSnapshot } from "../workspace-repository";
import type { ThreadState } from "../../../../shared/types/workspace-state";

let testDatabase: WorkspaceDatabase;

vi.mock("../workspace-db", async () => {
  const actual = await vi.importActual<typeof import("../workspace-db")>(
    "../workspace-db",
  );
  return {
    ...actual,
    getWorkspaceDatabase: () => testDatabase,
  };
});

import {
  clearProviderSessionBinding,
  getProviderSessionBinding,
  upsertProviderSessionBinding,
} from "../provider-session-binding-service";
import { createWorkspaceDatabase } from "../workspace-db";

function seedWorkspace(database: WorkspaceDatabase): void {
  database.workspaces.upsertWorkspace(
    createWorkspaceRecordFromSnapshot({
      id: "workspace-1",
      name: "Workspace",
      analysisType: "game-theory",
      snapshot: {},
      createdAt: 100,
      updatedAt: 100,
    }),
  );

  const thread: ThreadState = {
    id: "thread-1",
    workspaceId: "workspace-1",
    title: "Thread",
    isPrimary: true,
    createdAt: 100,
    updatedAt: 100,
  };
  database.threads.upsertThreadState(thread);
}

describe("provider-session-binding-service", () => {
  beforeEach(() => {
    testDatabase = createWorkspaceDatabase({ databasePath: ":memory:" });
    seedWorkspace(testDatabase);
  });

  afterEach(() => {
    testDatabase.close();
  });

  it("stores and resolves bindings by thread and purpose", () => {
    upsertProviderSessionBinding({
      version: 1,
      provider: "claude",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      purpose: "chat",
      runId: "run-chat",
      phaseTurnId: "turn-chat",
      providerSessionId: "session-chat",
      claudeSessionId: "session-chat",
      updatedAt: 100,
    });
    upsertProviderSessionBinding({
      version: 1,
      provider: "claude",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      purpose: "analysis",
      runId: "run-analysis",
      phaseTurnId: "turn-analysis",
      providerSessionId: "session-analysis",
      claudeSessionId: "session-analysis",
      updatedAt: 200,
    });

    expect(getProviderSessionBinding("thread-1")).toMatchObject({
      purpose: "chat",
      runId: "run-chat",
      phaseTurnId: "turn-chat",
      providerSessionId: "session-chat",
    });
    expect(getProviderSessionBinding("thread-1", "analysis")).toMatchObject({
      purpose: "analysis",
      runId: "run-analysis",
      phaseTurnId: "turn-analysis",
      providerSessionId: "session-analysis",
    });

    expect(
      testDatabase.providerSessionBindings.listBindingsByWorkspaceId(
        "workspace-1",
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          purpose: "chat",
          phaseTurnId: "turn-chat",
          runId: "run-chat",
        }),
        expect.objectContaining({
          purpose: "analysis",
          phaseTurnId: "turn-analysis",
          runId: "run-analysis",
        }),
      ]),
    );
  });

  it("clears only the requested purpose binding", () => {
    upsertProviderSessionBinding({
      version: 1,
      provider: "claude",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      purpose: "chat",
      runId: "run-chat",
      phaseTurnId: "turn-chat",
      providerSessionId: "session-chat",
      claudeSessionId: "session-chat",
      updatedAt: 100,
    });
    upsertProviderSessionBinding({
      version: 1,
      provider: "claude",
      workspaceId: "workspace-1",
      threadId: "thread-1",
      purpose: "analysis",
      runId: "run-analysis",
      phaseTurnId: "turn-analysis",
      providerSessionId: "session-analysis",
      claudeSessionId: "session-analysis",
      updatedAt: 200,
    });

    expect(
      clearProviderSessionBinding("thread-1", {
        purpose: "analysis",
        expectedPurpose: "analysis",
        runId: "run-analysis",
      }),
    ).toBe(true);

    expect(getProviderSessionBinding("thread-1")).toMatchObject({
      purpose: "chat",
      providerSessionId: "session-chat",
    });
    expect(getProviderSessionBinding("thread-1", "analysis")).toBeNull();
  });
});
