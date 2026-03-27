import { afterEach, describe, expect, it, vi } from "vitest";

const bindWorkspaceDatabaseForInitMock = vi.fn();
const waitForRuntimeRecoveryMock = vi.fn(() => Promise.resolve());
const getWorkspaceDatabaseMock = vi.fn();

vi.mock("../../services/entity-graph-service", () => ({
  _bindWorkspaceDatabaseForInit: bindWorkspaceDatabaseForInitMock,
}));

vi.mock("../../services/workspace/runtime-recovery-service", () => ({
  waitForRuntimeRecovery: waitForRuntimeRecoveryMock,
}));

vi.mock("../../services/workspace/workspace-db", () => ({
  getWorkspaceDatabase: getWorkspaceDatabaseMock,
}));

describe("entity-graph-bootstrap plugin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    bindWorkspaceDatabaseForInitMock.mockReset();
    waitForRuntimeRecoveryMock.mockReset();
    getWorkspaceDatabaseMock.mockReset();
  });

  it("binds the workspace database and eagerly starts runtime recovery on startup", async () => {
    vi.stubEnv("VITEST", "");

    const plugin = (await import("../entity-graph-bootstrap")).default;
    plugin();

    expect(bindWorkspaceDatabaseForInitMock).toHaveBeenCalledTimes(1);
    expect(bindWorkspaceDatabaseForInitMock.mock.calls[0]?.[0]).toEqual(
      expect.any(Function),
    );
    expect(waitForRuntimeRecoveryMock).toHaveBeenCalledTimes(1);
  });

  it("skips startup work under vitest mode", async () => {
    vi.stubEnv("VITEST", "true");

    const plugin = (await import("../entity-graph-bootstrap")).default;
    plugin();

    expect(bindWorkspaceDatabaseForInitMock).not.toHaveBeenCalled();
    expect(waitForRuntimeRecoveryMock).not.toHaveBeenCalled();
  });
});
