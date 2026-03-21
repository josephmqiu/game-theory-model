import { describe, it, expect, vi } from "vitest";
import { runModelGraders } from "../model-graders";

// Mock streamChat as an async generator that yields a score response
async function* mockStreamChat() {
  yield {
    type: "text_delta" as const,
    content: '{ "score": 0.85, "reasoning": "Good output" }',
  };
  yield { type: "turn_complete" as const };
}

vi.mock("../../services/ai/claude-adapter", () => ({
  streamChat: vi.fn(() => mockStreamChat()),
}));

describe("runModelGraders", () => {
  it("returns empty results when no rubrics defined", async () => {
    const results = await runModelGraders(
      [],
      "player-identification",
      undefined,
    );
    expect(results).toEqual([]);
  });

  it("calls streamChat and parses score from response", async () => {
    const entities = [{ type: "player", data: { name: "Player 1" } }];
    const rubrics = ["All players should be genuine actors"];
    const results = await runModelGraders(
      entities,
      "player-identification",
      rubrics,
    );
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.85);
    expect(results[0].passed).toBe(true); // 0.85 >= 0.7
  });

  it("marks rubric as failed when score is below 0.7", async () => {
    const adapter = await import("../../services/ai/claude-adapter");
    vi.mocked(adapter.streamChat).mockImplementationOnce(async function* () {
      yield {
        type: "text_delta" as const,
        content: '{ "score": 0.3, "reasoning": "Bad" }',
      };
      yield { type: "turn_complete" as const };
    });
    const results = await runModelGraders(
      [{ type: "player", data: { name: "Referee" } }],
      "player-identification",
      ["No reified concepts as players"],
    );
    expect(results[0].score).toBe(0.3);
    expect(results[0].passed).toBe(false);
  });
});
