import { describe, expect, it } from "vitest";
import {
  buildTranscript,
  projectThreadMessagesToChatMessages,
} from "@/services/ai/thread-projection";
import type { ThreadMessageState } from "../../../../shared/types/workspace-state";

describe("projectThreadMessagesToChatMessages", () => {
  it("maps thread messages to chat messages preserving role and content", () => {
    const threadMessages: ThreadMessageState[] = [
      {
        id: "msg-1",
        workspaceId: "ws-1",
        threadId: "thread-1",
        role: "user",
        content: "Analyze the situation",
        createdAt: 100,
        updatedAt: 100,
      },
      {
        id: "msg-2",
        workspaceId: "ws-1",
        threadId: "thread-1",
        role: "assistant",
        content: "Here is the analysis",
        createdAt: 200,
        updatedAt: 200,
      },
    ];

    const result = projectThreadMessagesToChatMessages(threadMessages);

    expect(result).toEqual([
      {
        id: "msg-1",
        role: "user",
        content: "Analyze the situation",
        timestamp: 100,
        attachments: undefined,
      },
      {
        id: "msg-2",
        role: "assistant",
        content: "Here is the analysis",
        timestamp: 200,
        attachments: undefined,
      },
    ]);
  });

  it("returns empty array for empty input", () => {
    expect(projectThreadMessagesToChatMessages([])).toEqual([]);
  });

  it("projects attachments with estimated size", () => {
    const threadMessages: ThreadMessageState[] = [
      {
        id: "msg-3",
        workspaceId: "ws-1",
        threadId: "thread-1",
        role: "user",
        content: "See attached",
        createdAt: 300,
        updatedAt: 300,
        attachments: [
          {
            name: "file.png",
            mediaType: "image/png",
            data: "AQID",
          },
        ],
      },
    ];

    const result = projectThreadMessagesToChatMessages(threadMessages);

    expect(result[0].attachments).toHaveLength(1);
    expect(result[0].attachments![0]).toMatchObject({
      id: "msg-3-attachment-0",
      name: "file.png",
      mediaType: "image/png",
      data: "AQID",
    });
    expect(result[0].attachments![0].size).toBeGreaterThan(0);
  });

  it("builds a phase divider from durable analysis messages even before activities arrive", () => {
    const threadMessages: ThreadMessageState[] = [
      {
        id: "msg-phase-user",
        workspaceId: "ws-1",
        threadId: "thread-1",
        role: "user",
        content: "Phase 1 brief",
        createdAt: 100,
        updatedAt: 100,
        source: "analysis",
        kind: "user-turn",
        runId: "run-1",
        phaseTurnId: "phase-turn-1",
        phase: "situational-grounding",
        runKind: "analysis",
      },
      {
        id: "msg-phase-assistant",
        workspaceId: "ws-1",
        threadId: "thread-1",
        role: "assistant",
        content: "Phase 1 result",
        createdAt: 200,
        updatedAt: 200,
        source: "analysis",
        kind: "assistant-turn",
        runId: "run-1",
        phaseTurnId: "phase-turn-1",
        phase: "situational-grounding",
        runKind: "analysis",
      },
    ];

    const transcript = buildTranscript(threadMessages, [], {
      completedPhases: new Set(["situational-grounding"]),
    });

    expect(transcript[0]).toMatchObject({
      kind: "phase-divider",
      phase: "situational-grounding",
      status: "completed",
    });
    expect(transcript[1]).toMatchObject({
      kind: "message",
      message: expect.objectContaining({ id: "msg-phase-user" }),
    });
    expect(transcript[2]).toMatchObject({
      kind: "message",
      message: expect.objectContaining({ id: "msg-phase-assistant" }),
    });
  });
});
