import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EXPIRY_MS,
  MAX_CHAT_SESSIONS,
  _resetForTest,
  beginTurn,
  endAllSessions,
  endSession,
  endTurn,
  getOrCreateSession,
  getSession,
  touch,
} from "../chat-sessions";

describe("chat-sessions", () => {
  beforeEach(() => {
    _resetForTest();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-02T00:00:00.000Z"));
  });

  afterEach(() => {
    _resetForTest();
    vi.useRealTimers();
  });

  it("creates and reuses a session by key and provider", () => {
    const first = getOrCreateSession("analysis-1", "anthropic");
    const second = getOrCreateSession("analysis-1", "anthropic");

    expect(first.created).toBe(true);
    expect(first.expired).toBe(false);
    expect(second.created).toBe(false);
    expect(second.session).toBe(first.session);
  });

  it("expires idle sessions lazily on access", () => {
    const first = getOrCreateSession("analysis-1", "anthropic");
    first.session.claudeSessionId = "claude-session-1";

    vi.advanceTimersByTime(EXPIRY_MS + 1);

    const second = getOrCreateSession("analysis-1", "anthropic");
    expect(second.expired).toBe(true);
    expect(second.created).toBe(true);
    expect(second.session).not.toBe(first.session);
    expect(second.session.claudeSessionId).toBeUndefined();
  });

  it("switches providers by ending the old session", () => {
    const first = getOrCreateSession("analysis-1", "anthropic");
    first.session.claudeSessionId = "claude-session-1";

    const second = getOrCreateSession("analysis-1", "openai");

    expect(second.providerChanged).toBe(true);
    expect(second.created).toBe(true);
    expect(second.session.provider).toBe("openai");
    expect(second.session.claudeSessionId).toBeUndefined();
  });

  it("touch updates last activity for an active session", () => {
    const first = getOrCreateSession("analysis-1", "anthropic");
    const originalLastActivityAt = first.session.lastActivityAt;

    vi.advanceTimersByTime(1000);
    const touched = touch("analysis-1");

    expect(touched.expired).toBe(false);
    expect(touched.session?.lastActivityAt).toBeGreaterThan(
      originalLastActivityAt,
    );
  });

  it("serializes active turns per session key", () => {
    const first = beginTurn("analysis-1", "anthropic");
    expect(first.started).toBe(true);
    expect(first.session.activeTurn).toBe(true);

    const concurrent = beginTurn("analysis-1", "anthropic");
    expect(concurrent.started).toBe(false);
    expect(concurrent.session).toBe(first.session);

    endTurn("analysis-1");

    const next = beginTurn("analysis-1", "anthropic");
    expect(next.started).toBe(true);
    expect(next.session).toBe(first.session);
  });

  it("allows a new turn when a stale active turn has expired", () => {
    const first = beginTurn("analysis-1", "anthropic");
    expect(first.started).toBe(true);
    expect(first.session.activeTurn).toBe(true);

    vi.advanceTimersByTime(EXPIRY_MS + 1);

    const next = beginTurn("analysis-1", "anthropic");
    expect(next.started).toBe(true);
    expect(next.expired).toBe(true);
    expect(next.session).not.toBe(first.session);
    expect(next.session.activeTurn).toBe(true);
  });

  it("caps sessions and evicts the oldest by last activity", () => {
    for (let index = 0; index < MAX_CHAT_SESSIONS + 1; index += 1) {
      getOrCreateSession(`analysis-${index}`, "anthropic");
      vi.advanceTimersByTime(1);
    }

    expect(getSession("analysis-0").session).toBeNull();
    expect(getSession(`analysis-${MAX_CHAT_SESSIONS}`).session).not.toBeNull();
  });

  it("reports and drops an expired session from getSession", () => {
    getOrCreateSession("analysis-1", "anthropic");
    vi.advanceTimersByTime(EXPIRY_MS + 1);

    expect(getSession("analysis-1")).toEqual({
      session: null,
      expired: true,
    });
    expect(getSession("analysis-1")).toEqual({
      session: null,
      expired: false,
    });
  });

  it("ends one session or all sessions explicitly", () => {
    getOrCreateSession("analysis-1", "anthropic");
    getOrCreateSession("analysis-2", "openai");

    expect(endSession("analysis-1")).toBe(true);
    expect(getSession("analysis-1").session).toBeNull();
    expect(getSession("analysis-2").session?.provider).toBe("openai");

    endAllSessions();
    expect(getSession("analysis-2").session).toBeNull();
  });
});
