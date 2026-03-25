import { describe, expect, it } from "vitest";
import {
  normalizeRuntimeEffort,
  normalizeRuntimeProvider,
  type ProviderHealthState,
  type RuntimeModelInfo,
} from "../analysis-runtime";

describe("analysis-runtime", () => {
  it("normalizes legacy provider ids to canonical runtime providers", () => {
    expect(normalizeRuntimeProvider("anthropic")).toBe("claude");
    expect(normalizeRuntimeProvider("openai")).toBe("codex");
    expect(normalizeRuntimeProvider("claude")).toBe("claude");
    expect(normalizeRuntimeProvider("codex")).toBe("codex");
  });

  it("normalizes legacy effort aliases to canonical effort levels", () => {
    expect(normalizeRuntimeEffort("quick")).toBe("low");
    expect(normalizeRuntimeEffort("standard")).toBe("medium");
    expect(normalizeRuntimeEffort("thorough")).toBe("high");
    expect(normalizeRuntimeEffort("max")).toBe("max");
  });

  it("represents structured provider health", () => {
    const health: ProviderHealthState = {
      provider: "claude",
      status: "healthy",
      reason: null,
      checkedAt: Date.now(),
      binaryPath: "/usr/local/bin/claude",
      version: "1.2.3",
      checks: [
        { name: "binary", status: "pass", observedValue: "/usr/local/bin/claude" },
        { name: "version", status: "pass", observedValue: "1.2.3" },
        { name: "auth", status: "pass" },
        { name: "runtime", status: "pass" },
      ],
    };

    expect(health.status).toBe("healthy");
    expect(health.reason).toBeNull();
    expect(health.checks?.[0]?.name).toBe("binary");
  });

  it("represents canonical model capability metadata", () => {
    const model: RuntimeModelInfo = {
      provider: "codex",
      id: "gpt-5.4",
      displayName: "GPT-5.4",
      capabilities: {
        streaming: true,
        structuredOutput: true,
        toolCalls: true,
        webSearch: true,
        imageInput: false,
        threadResume: true,
      },
      effort: {
        supported: ["low", "medium", "high", "max"],
        default: "medium",
        aliases: {
          xhigh: "max",
        },
      },
    };

    expect(model.capabilities.threadResume).toBe(true);
    expect(model.effort.aliases?.xhigh).toBe("max");
  });
});
