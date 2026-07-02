export type ChatSessionProvider = "anthropic" | "openai";

export interface ChatSession {
  key: string;
  provider: ChatSessionProvider;
  claudeSessionId?: string;
  codexThreadId?: string;
  activeTurn?: boolean;
  createdAt: number;
  lastActivityAt: number;
}

export const EXPIRY_MS = 30 * 60 * 1000;

interface SessionAccessResult {
  session: ChatSession | null;
  expired: boolean;
}

interface GetOrCreateSessionResult {
  session: ChatSession;
  created: boolean;
  expired: boolean;
  providerChanged: boolean;
}

type BeginTurnResult =
  | ({
      started: true;
    } & GetOrCreateSessionResult)
  | {
      started: false;
      session: ChatSession;
      created: false;
      expired: false;
      providerChanged: false;
    };

const sessions = new Map<string, ChatSession>();

function isExpired(session: ChatSession, now = Date.now()): boolean {
  return now - session.lastActivityAt > EXPIRY_MS;
}

function createSession(key: string, provider: ChatSessionProvider): ChatSession {
  const now = Date.now();
  return {
    key,
    provider,
    createdAt: now,
    lastActivityAt: now,
  };
}

export function getOrCreateSession(
  key: string,
  provider: ChatSessionProvider,
): GetOrCreateSessionResult {
  const existing = sessions.get(key);
  if (!existing) {
    const session = createSession(key, provider);
    sessions.set(key, session);
    return {
      session,
      created: true,
      expired: false,
      providerChanged: false,
    };
  }

  if (isExpired(existing)) {
    sessions.delete(key);
    const session = createSession(key, provider);
    sessions.set(key, session);
    return {
      session,
      created: true,
      expired: true,
      providerChanged: false,
    };
  }

  if (existing.provider !== provider) {
    sessions.delete(key);
    const session = createSession(key, provider);
    sessions.set(key, session);
    return {
      session,
      created: true,
      expired: false,
      providerChanged: true,
    };
  }

  existing.lastActivityAt = Date.now();
  return {
    session: existing,
    created: false,
    expired: false,
    providerChanged: false,
  };
}

export function beginTurn(
  key: string,
  provider: ChatSessionProvider,
): BeginTurnResult {
  const existing = sessions.get(key);
  if (existing?.activeTurn) {
    return {
      started: false,
      session: existing,
      created: false,
      expired: false,
      providerChanged: false,
    };
  }

  const result = getOrCreateSession(key, provider);
  result.session.activeTurn = true;
  return { started: true, ...result };
}

export function markTurnActive(key: string): SessionAccessResult {
  const result = getSession(key);
  if (result.session) {
    result.session.activeTurn = true;
  }
  return result;
}

export function endTurn(key: string): SessionAccessResult {
  const result = getSession(key);
  if (result.session) {
    result.session.activeTurn = false;
  }
  return result;
}

export function getSession(key: string): SessionAccessResult {
  const session = sessions.get(key);
  if (!session) {
    return { session: null, expired: false };
  }

  if (isExpired(session)) {
    sessions.delete(key);
    return { session: null, expired: true };
  }

  return { session, expired: false };
}

export function touch(key: string): SessionAccessResult {
  const result = getSession(key);
  if (result.session) {
    result.session.lastActivityAt = Date.now();
  }
  return result;
}

export function endSession(key: string): boolean {
  return sessions.delete(key);
}

export function endAllSessions(): void {
  sessions.clear();
}

export function _resetForTest(): void {
  sessions.clear();
}
