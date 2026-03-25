/**
 * Workspace utility functions previously spread across checkpointing/Utils.ts
 * and git/isRepo.ts. Retained because ProviderCommandReactor and
 * ProviderRuntimeIngestion still need them.
 */
import fs from "node:fs";
import path from "node:path";

import type { ProjectId } from "@t3tools/contracts";

/**
 * Resolve the effective workspace CWD for a thread by checking its worktree
 * path first, then falling back to the parent project's workspace root.
 */
export function resolveThreadWorkspaceCwd(input: {
  readonly thread: {
    readonly projectId: ProjectId;
    readonly worktreePath: string | null;
  };
  readonly projects: ReadonlyArray<{
    readonly id: ProjectId;
    readonly workspaceRoot: string;
  }>;
}): string | undefined {
  const worktreeCwd = input.thread.worktreePath ?? undefined;
  if (worktreeCwd) {
    return worktreeCwd;
  }

  return input.projects.find((project) => project.id === input.thread.projectId)
    ?.workspaceRoot;
}

/**
 * Synchronously check whether a directory appears to be inside a git repo.
 */
export function isGitRepository(cwd: string): boolean {
  try {
    return fs.statSync(path.join(cwd, ".git")).isDirectory();
  } catch {
    return false;
  }
}
