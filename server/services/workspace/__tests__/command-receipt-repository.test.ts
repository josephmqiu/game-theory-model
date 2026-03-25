import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { createWorkspaceDatabase } from "../workspace-db";

describe("sqlite command receipt store", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (!dir) continue;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function createDatabasePath(): string {
    const tempDir = mkdtempSync(join(tmpdir(), "gta-command-receipts-"));
    tempDirs.push(tempDir);
    return join(tempDir, "workspace-state.sqlite");
  }

  function makeReceipt(overrides: Record<string, unknown> = {}) {
    return {
      commandId: "cmd-1",
      receiptId: "receipt-1",
      kind: "analysis.reset" as const,
      status: "accepted" as const,
      payloadFingerprint: '{"kind":"analysis.reset","topic":"trade"}',
      submittedAt: 10,
      acceptedAt: 20,
      requestedBy: "test",
      ...overrides,
    };
  }

  it("keeps receipt-id lookups pinned to the first matching command", () => {
    const database = createWorkspaceDatabase({
      databasePath: createDatabasePath(),
    });
    const store = database.commandReceipts;

    store.save(
      makeReceipt({
        status: "running",
        startedAt: 30,
      }),
    );
    store.save(
      makeReceipt({
        status: "completed",
        startedAt: 30,
        finishedAt: 40,
        result: { ok: true },
      }),
    );

    const original = store.getByReceiptId("receipt-1");
    expect(original).toMatchObject({
      commandId: "cmd-1",
      status: "completed",
      result: { ok: true },
    });

    store.save(
      makeReceipt({
        commandId: "cmd-2",
        receiptId: "receipt-1",
        status: "conflicted",
        acceptedAt: 50,
        finishedAt: 60,
        conflictWithCommandId: "cmd-1",
        error: {
          name: "CommandReceiptConflict",
          message: "conflict",
        },
      }),
    );

    expect(store.getByCommandId("cmd-2")).toMatchObject({
      commandId: "cmd-2",
      status: "conflicted",
      conflictWithCommandId: "cmd-1",
    });
    expect(store.getByReceiptId("receipt-1")).toMatchObject({
      commandId: "cmd-1",
      status: "completed",
      result: { ok: true },
    });
    expect(store.list().map((receipt) => receipt.commandId)).toEqual([
      "cmd-1",
      "cmd-2",
    ]);

    database.close();
  });
});
