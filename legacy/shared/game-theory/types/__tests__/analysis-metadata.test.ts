import { describe, expect, it } from "vitest";

import { analysisFileSchema, emptyCanonicalStore } from "../index";
import { storeToAnalysisFile } from "../../utils/serialization";

describe("analysis file metadata", () => {
  it("accepts persisted play sessions in metadata", () => {
    const file = storeToAnalysisFile(emptyCanonicalStore(), {
      name: "Play session fixture",
      description: "Tests persisted play sessions.",
      created_at: "2026-03-16T00:00:00Z",
      updated_at: "2026-03-16T00:00:00Z",
      metadata: {
        tags: ["fixture"],
        play_sessions: [
          {
            id: "play_session_1",
            scenario_id: "scenario_1",
            ai_controlled_players: ["player_1"],
            branch_label: "main",
            status: "active",
            turns: [
              {
                id: "turn_1",
                player_id: "player_1",
                action: "Signal resolve",
                reasoning: "Test turn",
                timestamp: "2026-03-16T00:01:00Z",
              },
            ],
            created_at: "2026-03-16T00:00:00Z",
            updated_at: "2026-03-16T00:01:00Z",
            source_session_id: null,
          },
        ],
      },
    });

    const parsed = analysisFileSchema.parse(file);

    expect(parsed.metadata.play_sessions).toHaveLength(1);
    expect(parsed.metadata.play_sessions?.[0]?.turns[0]?.action).toBe(
      "Signal resolve",
    );
  });
});
