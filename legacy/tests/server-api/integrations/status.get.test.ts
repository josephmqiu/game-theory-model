import { describe, expect, it } from "vitest";
import handler from "../../../server/api/integrations/status.get.ts";
import { callGet } from "../../../server/test-support/http";

describe("/api/integrations/status", () => {
  it("returns provider and integration detection snapshots", async () => {
    const response = await callGet<{
      providers: Array<{
        provider: string;
        installed: boolean;
        authenticated: boolean | null;
        validated: boolean;
        statusMessage: string;
      }>;
      integrations: Array<{
        tool: string;
        installed: boolean;
        authenticated: boolean | null;
        validated: boolean;
        statusMessage: string;
        configPath: string | null;
      }>;
    }>(handler, "/api/integrations/status");

    expect(response.status).toBe(200);
    expect(response.body.providers).toHaveLength(4);
    expect(response.body.integrations).toHaveLength(6);
    expect(response.body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provider: "anthropic",
          installed: expect.any(Boolean),
        }),
        expect.objectContaining({
          provider: "openai",
          installed: expect.any(Boolean),
        }),
        expect.objectContaining({
          provider: "opencode",
          installed: expect.any(Boolean),
        }),
        expect.objectContaining({
          provider: "copilot",
          installed: expect.any(Boolean),
        }),
      ]),
    );
    expect(response.body.integrations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "claude-code",
          installed: expect.any(Boolean),
        }),
        expect.objectContaining({
          tool: "copilot-cli",
          installed: expect.any(Boolean),
        }),
      ]),
    );
  });
});
