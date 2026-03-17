import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import handler from "./config.delete.ts";
import { callPost } from "../../test-support/http";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { deleteManagedMcpConfig } from "../../utils/mcp-config-writers";

vi.mock("../../utils/integration-status", () => ({
  getMcpIntegrationStatuses: vi.fn(),
}));

vi.mock("../../utils/mcp-config-writers", () => ({
  deleteManagedMcpConfig: vi.fn(),
}));

const getStatusesMock = getMcpIntegrationStatuses as unknown as Mock;
const deleteConfigMock = deleteManagedMcpConfig as unknown as Mock;

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/mcp/config.delete", () => {
  it("rejects invalid MCP config delete payloads", async () => {
    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/config/delete",
      {
        transportMode: "stdio",
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Invalid MCP config delete request");
  });

  it("clears config and returns managed integration state when available", async () => {
    getStatusesMock.mockResolvedValueOnce([
      {
        tool: "copilot-cli",
        displayName: "GitHub Copilot CLI",
        enabled: true,
        installed: true,
        validated: true,
        authenticated: null,
        statusMessage: "installed",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: "/tmp/mcp/copilot-cli.json",
      },
    ]);

    const response = await callPost<{
      status: string;
      integration?: { tool: string; configPath: string | null; statusMessage: string };
    }>(handler, "/api/mcp/config/delete", {
      tool: "copilot-cli",
    });

    expect(deleteConfigMock).toHaveBeenCalledTimes(1);
    expect(deleteConfigMock).toHaveBeenCalledWith("copilot-cli");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.integration?.tool).toBe("copilot-cli");
    expect(response.body.integration?.configPath).toBeNull();
    expect(response.body.integration?.statusMessage).toContain("Managed MCP config removed");
  });

  it("returns null integration payload when status refresh is unavailable", async () => {
    getStatusesMock.mockResolvedValueOnce([]);

    const response = await callPost<{
      status: string;
      integration: null | { tool: string; configPath: string | null };
    }>(handler, "/api/mcp/config/delete", {
      tool: "copilot-cli",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.integration).toBeNull();
  });
});
