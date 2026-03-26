import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { getWorkspaceDatabasePath } from "./workspace-db-path";
import { initializeWorkspaceSchema } from "./workspace-schema";
import { createActivityRepository } from "./activity-repository";
import { createDomainEventRepository } from "./domain-event-repository";
import { createDomainEventStore } from "./domain-event-store";
import { createMessageRepository } from "./message-repository";
import { createPhaseTurnSummaryRepository } from "./phase-turn-summary-repository";
import { createProviderSessionBindingRepository } from "./provider-session-binding-repository";
import { createRunRepository } from "./run-repository";
import { createThreadRepository } from "./thread-repository";
import { createWorkspaceRepository } from "./workspace-repository";
import { createSqliteCommandReceiptStore } from "./command-receipt-repository";
import { createEntityGraphRepository } from "./entity-graph-repository";
import { createQuestionRepository } from "./question-repository";
import type { ActivityRepository } from "./activity-repository";
import type { DomainEventRepository } from "./domain-event-repository";
import type { DomainEventStore } from "./domain-event-store";
import type { EntityGraphRepository } from "./entity-graph-repository";
import type { QuestionRepository } from "./question-repository";
import type { MessageRepository } from "./message-repository";
import type { PhaseTurnSummaryRepository } from "./phase-turn-summary-repository";
import type { ProviderSessionBindingRepository } from "./provider-session-binding-repository";
import type { RunRepository } from "./run-repository";
import type { ThreadRepository } from "./thread-repository";
import type { WorkspaceRepository } from "./workspace-repository";
import type { CommandReceiptStore } from "../command-bus";

// Lazy-load node:sqlite to avoid breaking the Bun-hosted Vite dev server.
// Bun does not implement node:sqlite. Nitro plugins eagerly resolve the
// full static import graph, so a top-level value import of DatabaseSync
// crashes the dev server before any request is served. The lazy require()
// defers resolution until the first actual database open, which only
// happens under Node.js (Nitro server runtime), not Bun (Vite host).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _DatabaseSyncCtor: any = null;
function loadDatabaseSync() {
  if (!_DatabaseSyncCtor) {
    const esmRequire = createRequire(import.meta.url);
    _DatabaseSyncCtor = esmRequire("node:sqlite").DatabaseSync;
  }
  return _DatabaseSyncCtor;
}

export interface WorkspaceDatabaseOptions {
  databasePath?: string;
}

// Re-export the DatabaseSync type for consumers that need it in signatures.
// This is type-only and does not trigger node:sqlite resolution at import time.
import type { DatabaseSync } from "node:sqlite";

export interface WorkspaceDatabase {
  databasePath: string;
  db: DatabaseSync;
  workspaces: WorkspaceRepository;
  threads: ThreadRepository;
  messages: MessageRepository;
  activities: ActivityRepository;
  runs: RunRepository;
  phaseTurnSummaries: PhaseTurnSummaryRepository;
  domainEvents: DomainEventRepository;
  entityGraph: EntityGraphRepository;
  questions: QuestionRepository;
  eventStore: DomainEventStore;
  providerSessionBindings: ProviderSessionBindingRepository;
  commandReceipts: CommandReceiptStore;
  close(): void;
}

let sharedWorkspaceDatabase: WorkspaceDatabase | null = null;

function openWorkspaceDatabase(databasePath: string) {
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }

  const DatabaseSyncCtor = loadDatabaseSync();
  return new DatabaseSyncCtor(databasePath, {
    enableForeignKeyConstraints: true,
    timeout: 5_000,
  });
}

export function createWorkspaceDatabase(
  options: WorkspaceDatabaseOptions = {},
): WorkspaceDatabase {
  const databasePath = options.databasePath ?? getWorkspaceDatabasePath();
  const db = openWorkspaceDatabase(databasePath);
  initializeWorkspaceSchema(db);

  const workspaces = createWorkspaceRepository(db);
  const threads = createThreadRepository(db);
  const messages = createMessageRepository(db);
  const activities = createActivityRepository(db);
  const runs = createRunRepository(db);
  const phaseTurnSummaries = createPhaseTurnSummaryRepository(db);
  const domainEvents = createDomainEventRepository(db);
  const providerSessionBindings = createProviderSessionBindingRepository(db);
  const commandReceipts = createSqliteCommandReceiptStore(db);
  const entityGraph = createEntityGraphRepository(db);
  const questions = createQuestionRepository(db);
  const eventStore = createDomainEventStore({
    db,
    workspaces,
    threads,
    messages,
    runs,
    activities,
    phaseTurnSummaries,
    domainEvents,
    questions,
  });

  return {
    databasePath,
    db,
    workspaces,
    threads,
    messages,
    activities,
    runs,
    phaseTurnSummaries,
    domainEvents,
    entityGraph,
    questions,
    eventStore,
    providerSessionBindings,
    commandReceipts,
    close() {
      if (db.isOpen) {
        db.close();
      }
    },
  };
}

export function getWorkspaceDatabase(): WorkspaceDatabase {
  if (!sharedWorkspaceDatabase) {
    sharedWorkspaceDatabase = createWorkspaceDatabase();
  }
  return sharedWorkspaceDatabase;
}

export function resetWorkspaceDatabaseForTest(): void {
  if (!sharedWorkspaceDatabase) {
    return;
  }

  const { databasePath, close } = sharedWorkspaceDatabase;
  close();
  sharedWorkspaceDatabase = null;

  if (databasePath !== ":memory:" && existsSync(databasePath)) {
    try {
      unlinkSync(databasePath);
    } catch {
      // Best-effort cleanup for test isolation.
    }
  }
}
