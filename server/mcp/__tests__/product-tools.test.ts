import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../agents/analysis-agent", () => ({
  runFull: vi.fn(),
  getActiveStatus: vi.fn(() => null),
  abort: vi.fn(),
}));

vi.mock("../../services/revalidation-service", () => ({
  getActiveRevalStatus: vi.fn(() => null),
  revalidate: vi.fn(),
  getRevalStatus: vi.fn(() => null),
}));

vi.mock("../../utils/ai-logger", () => ({
  serverLog: vi.fn(),
  serverWarn: vi.fn(),
  serverError: vi.fn(),
}));

describe("product-tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("isolates tool crashes and returns an MCP-safe error payload", async () => {
    const { runFull } = await import("../../agents/analysis-agent");
    vi.mocked(runFull).mockRejectedValueOnce(new Error("provider exploded"));

    const { handleToolCall } = await import("../product-tools");
    const result = await handleToolCall("start_analysis", {
      topic: "Trade war",
    });

    expect(result.isError).toBe(false);
    expect(JSON.parse(result.text)).toEqual({
      error: "provider exploded",
    });
  });

  it("treats unknown tools as isolated errors instead of throwing", async () => {
    const { handleToolCall } = await import("../product-tools");

    await expect(handleToolCall("does_not_exist", {})).resolves.toEqual({
      text: "Error: Unknown tool: does_not_exist",
      isError: true,
    });
  });

  describe("chat-mode input validation", () => {
    it("rejects invalid entity type in handleCreateEntity", async () => {
      const { handleCreateEntity } = await import("../product-tools");
      const result = await handleCreateEntity({
        type: "destroys",
        phase: "situational-grounding",
        data: { name: "test" },
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Invalid entity type "destroys"/);
    });

    it("rejects invalid phase in handleCreateEntity", async () => {
      const { handleCreateEntity } = await import("../product-tools");
      const result = await handleCreateEntity({
        type: "fact",
        phase: "nonexistent-phase",
        data: { name: "test" },
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Invalid phase "nonexistent-phase"/);
    });

    it("rejects invalid relationship type in handleCreateRelationship", async () => {
      const { handleCreateRelationship } = await import("../product-tools");
      const result = await handleCreateRelationship({
        type: "annihilates",
        fromEntityId: "e1",
        toEntityId: "e2",
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Invalid relationship type "annihilates"/);
    });

    it("rejects structural field mutations in handleUpdateEntity", async () => {
      const { handleUpdateEntity } = await import("../product-tools");
      const result = await handleUpdateEntity({
        id: "e1",
        updates: { type: "player", phase: "scenarios" },
      });
      const parsed = JSON.parse(result);
      expect(parsed.error).toMatch(/Chat mode cannot modify structural fields/);
      expect(parsed.error).toMatch(/type/);
      expect(parsed.error).toMatch(/phase/);
    });
  });
});
