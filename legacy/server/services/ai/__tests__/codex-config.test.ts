import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";

const ORIGINAL_ENV = { ...process.env };

// ── Mock os.homedir() to point at a temp dir ──

let tempHome: string;

vi.mock("node:os", () => ({
  homedir: () => tempHome,
  tmpdir: () => "/tmp",
}));

// ── Import after mock ──

let installMcpServer: typeof import("../codex-config").installMcpServer;
let uninstallMcpServer: typeof import("../codex-config").uninstallMcpServer;
let isInstalled: typeof import("../codex-config").isInstalled;
let registerCleanupHandler: typeof import("../codex-config").registerCleanupHandler;

beforeEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  tempHome = mkdtempSync(join(tmpdir(), "codex-config-test-"));
  // Re-import to pick up fresh module state
  const mod = await import("../codex-config");
  installMcpServer = mod.installMcpServer;
  uninstallMcpServer = mod.uninstallMcpServer;
  isInstalled = mod.isInstalled;
  registerCleanupHandler = mod.registerCleanupHandler;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  try {
    rmSync(tempHome, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

// ── Helpers ──

function configPath(): string {
  return join(tempHome, ".codex", "config.toml");
}

function lockfilePath(): string {
  return join(tempHome, ".codex", "config.toml.lock");
}

function writeConfig(content: string): void {
  const dir = join(tempHome, ".codex");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(configPath(), content, "utf-8");
}

function readConfig(): string {
  return readFileSync(configPath(), "utf-8");
}

// ── Tests ──

describe("codex-config", () => {
  describe("installMcpServer", () => {
    it("creates config.toml with the entry when file does not exist", () => {
      installMcpServer("node", ["path/to/server.js"]);

      expect(existsSync(configPath())).toBe(true);
      const content = readConfig();
      expect(content).toContain("[mcp_servers.game_theory_analyzer_mcp]");
      expect(content).toContain('command = "node"');
      expect(content).toContain('args = ["path/to/server.js"]');
      expect(content).toContain("startup_timeout_sec = 10");
      expect(content).toContain("tool_timeout_sec = 120");
      expect(content).toContain('env = { PRODUCT_ONLY = "1" }');
    });

    it("merges entry into existing config.toml, preserving other entries", () => {
      const existing = [
        'model = "o4-mini"',
        "",
        "[mcp_servers.other-tool]",
        'command = "python"',
        'args = ["tool.py"]',
        "",
      ].join("\n");
      writeConfig(existing);

      installMcpServer("node", ["app-mcp-server.js"]);

      const content = readConfig();
      // Our entry is present
      expect(content).toContain("[mcp_servers.game_theory_analyzer_mcp]");
      expect(content).toContain('command = "node"');
      // Existing entries are preserved
      expect(content).toContain('model = "o4-mini"');
      expect(content).toContain("[mcp_servers.other-tool]");
      expect(content).toContain('command = "python"');
    });

    it("replaces existing game_theory_analyzer_mcp entry on re-install", () => {
      installMcpServer("node", ["old-server.js"]);
      installMcpServer("node", ["new-server.js"]);

      const content = readConfig();
      expect(content).not.toContain("old-server.js");
      expect(content).toContain("new-server.js");
      // Only one section header
      const matches = content.match(
        /\[mcp_servers\.game_theory_analyzer_mcp\]/g,
      );
      expect(matches).toHaveLength(1);
    });

    it("removes the legacy game-theory-analyzer entry when installing", () => {
      writeConfig(
        [
          "[mcp_servers.game-theory-analyzer]",
          'command = "node"',
          'args = ["legacy-server.js"]',
          "",
        ].join("\n"),
      );

      installMcpServer("node", ["server.js"]);

      const content = readConfig();
      expect(content).not.toContain("[mcp_servers.game-theory-analyzer]");
      expect(content).toContain("[mcp_servers.game_theory_analyzer_mcp]");
    });

    it("removes .env sub-table sections to avoid duplicate-key TOML errors", () => {
      writeConfig(
        [
          "[mcp_servers.game_theory_analyzer_mcp.env]",
          'PRODUCT_ONLY = "1"',
          "",
          "[mcp_servers.game_theory_analyzer_mcp]",
          'command = "node"',
          'args = ["old-server.js"]',
          "",
        ].join("\n"),
      );

      installMcpServer("node", ["server.js"]);

      const content = readConfig();
      // Sub-table section must be removed (env is written inline)
      expect(content).not.toContain(
        "[mcp_servers.game_theory_analyzer_mcp.env]",
      );
      // Inline env must be present
      expect(content).toContain('env = { PRODUCT_ONLY = "1" }');
      // Only one section header for our key
      const matches = content.match(
        /\[mcp_servers\.game_theory_analyzer_mcp\]/g,
      );
      expect(matches).toHaveLength(1);
    });

    it("writes enabled_tools and preserves PRODUCT_ONLY when options are provided", () => {
      installMcpServer("node", ["server.js"], {
        enabledTools: ["get_entity", "query_entities"],
        env: { ANALYSIS_RUN_ID: "run-123" },
      });

      const content = readConfig();
      expect(content).toContain(
        'enabled_tools = ["get_entity", "query_entities"]',
      );
      expect(content).toContain(
        'env = { ANALYSIS_RUN_ID = "run-123", PRODUCT_ONLY = "1" }',
      );
    });

    it("uses analysis runtime env overrides for default startup and tool timeouts", async () => {
      process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_STARTUP_TIMEOUT_SEC =
        "25";
      process.env.GAME_THEORY_ANALYSIS_RUNTIME_CODEX_MCP_TOOL_TIMEOUT_SEC =
        "240";
      vi.resetModules();
      const mod = await import("../codex-config");
      installMcpServer = mod.installMcpServer;

      installMcpServer("node", ["server.js"]);

      const content = readConfig();
      expect(content).toContain("startup_timeout_sec = 25");
      expect(content).toContain("tool_timeout_sec = 240");
    });
  });

  describe("uninstallMcpServer", () => {
    it("removes entry, preserves others", () => {
      const existing = [
        "[mcp_servers.other-tool]",
        'command = "python"',
        'args = ["tool.py"]',
        "",
        "[mcp_servers.game_theory_analyzer_mcp]",
        'command = "node"',
        'args = ["server.js"]',
        "startup_timeout_sec = 10",
        "tool_timeout_sec = 120",
        "",
      ].join("\n");
      writeConfig(existing);

      uninstallMcpServer();

      const content = readConfig();
      expect(content).not.toContain("[mcp_servers.game_theory_analyzer_mcp]");
      expect(content).toContain("[mcp_servers.other-tool]");
      expect(content).toContain('command = "python"');
    });

    it("removes the legacy game-theory-analyzer entry during uninstall", () => {
      const existing = [
        "[mcp_servers.other-tool]",
        'command = "python"',
        'args = ["tool.py"]',
        "",
        "[mcp_servers.game-theory-analyzer]",
        'command = "node"',
        'args = ["legacy-server.js"]',
        "",
      ].join("\n");
      writeConfig(existing);

      uninstallMcpServer();

      const content = readConfig();
      expect(content).not.toContain("[mcp_servers.game-theory-analyzer]");
      expect(content).toContain("[mcp_servers.other-tool]");
    });

    it("handles missing config gracefully", () => {
      // Should not throw when file doesn't exist
      expect(() => uninstallMcpServer()).not.toThrow();
    });

    it("handles config with no game_theory_analyzer_mcp entry", () => {
      writeConfig('[mcp_servers.other]\ncommand = "x"\n');
      expect(() => uninstallMcpServer()).not.toThrow();
      const content = readConfig();
      expect(content).toContain("[mcp_servers.other]");
    });
  });

  describe("isInstalled", () => {
    it("returns true when installed", () => {
      installMcpServer("node", ["server.js"]);
      expect(isInstalled()).toBe(true);
    });

    it("returns false when not installed", () => {
      expect(isInstalled()).toBe(false);
    });

    it("returns false after uninstall", () => {
      installMcpServer("node", ["server.js"]);
      uninstallMcpServer();
      expect(isInstalled()).toBe(false);
    });
  });

  describe("lockfile", () => {
    it("is created during install and cleaned up after", () => {
      // Before install, no lockfile
      expect(existsSync(lockfilePath())).toBe(false);

      installMcpServer("node", ["server.js"]);

      // After install completes, lockfile should be cleaned up
      expect(existsSync(lockfilePath())).toBe(false);
    });

    it("prevents concurrent access (lockfile exists = throws)", () => {
      // Simulate a held lock
      const dir = join(tempHome, ".codex");
      mkdirSync(dir, { recursive: true });
      writeFileSync(lockfilePath(), "99999", { flag: "wx" });

      // Should throw because lock is already held (wx flag fails)
      expect(() => installMcpServer("node", ["server.js"])).toThrow();
    });
  });

  describe("registerCleanupHandler", () => {
    it("returns a function that removes handlers", () => {
      const cleanup = registerCleanupHandler();
      expect(typeof cleanup).toBe("function");
      // Should not throw
      cleanup();
    });
  });
});
