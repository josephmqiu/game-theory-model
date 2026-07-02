import { describe, expect, it } from "vitest";
import {
  initialScrollState,
  isAtLiveEdge,
  resolveLifecycle,
  scrollReducer,
  type ChatLifecycle,
  type ScrollEvent,
  type ScrollState,
} from "@/components/panels/scroll-state";

function reduce(events: ScrollEvent[], state: ScrollState = initialScrollState) {
  return events.reduce(scrollReducer, state);
}

describe("scroll-state reducer", () => {
  it.each([
    "USER_SCROLL_UP",
    "TEXT_SELECTION",
    "POINTER_DOWN_IN_TRANSCRIPT",
    "LINK_OPEN",
    "SEARCH_FOCUS",
  ] as const)("%s transfers ownership to READING", (type) => {
    expect(scrollReducer(initialScrollState, { type }).mode).toBe("READING");
  });

  it("uses the 24px live-edge threshold", () => {
    expect(isAtLiveEdge(24)).toBe(true);
    expect(isAtLiveEdge(25)).toBe(false);
  });

  it("tracks unread messages only while READING and clears on follow", () => {
    const followingAppend = scrollReducer(initialScrollState, {
      type: "MESSAGE_APPENDED",
      messageId: "m1",
    });
    expect(followingAppend.unreadCount).toBe(0);

    const reading = reduce([
      { type: "USER_SCROLL_UP" },
      { type: "MESSAGE_APPENDED", messageId: "m2" },
      { type: "MESSAGE_APPENDED", messageId: "m3" },
    ]);
    expect(reading.mode).toBe("READING");
    expect(reading.unreadCount).toBe(2);
    expect(reading.firstUnreadMessageId).toBe("m2");

    const reached = scrollReducer(reading, { type: "REACHED_LIVE_EDGE" });
    expect(reached.mode).toBe("FOLLOWING");
    expect(reached.unreadCount).toBe(0);
    expect(reached.firstUnreadMessageId).toBeUndefined();
  });

  it("jumps through RETURNING and completes into FOLLOWING", () => {
    const returning = reduce([
      { type: "USER_SCROLL_UP" },
      { type: "MESSAGE_APPENDED", messageId: "m1" },
      { type: "JUMP_TO_LATEST" },
    ]);

    expect(returning.mode).toBe("RETURNING");
    expect(returning.unreadCount).toBe(0);

    expect(scrollReducer(returning, { type: "RETURN_COMPLETED" }).mode).toBe(
      "FOLLOWING",
    );
  });

  it("drops stale run ids and non-increasing seq values for the same run", () => {
    const started = scrollReducer(initialScrollState, {
      type: "RUN_STARTED",
      runId: "run-1",
    });
    expect(started.activeRunId).toBe("run-1");
    expect(started.lastSeq).toBe(0);

    const first = scrollReducer(started, {
      type: "USER_SCROLL_UP",
      runId: "run-1",
      seq: 1,
    });
    expect(first.mode).toBe("READING");
    expect(first.lastSeq).toBe(1);

    const staleSeq = scrollReducer(first, {
      type: "JUMP_TO_LATEST",
      runId: "run-1",
      seq: 1,
    });
    expect(staleSeq).toBe(first);

    const staleRun = scrollReducer(first, {
      type: "JUMP_TO_LATEST",
      runId: "run-2",
      seq: 2,
    });
    expect(staleRun).toBe(first);

    const fresh = scrollReducer(first, {
      type: "JUMP_TO_LATEST",
      runId: "run-1",
      seq: 2,
    });
    expect(fresh.mode).toBe("RETURNING");
    expect(fresh.lastSeq).toBe(2);
  });

  it("resets run seq tracking when a new run starts", () => {
    const state = reduce([
      { type: "RUN_STARTED", runId: "run-1" },
      { type: "USER_SCROLL_UP", runId: "run-1", seq: 4 },
      { type: "RUN_STARTED", runId: "run-2" },
    ]);

    expect(state.activeRunId).toBe("run-2");
    expect(state.lastSeq).toBe(0);
    expect(state.lifecycle).toBe("streaming");
  });

  it("records abort cause as reducer data", () => {
    const userStop = scrollReducer(initialScrollState, {
      type: "ABORTED",
      cause: "user-stop",
    });
    expect(userStop.lifecycle).toBe("aborted");
    expect(userStop.abortCause).toBe("user-stop");

    const errorAbort = scrollReducer(initialScrollState, {
      type: "ABORTED",
      cause: "error",
    });
    expect(errorAbort.lifecycle).toBe("errored");
    expect(errorAbort.abortCause).toBe("error");
  });

  it("resolves lifecycle precedence", () => {
    const precedence: Array<[Partial<Record<ChatLifecycle, boolean>>, ChatLifecycle]> = [
      [{ idle: true }, "idle"],
      [{ streaming: true, idle: true }, "streaming"],
      [{ "session-expired": true, streaming: true }, "session-expired"],
      [{ reconnecting: true, "session-expired": true }, "reconnecting"],
      [{ aborted: true, reconnecting: true }, "aborted"],
      [{ errored: true, aborted: true }, "errored"],
      [{}, "idle"],
    ];

    for (const [input, expected] of precedence) {
      expect(resolveLifecycle(input)).toBe(expected);
    }
  });
});
