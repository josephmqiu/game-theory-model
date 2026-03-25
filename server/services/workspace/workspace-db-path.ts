import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV,
  getWorkspaceDatabasePath as getRuntimeWorkspaceDatabasePath,
} from "../../../src/lib/runtime-state-paths";
const TEST_RUNTIME_STATE_DIR = join(
  tmpdir(),
  "game-theory-analyzer",
  "workspace-state",
);

type EnvLike = Record<string, string | undefined>;

export interface WorkspaceDatabasePathOptions {
  env?: EnvLike;
  homeDir?: string;
  userDataDir?: string;
}

function hasExplicitRuntimeDir(options?: WorkspaceDatabasePathOptions): boolean {
  return Boolean(
    options?.userDataDir?.trim() ||
      options?.env?.[GAME_THEORY_ANALYZER_USER_DATA_DIR_ENV]?.trim(),
  );
}

export function getWorkspaceDatabasePath(
  options?: WorkspaceDatabasePathOptions,
): string {
  if (!hasExplicitRuntimeDir(options) && process.env.NODE_ENV === "test") {
    return join(
      TEST_RUNTIME_STATE_DIR,
      String(process.pid),
      "workspace-state.sqlite",
    );
  }

  return getRuntimeWorkspaceDatabasePath({
    env: options?.env,
    homeDir: options?.homeDir,
    userDataDir: options?.userDataDir,
  });
}
