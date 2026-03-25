import { describe, expect, it } from "vitest";
import { getWorkspaceDatabasePath } from "../workspace-db-path";

describe("workspace-db-path", () => {
  it("resolves into the configured runtime user data dir", () => {
    expect(
      getWorkspaceDatabasePath({ userDataDir: "/tmp/gta-runtime" }),
    ).toBe("/tmp/gta-runtime/workspace-state.sqlite");
  });

  it("respects an explicit user-data dir from the environment", () => {
    expect(
      getWorkspaceDatabasePath({
        env: {
          GAME_THEORY_ANALYZER_USER_DATA_DIR: "/tmp/gta-env-runtime",
        },
      }),
    ).toBe("/tmp/gta-env-runtime/workspace-state.sqlite");
  });
});

