/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/dom";
import { AgentToolCall, summarizeToolCall } from "./agent-tool-call";
import { renderWithShell } from "@/test-support/render-router";
import type { AgentToolCallEntry } from "@/stores/ai-store";

function makeToolCall(
  overrides: Partial<AgentToolCallEntry> = {},
): AgentToolCallEntry {
  return {
    id: "tc-1",
    name: "get_analysis_status",
    input: {},
    status: "complete",
    durationMs: 123,
    ...overrides,
  };
}

describe("AgentToolCall component", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("renders tool name for a completed tool call", async () => {
    const shell = renderWithShell(<AgentToolCall toolCall={makeToolCall()} />);
    await waitFor(() => {
      expect(screen.getByText("get_analysis_status")).toBeDefined();
    });
    shell.unmount();
  });

  it("shows duration badge when status is complete and durationMs is set", async () => {
    const shell = renderWithShell(
      <AgentToolCall toolCall={makeToolCall({ durationMs: 42 })} />,
    );
    await waitFor(() => {
      expect(screen.getByText("42ms")).toBeDefined();
    });
    shell.unmount();
  });

  it("does not show duration badge when durationMs is absent", async () => {
    const shell = renderWithShell(
      <AgentToolCall toolCall={makeToolCall({ durationMs: undefined })} />,
    );
    await waitFor(() => {
      // Tool name rendered confirms component mounted
      expect(screen.getByText("get_analysis_status")).toBeDefined();
    });
    expect(screen.queryByText(/ms$/)).toBeNull();
    shell.unmount();
  });

  it("shows pending indicator when status is pending", async () => {
    const shell = renderWithShell(
      <AgentToolCall
        toolCall={makeToolCall({ status: "pending", durationMs: undefined })}
      />,
    );
    await waitFor(() => {
      // Tool name still visible
      expect(screen.getByText("get_analysis_status")).toBeDefined();
    });
    // No duration badge for pending calls without durationMs set
    expect(screen.queryByText(/ms$/)).toBeNull();
    shell.unmount();
  });
});

describe("summarizeToolCall", () => {
  it("returns the name field when present", () => {
    expect(summarizeToolCall("myTool", { name: "MyScenario" })).toBe(
      "MyScenario",
    );
  });

  it("returns the title field when name is absent", () => {
    expect(summarizeToolCall("myTool", { title: "My Title" })).toBe("My Title");
  });

  it("truncates long statements with '...'", () => {
    const longStatement = "a".repeat(61);
    const result = summarizeToolCall("myTool", { statement: longStatement });
    expect(result).toHaveLength(63); // 60 chars + "..."
    expect(result.endsWith("...")).toBe(true);
  });

  it("does NOT add '...' for statements at or below 60 characters", () => {
    const shortStatement = "a".repeat(60);
    const result = summarizeToolCall("myTool", { statement: shortStatement });
    expect(result).toBe(shortStatement);
    expect(result.endsWith("...")).toBe(false);
  });
});
