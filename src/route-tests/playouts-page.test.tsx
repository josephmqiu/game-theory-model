/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { Suspense } from "react";
import { PlayoutsPage } from "@/routes/editor/playouts";
import { renderWithShell } from "@/test-support/render-router";
import type { CanonicalStore } from "shared/game-theory/types/canonical";
import type { PlaySession } from "@/stores/play-store";

const baseCanonical = {
  games: {
    game_1: {
      id: "game_1",
      name: "Scenario game",
      players: ["player_1", "player_2"],
    },
  },
  formalizations: {
    formalization_1: {
      id: "formalization_1",
      game_id: "game_1",
    },
  },
  players: {
    player_1: { id: "player_1", name: "State A", type: "state" },
    player_2: { id: "player_2", name: "State B", type: "state" },
  },
  scenarios: {
    scenario_1: {
      id: "scenario_1",
      name: "Escalation scenario",
      formalization_id: "formalization_1",
    },
  },
} as unknown as CanonicalStore;

let canonicalState = { canonical: baseCanonical };
let activeSessionId: string | null = null;
let sessions: Record<string, PlaySession> = {};

const callbacks = vi.hoisted(() => ({
  executeAppCommand: vi.fn(async (command: { type: string; payload: Record<string, unknown> }) => {
    if (command.type === "start_play_session") {
      const scenarioId = command.payload.scenarioId as string;
      const aiControlledPlayers = (command.payload.aiControlledPlayers ?? []) as string[];

      const session: PlaySession = {
        id: "session-01",
        scenarioId,
        aiControlledPlayers,
        branchLabel: "main",
        status: "active",
        turns: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      sessions = { ...sessions, [session.id]: session };
      activeSessionId = session.id;

      return session;
    }

    if (command.type === "play_turn") {
      return {
        id: "turn-01",
        playerId: String(command.payload.playerId),
        action: String(command.payload.action),
        reasoning: (command.payload.reasoning as string | undefined) ?? undefined,
        controlMode: "manual",
        timestamp: new Date().toISOString(),
      };
    }

    return { status: "ok" };
  }),
}));

const executeAppCommandMock = callbacks.executeAppCommand;

const setActiveSession = vi.fn((nextSessionId: string | null) => {
  activeSessionId = nextSessionId;
});

const setSessionStatus = vi.fn();
const setSessionAiPlayers = vi.fn();
const setSessionBranchLabel = vi.fn();
const deleteSession = vi.fn();

function resetPlayState(): void {
  canonicalState = { canonical: baseCanonical };
  activeSessionId = null;
  sessions = {};
  setActiveSession.mockReset();
  setSessionStatus.mockReset();
  setSessionAiPlayers.mockReset();
  setSessionBranchLabel.mockReset();
  deleteSession.mockReset();
  executeAppCommandMock.mockReset();
}

vi.mock("@/services/app-command-runner", () => ({
  executeAppCommand: callbacks.executeAppCommand,
}));

vi.mock("@/stores/analysis-store", () => ({
  useAnalysisStore: (selector: (state: { canonical: CanonicalStore }) => unknown) =>
    selector({ canonical: canonicalState.canonical }),
}));

vi.mock("@/stores/play-store", () => ({
  usePlayStore: (
    selector: (state: {
      sessions: Record<string, PlaySession>;
      activeSessionId: string | null;
      setSessionStatus: typeof setSessionStatus;
      setSessionBranchLabel: typeof setSessionBranchLabel;
      setAiControlledPlayers: typeof setSessionAiPlayers;
      deleteSession: typeof deleteSession;
      setActiveSession: typeof setActiveSession;
      startSession: ReturnType<typeof vi.fn>;
      playTurn: ReturnType<typeof vi.fn>;
      branchSession: ReturnType<typeof vi.fn>;
      replaceSessions: ReturnType<typeof vi.fn>;
      reset: ReturnType<typeof vi.fn>;
    }) => unknown,
  ) =>
    selector({
      sessions,
      activeSessionId,
      setSessionStatus,
      setSessionBranchLabel,
      setAiControlledPlayers: setSessionAiPlayers,
      deleteSession,
      setActiveSession,
      startSession: vi.fn(),
      playTurn: vi.fn(),
      branchSession: vi.fn(),
      replaceSessions: vi.fn(),
      reset: vi.fn(),
    }),
}));

describe("Playouts route", () => {
  const renderedShells: Array<ReturnType<typeof renderWithShell>> = [];

  beforeEach(() => {
    resetPlayState();
  });

  afterEach(() => {
    while (renderedShells.length > 0) {
      renderedShells.pop()?.unmount();
    }
    vi.clearAllMocks();
  });

  it("starts a session with selected scenario and AI-controlled players", async () => {
    renderedShells.push(renderWithShell(
      <Suspense fallback={null}>
        <PlayoutsPage />
      </Suspense>,
    ));

    await waitFor(() => {
      expect(screen.getByText("Play-outs")).toBeTruthy();
    });

    fireEvent.change(screen.getByRole("combobox", { name: "Scenario" }), {
      target: { value: "scenario_1" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: "State A" }));
    fireEvent.click(screen.getByRole("button", { name: "Start session" }));

    await waitFor(() => {
      expect(executeAppCommandMock).toHaveBeenCalledWith({
        type: "start_play_session",
        payload: {
          scenarioId: "scenario_1",
          aiControlledPlayers: ["player_1"],
        },
      });
    });
  });

  it("records manual turns and blocks manual turns when all players are AI-controlled", async () => {
    const initialSession: PlaySession = {
      id: "session-01",
      scenarioId: "scenario_1",
      aiControlledPlayers: ["player_1"],
      branchLabel: "main",
      status: "active",
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    sessions = { [initialSession.id]: initialSession };
    activeSessionId = initialSession.id;

    const firstView = renderWithShell(
      <Suspense fallback={null}>
        <PlayoutsPage />
      </Suspense>,
    );
    renderedShells.push(firstView);

    await waitFor(() => {
      expect(screen.getByText("Turn target:")).toBeTruthy();
    });

    const actionInput = screen.getByPlaceholderText("Describe the move or decision");
    fireEvent.change(actionInput, { target: { value: "Concede" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Player (manual)" }), {
      target: { value: "player_2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Record turn" }));

    await waitFor(() => {
      expect(executeAppCommandMock).toHaveBeenCalledWith({
        type: "play_turn",
        payload: {
          sessionId: initialSession.id,
          playerId: "player_2",
          action: "Concede",
          reasoning: undefined,
        },
      });
    });
    firstView.unmount();
    renderedShells.pop();

    const blockedSession: PlaySession = {
      id: "session-02",
      scenarioId: "scenario_1",
      aiControlledPlayers: ["player_1", "player_2"],
      branchLabel: "main",
      status: "active",
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sessions = { [blockedSession.id]: blockedSession };
    activeSessionId = blockedSession.id;

    const secondView = renderWithShell(
      <Suspense fallback={null}>
        <PlayoutsPage />
      </Suspense>,
    );
    renderedShells.push(secondView);

    await waitFor(() => {
      expect(
        screen.getByText(
          "All scenario players are marked AI-controlled. Unmark at least one player above to record manual turns.",
        ),
      ).toBeTruthy();
    });

    expect(
      screen.getByRole("button", { name: "Record turn" }).hasAttribute("disabled"),
    ).toBe(true);
    expect(executeAppCommandMock).not.toHaveBeenCalledWith({
      type: "play_turn",
      payload: expect.objectContaining({ sessionId: blockedSession.id }),
    });
    secondView.unmount();
    renderedShells.pop();
  });
});
