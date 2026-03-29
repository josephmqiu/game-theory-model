import { beforeEach, describe, it, expect, vi } from "vitest";
import { runModelGraders } from "../model-graders";

// Mock streamChat as an async generator that yields a score response
async function* mockStreamChat() {
  yield {
    type: "text_delta" as const,
    content: '{ "score": 0.85, "reasoning": "Good output" }',
  };
  yield { type: "turn_complete" as const };
}

const streamChatMock = vi.fn(() => mockStreamChat());

describe("runModelGraders", () => {
  beforeEach(() => {
    streamChatMock.mockReset();
    streamChatMock.mockImplementation(() => mockStreamChat());
  });

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
      { streamChatImpl: streamChatMock },
    );
    expect(results).toHaveLength(1);
    expect(results[0].score).toBe(0.85);
    expect(results[0].passed).toBe(true); // 0.85 >= 0.7
  });

  it("marks rubric as failed when score is below 0.7", async () => {
    streamChatMock.mockImplementationOnce(async function* () {
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
      { streamChatImpl: streamChatMock },
    );
    expect(results[0].score).toBe(0.3);
    expect(results[0].passed).toBe(false);
  });

  it("strips thinking tags before extracting score", async () => {
    streamChatMock.mockImplementationOnce(async function* () {
      yield {
        type: "text_delta" as const,
        content:
          "<thinking>Let me analyze this carefully. The entities look reasonable but have some issues.</thinking>" +
          '{ "score": 0.72, "reasoning": "Mostly good" }',
      };
      yield { type: "turn_complete" as const };
    });
    const results = await runModelGraders(
      [{ type: "player", data: { name: "Player 1" } }],
      "player-identification",
      ["Players should be genuine actors"],
      { streamChatImpl: streamChatMock },
    );
    expect(results[0].score).toBe(0.72);
    expect(results[0].passed).toBe(true);
  });

  it("strips thinking tags that contain score-like patterns", async () => {
    streamChatMock.mockImplementationOnce(async function* () {
      yield {
        type: "text_delta" as const,
        content:
          '<thinking>Initial assessment: "score": 0.2 seems right but on reflection...</thinking>' +
          '{ "score": 0.9, "reasoning": "Actually very good" }',
      };
      yield { type: "turn_complete" as const };
    });
    const results = await runModelGraders(
      [{ type: "fact", data: { category: "rule" } }],
      "situational-grounding",
      ["Facts should be grounded"],
      { streamChatImpl: streamChatMock },
    );
    // Should pick up 0.9 from outside thinking tags, not 0.2 from inside
    expect(results[0].score).toBe(0.9);
  });

  it("includes relationships in grader prompt when provided", async () => {
    const entities = [{ type: "player", data: { name: "Player 1" } }];
    const relationships = [
      { id: "r1", type: "supports", fromEntityId: "e1", toEntityId: "e2" },
    ];
    await runModelGraders(
      entities,
      "player-identification",
      ["Check relationship quality"],
      { streamChatImpl: streamChatMock, relationships },
    );
    // Verify streamChat was called with a prompt that includes relationships
    const callArgs = streamChatMock.mock.calls[0] as unknown[];
    expect(callArgs[0]).toContain("Relationships:");
    expect(callArgs[0]).toContain("supports");
  });
});
