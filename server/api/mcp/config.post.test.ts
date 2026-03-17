import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import handler from "./config.post.ts";
import { callPost } from "../../test-support/http";
import { getMcpIntegrationStatuses } from "../../utils/integration-status";
import { writeManagedMcpConfig } from "../../utils/mcp-config-writers";

vi.mock("../../utils/integration-status", () => ({
  getMcpIntegrationStatuses: vi.fn(),
}));

vi.mock("../../utils/mcp-config-writers", () => ({
  writeManagedMcpConfig: vi.fn(),
}));

const getStatusesMock = getMcpIntegrationStatuses as unknown as Mock;
const writeConfigMock = writeManagedMcpConfig as unknown as Mock;

afterEach(() => {
  vi.clearAllMocks();
});

describe("/api/mcp/config.post", () => {
  it("rejects invalid MCP config request payloads", async () => {
    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/config",
      {
        tool: "copilot-cli",
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Invalid MCP config request");
  });

  it("returns 404 for unknown integration tools", async () => {
    getStatusesMock.mockResolvedValueOnce([]);

    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/config",
      {
        tool: "copilot-cli",
        transportMode: "stdio",
      },
    );

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Integration not found");
  });

  it("returns 400 when integration is not installed", async () => {
    getStatusesMock.mockResolvedValueOnce([
      {
        tool: "copilot-cli",
        displayName: "GitHub Copilot CLI",
        enabled: false,
        installed: false,
        validated: false,
        authenticated: null,
        statusMessage: "not installed",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: null,
      },
    ]);

    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/mcp/config",
      {
        tool: "copilot-cli",
        transportMode: "stdio",
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("is not installed on this machine");
  });

  it("writes managed MCP config for installed integrations", async () => {
    getStatusesMock.mockResolvedValue([
      {
        tool: "copilot-cli",
        displayName: "GitHub Copilot CLI",
        enabled: false,
        installed: true,
        validated: false,
        authenticated: null,
        statusMessage: "installed",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: null,
      },
      {
        tool: "copilot-cli",
        displayName: "GitHub Copilot CLI",
        enabled: false,
        installed: true,
        validated: true,
        authenticated: null,
        statusMessage: "installed",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: "/tmp/mcp/copilot-cli.json",
      },
      {
        tool: "claude-code",
        displayName: "Claude Code CLI",
        enabled: false,
        installed: false,
        validated: false,
        authenticated: null,
        statusMessage: "missing",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: null,
      },
    ]);
    writeConfigMock.mockResolvedValue("/tmp/mcp/copilot-cli.json");

    const response = await callPost<{
      status: string;
      path: string;
      integration?: {
        tool: string;
        configPath: string | null;
        statusMessage: string;
      };
    }>(handler, "/api/mcp/config", {
      tool: "copilot-cli",
      transportMode: "stdio",
    });

    expect(writeConfigMock).toHaveBeenCalledTimes(1);
    expect(writeConfigMock).toHaveBeenCalledWith("copilot-cli", "stdio");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.path).toBe("/tmp/mcp/copilot-cli.json");
    expect(response.body.integration?.tool).toBe("copilot-cli");
    expect(response.body.integration?.statusMessage).toContain("Managed MCP config written");
  });
});
