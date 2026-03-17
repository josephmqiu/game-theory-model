import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import handler from "../../../server/api/integrations/validate.post.ts";
import { callPost } from "../../../server/test-support/http";

vi.mock("../ai/connect-agent.post", () => ({
  discoverAgentConnection: vi.fn(),
}));

vi.mock("../../utils/integration-status", () => ({
  getMcpIntegrationStatuses: vi.fn(),
}));

import { discoverAgentConnection } from "../ai/connect-agent.post";
import { getMcpIntegrationStatuses } from "../../../server/utils/integration-status";

describe("/api/integrations/validate", () => {
  const mockDiscover = discoverAgentConnection as unknown as Mock;
  const mockGetStatuses = getMcpIntegrationStatuses as unknown as Mock;

  afterEach(() => {
    vi.clearAllMocks();
  });

  beforeEach(() => {
    mockDiscover.mockReset();
    mockGetStatuses.mockReset();
  });

  it("validates a provider by delegating to its connector", async () => {
    mockDiscover.mockResolvedValue({
      connected: true,
      models: [
        {
          value: "claude-sonnet-4",
          displayName: "Claude Sonnet 4",
          description: "",
          provider: "anthropic",
        },
      ],
    });

    const response = await callPost<{
      status: string;
      provider?: {
        provider: "anthropic" | "openai" | "opencode" | "copilot";
        installed: boolean;
      };
      models?: Array<{
        provider: "anthropic";
        value: string;
        displayName: string;
      }>;
    }>(handler, "/api/integrations/validate", {
      kind: "provider",
      target: "anthropic",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.provider).toMatchObject({
      provider: "anthropic",
      installed: true,
      validated: true,
      authenticated: true,
    });
    expect(response.body.models).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "claude-sonnet-4" }),
      ]),
    );
    expect(discoverAgentConnection).toHaveBeenCalledWith("claude-code");
  });

  it("returns a validation error when provider discovery fails", async () => {
    mockDiscover.mockResolvedValue({
      connected: false,
      models: [],
      error: "provider unavailable",
      notInstalled: true,
    });

    const response = await callPost<{
      status: "error";
      provider?: unknown;
      error?: string;
    }>(handler, "/api/integrations/validate", {
      kind: "provider",
      target: "openai",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("error");
    expect(response.body.provider).toMatchObject({
      provider: "openai",
      installed: false,
      validated: false,
      authenticated: null,
      statusMessage: "provider unavailable",
    });
  });

  it("validates installed integrations from MCP status", async () => {
    mockGetStatuses.mockResolvedValue([
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
        installed: true,
        validated: true,
        authenticated: null,
        statusMessage: "installed",
        lastCheckedAt: "2026-01-01T00:00:00.000Z",
        configPath: null,
      },
    ]);

    const response = await callPost<{
      status: string;
      integration?: {
        tool: string;
        installed: boolean;
        validated: boolean;
        authenticated: boolean | null;
      };
    }>(handler, "/api/integrations/validate", {
      kind: "integration",
      target: "copilot-cli",
    });

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.integration).toMatchObject({
      tool: "copilot-cli",
      installed: true,
      validated: true,
      authenticated: null,
      statusMessage: "copilot-cli is available for MCP wiring.",
    });
  });

  it("returns 404 for missing integrations", async () => {
    mockGetStatuses.mockResolvedValue([]);

    const response = await callPost<{
      status: "error";
      error: string;
    }>(handler, "/api/integrations/validate", {
      kind: "integration",
      target: "copilot-cli",
    });

    expect(response.status).toBe(404);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Integration not found");
  });

  it("rejects unknown validation targets", async () => {
    const response = await callPost<{ status: string; error: string }>(
      handler,
      "/api/integrations/validate",
      {
        kind: "provider",
        target: "bad-provider",
      },
    );

    expect(response.status).toBe(400);
    expect(response.body.status).toBe("error");
    expect(response.body.error).toContain("Unknown provider");
  });
});
