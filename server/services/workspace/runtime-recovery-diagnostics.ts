import { nanoid } from "nanoid";
import type {
  WorkspaceRecoveryDiagnostic,
  WorkspaceRecoveryDiagnosticCode,
} from "../../../shared/types/workspace-runtime";

const MAX_RECENT_RECOVERY_DIAGNOSTICS = 200;

const recoveryRecent: WorkspaceRecoveryDiagnostic[] = [];

function pushBounded<T>(items: T[], value: T, maxSize: number): void {
  items.push(value);
  if (items.length > maxSize) {
    items.splice(0, items.length - maxSize);
  }
}

export function recordWorkspaceRecoveryDiagnostic(
  diagnostic: Omit<WorkspaceRecoveryDiagnostic, "id" | "source" | "timestamp"> & {
    timestamp?: number;
  },
): WorkspaceRecoveryDiagnostic {
  const next: WorkspaceRecoveryDiagnostic = {
    id: `recovery-diag-${nanoid()}`,
    source: "server",
    timestamp: diagnostic.timestamp ?? Date.now(),
    ...diagnostic,
  };

  pushBounded(
    recoveryRecent,
    next,
    MAX_RECENT_RECOVERY_DIAGNOSTICS,
  );
  return next;
}

export function listWorkspaceRecoveryDiagnostics(): WorkspaceRecoveryDiagnostic[] {
  return [...recoveryRecent];
}

export function _resetWorkspaceRecoveryDiagnosticsForTest(): void {
  recoveryRecent.splice(0, recoveryRecent.length);
}

export type { WorkspaceRecoveryDiagnosticCode };
