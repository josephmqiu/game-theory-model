import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { executeTool } from "./execute-helper";
import type { ToolContext } from "../types/agent";
import type { Command } from "../engine/commands";

// ── Minimal stub context ───────────────────────────────────────────────────────

function makeStubContext(
  dispatchResult: ReturnType<ToolContext["dispatch"]>,
): ToolContext {
  return {
    canonical: {} as ToolContext["canonical"],
    dispatch: vi.fn(() => dispatchResult),
    getAnalysisState: () => null,
    getDerivedState: () => ({
      readinessReportsByFormalization: {},
      solverResultsByFormalization: {},
      sensitivityByFormalizationAndSolver: {},
      dirtyFormalizations: {},
    }),
  };
}

// ── Schema and command fixture ─────────────────────────────────────────────────

const testSchema = z.object({
  name: z.string().min(1),
});

function buildTestCommand(parsed: unknown): Command {
  const data = parsed as z.infer<typeof testSchema>;
  return {
    kind: "add_player" as const,
    id: "player_abc",
    payload: {
      name: data.name,
      type: "individual" as const,
      objectives: [],
      constraints: [],
    },
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("executeTool", () => {
  it("returns error when input fails schema validation", () => {
    const context = makeStubContext({
      status: "committed",
    } as ReturnType<ToolContext["dispatch"]>);

    const result = executeTool({}, testSchema, buildTestCommand, context);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toMatch(/Invalid input/);
    expect(context.dispatch).not.toHaveBeenCalled();
  });

  it("dispatches command and returns success with id and kind on commit", () => {
    const context = makeStubContext({
      status: "committed",
    } as ReturnType<ToolContext["dispatch"]>);

    const result = executeTool(
      { name: "Player One" },
      testSchema,
      buildTestCommand,
      context,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { id: string; kind: string }).id).toBe("player_abc");
    expect((result.data as { id: string; kind: string }).kind).toBe(
      "add_player",
    );
    expect(context.dispatch).toHaveBeenCalledOnce();
  });

  it("returns error when dispatch is rejected", () => {
    const context = makeStubContext({
      status: "rejected",
      reason: "validation_failed",
      errors: ["Player name already exists"],
    } as ReturnType<ToolContext["dispatch"]>);

    const result = executeTool(
      { name: "Duplicate" },
      testSchema,
      buildTestCommand,
      context,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Player name already exists");
  });

  it("returns error when dispatch returns dry_run", () => {
    const context = makeStubContext({
      status: "dry_run",
    } as ReturnType<ToolContext["dispatch"]>);

    const result = executeTool(
      { name: "SomePlayer" },
      testSchema,
      buildTestCommand,
      context,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("dry_run");
  });

  it("returns empty string for id when command has no id field", () => {
    const context = makeStubContext({
      status: "committed",
    } as ReturnType<ToolContext["dispatch"]>);

    const noIdSchema = z.object({ value: z.string() });

    const result = executeTool(
      { value: "test" },
      noIdSchema,
      (_parsed) => ({
        kind: "update_player" as const,
        payload: { id: "p1", name: "Updated" },
      }),
      context,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.data as { id: string }).id).toBe("");
  });
});
