import { createStore, useStore } from "zustand";

type PlaySessionStatus = "active" | "completed";

export interface PlaySessionTurn {
  id: string;
  playerId: string;
  action: string;
  reasoning?: string;
  controlMode?: "manual" | "ai";
  timestamp: string;
}

export interface PlaySession {
  id: string;
  scenarioId: string;
  aiControlledPlayers: string[];
  branchLabel: string;
  status: PlaySessionStatus;
  turns: PlaySessionTurn[];
  createdAt: string;
  updatedAt: string;
  sourceSessionId?: string | null;
}

interface PlayState {
  sessions: Record<string, PlaySession>;
  activeSessionId: string | null;
}

interface PlayActions {
  startSession: (input: {
    scenarioId: string;
    aiControlledPlayers?: string[];
    branchLabel?: string;
  }) => PlaySession;
  playTurn: (input: {
    sessionId: string;
    playerId: string;
    action: string;
    reasoning?: string;
  }) => PlaySession;
  branchSession: (input: {
    sessionId: string;
    branchLabel: string;
  }) => PlaySession;
  setSessionBranchLabel: (input: {
    sessionId: string;
    branchLabel: string;
  }) => PlaySession;
  setSessionStatus: (input: {
    sessionId: string;
    status: PlaySessionStatus;
  }) => PlaySession;
  setAiControlledPlayers: (input: {
    sessionId: string;
    aiControlledPlayers: string[];
  }) => PlaySession;
  deleteSession: (sessionId: string) => void;
  setActiveSession: (sessionId: string | null) => void;
  replaceSessions: (
    sessions: PlaySession[],
    activeSessionId?: string | null,
  ) => void;
  reset: () => void;
}

type PlayStore = PlayState & PlayActions;

function normalizeAiControlledPlayers(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean).filter((value) => value.trim().length > 0))]
    .sort((left, right) => left.localeCompare(right));
}

export const playStore = createStore<PlayStore>((set, get) => ({
  sessions: {},
  activeSessionId: null,

  startSession(input) {
    const session: PlaySession = {
      id: crypto.randomUUID(),
      scenarioId: input.scenarioId,
      aiControlledPlayers: normalizeAiControlledPlayers(input.aiControlledPlayers ?? []),
      branchLabel: input.branchLabel?.trim() || "main",
      status: "active",
      turns: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceSessionId: null,
    };

    set((state) => ({
      sessions: { ...state.sessions, [session.id]: session },
      activeSessionId: session.id,
    }));
    return session;
  },

  playTurn(input) {
    const session = get().sessions[input.sessionId];
    if (!session) {
      throw new Error(`Play session ${input.sessionId} not found.`);
    }
    if (session.status !== "active") {
      throw new Error(`Session ${input.sessionId} is completed.`);
    }
    if (session.aiControlledPlayers.includes(input.playerId)) {
      throw new Error(`Player ${input.playerId} is AI-controlled for this session.`);
    }

    const turn: PlaySessionTurn = {
      id: crypto.randomUUID(),
      playerId: input.playerId,
      action: input.action,
      reasoning: input.reasoning,
      controlMode: "manual",
      timestamp: new Date().toISOString(),
    };

    const updated: PlaySession = {
      ...session,
      turns: [...session.turns, turn],
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: { ...state.sessions, [updated.id]: updated },
    }));

    return updated;
  },

  branchSession(input) {
    const session = get().sessions[input.sessionId];
    if (!session) {
      throw new Error(`Play session ${input.sessionId} not found.`);
    }

    const branched: PlaySession = {
      ...session,
      id: crypto.randomUUID(),
      branchLabel: input.branchLabel.trim() || "branch",
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sourceSessionId: session.id,
      turns: [...session.turns],
    };

    set((state) => ({
      sessions: { ...state.sessions, [branched.id]: branched },
      activeSessionId: branched.id,
    }));

    return branched;
  },

  setSessionBranchLabel(input) {
    const session = get().sessions[input.sessionId];
    if (!session) {
      throw new Error(`Play session ${input.sessionId} not found.`);
    }

    const updated: PlaySession = {
      ...session,
      branchLabel: input.branchLabel.trim() || "main",
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: { ...state.sessions, [updated.id]: updated },
    }));

    return updated;
  },

  setSessionStatus(input) {
    const session = get().sessions[input.sessionId];
    if (!session) {
      throw new Error(`Play session ${input.sessionId} not found.`);
    }

    const updated: PlaySession = {
      ...session,
      status: input.status,
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: { ...state.sessions, [updated.id]: updated },
    }));

    return updated;
  },

  setAiControlledPlayers(input) {
    const session = get().sessions[input.sessionId];
    if (!session) {
      throw new Error(`Play session ${input.sessionId} not found.`);
    }

    const updated: PlaySession = {
      ...session,
      aiControlledPlayers: normalizeAiControlledPlayers(input.aiControlledPlayers),
      updatedAt: new Date().toISOString(),
    };

    set((state) => ({
      sessions: { ...state.sessions, [updated.id]: updated },
    }));

    return updated;
  },

  deleteSession(sessionId) {
    const { activeSessionId, sessions } = get();
    const { [sessionId]: _removed, ...remaining } = sessions;
    const willDeleteActive = activeSessionId === sessionId;
    const nextActive = willDeleteActive ? (Object.keys(remaining)[0] ?? null) : activeSessionId;

    set({
      sessions: remaining,
      activeSessionId: nextActive,
    });
  },

  setActiveSession(sessionId) {
    set({ activeSessionId: sessionId });
  },

  replaceSessions(sessions, activeSessionIdOverride) {
    const mapped = Object.fromEntries(
      sessions.map((session) => [session.id, session]),
    ) as Record<string, PlaySession>;
    const currentActive = activeSessionIdOverride ?? get().activeSessionId;
    const activeSessionId =
      currentActive && mapped[currentActive] ? currentActive : sessions[0]?.id ?? null;

    set({
      sessions: mapped,
      activeSessionId,
    });
  },

  reset() {
    set({
      sessions: {},
      activeSessionId: null,
    });
  },
}));

export function usePlayStore<T>(selector: (state: PlayStore) => T): T {
  return useStore(playStore, selector);
}
