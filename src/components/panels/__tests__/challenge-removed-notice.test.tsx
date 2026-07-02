// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ChallengeRecord } from "@/types/entity";
import { useEntityGraphStore } from "@/stores/entity-graph-store";

const markChallengeViewedMock = vi.fn();

vi.mock("@/services/ai/analysis-client", () => ({
  markChallengeViewed: (...args: unknown[]) => markChallengeViewedMock(...args),
}));

import { ChallengeRemovedNotice } from "../challenge-removed-notice";

function seedChallenges(challenges: ChallengeRecord[]) {
  useEntityGraphStore.setState({
    analysis: {
      id: "a1",
      name: "Test",
      topic: "Test",
      entities: [],
      relationships: [],
      phases: [],
      challenges,
    },
  });
}

function removedChallenge(overrides: Partial<ChallengeRecord> = {}) {
  return {
    id: "ch-removed",
    entityId: "deleted-entity",
    objection: "This entity was based on stale evidence.",
    createdAt: 1,
    status: "resolved" as const,
    outcome: "REMOVED" as const,
    resolvedAt: 2,
    viewed: false,
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  markChallengeViewedMock.mockResolvedValue(undefined);
});

describe("ChallengeRemovedNotice", () => {
  it("renders objection text and the REMOVED chip for unviewed removed records", () => {
    seedChallenges([removedChallenge()]);

    render(<ChallengeRemovedNotice />);

    expect(screen.getByText("OBJECTION REMOVED ENTITY")).toBeTruthy();
    expect(screen.getByText("REMOVED")).toBeTruthy();
    expect(screen.getByText(/stale evidence/)).toBeTruthy();
  });

  it("dismisses a removed challenge by marking it viewed", () => {
    seedChallenges([removedChallenge({ id: "ch-dismiss" })]);

    render(<ChallengeRemovedNotice />);
    fireEvent.click(screen.getByText("Dismiss"));

    expect(markChallengeViewedMock).toHaveBeenCalledWith("ch-dismiss");
  });

  it("renders nothing when there are no unviewed REMOVED records", () => {
    seedChallenges([
      removedChallenge({ id: "viewed", viewed: true }),
      removedChallenge({ id: "revised", outcome: "REVISED", viewed: false }),
    ]);

    const { container } = render(<ChallengeRemovedNotice />);

    expect(container.firstChild).toBeNull();
  });
});
