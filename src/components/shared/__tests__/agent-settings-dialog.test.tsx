// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@/i18n";
import AgentSettingsDialog from "@/components/shared/agent-settings-dialog";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";

const dialogPath = join(
  process.cwd(),
  "src/components/shared/agent-settings-dialog.tsx",
);

describe("agent settings dialog MCP config", () => {
  it("keeps copied and displayed MCP HTTP config pinned to localhost", () => {
    const source = readFileSync(dialogPath, "utf8");

    expect(source).toContain("http://127.0.0.1:${mcpServerPort}/mcp");
    expect(source).not.toContain(
      "http://${mcpServerLocalIp}:${mcpHttpPort}/mcp",
    );
    expect(source).toContain("callMcpInstall(");
    expect(source).toContain("mcpServerPort");
  });

  it("exposes analysis runtime controls in the existing dialog", () => {
    const source = readFileSync(dialogPath, "utf8");

    expect(source).toContain('t("agents.analysisRuntime")');
    expect(source).toContain("setAnalysisWebSearch");
    expect(source).toContain("setAnalysisEffortLevel");
    expect(source).toContain("setAnalysisPhaseMode");
    expect(source).toContain("toggleAnalysisPhase");
    expect(source).toContain("RUNNABLE_PHASES.map");
    expect(source).not.toContain("analysis settings page");
  });
});

describe("agent settings dialog custom provider form", () => {
  afterEach(() => {
    cleanup();
    useAgentSettingsStore.setState(
      useAgentSettingsStore.getInitialState(),
      true,
    );
    vi.unstubAllGlobals();
  });

  it("mounts the custom form and shows the web-plaintext warning when expanded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ running: false, port: null, localIp: null }),
      }),
    );
    useAgentSettingsStore.setState({ dialogOpen: true });

    render(<AgentSettingsDialog />);

    // Header row is always present.
    expect(screen.getByText("Custom API")).toBeTruthy();

    // Expand the custom section via its chevron button.
    fireEvent.click(screen.getByRole("button", { name: "Custom API" }));

    // Form controls render.
    expect(screen.getByText("Provider preset")).toBeTruthy();
    expect(screen.getByText("Base URL")).toBeTruthy();
    expect(screen.getByText("Search provider")).toBeTruthy();
    expect(screen.getByText("Model has built-in web search")).toBeTruthy();

    // jsdom has no OS keychain, so the probe reports insecure storage.
    expect(await screen.findByText(/stores keys unencrypted/i)).toBeTruthy();
  });
});
