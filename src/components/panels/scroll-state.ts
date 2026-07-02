type ScrollMode = "FOLLOWING" | "READING" | "RETURNING";

export type ChatLifecycle =
  | "idle"
  | "streaming"
  | "reconnecting"
  | "aborted"
  | "errored"
  | "session-expired";

type AbortCause = "user-stop" | "error";

export interface ScrollState {
  mode: ScrollMode;
  activeRunId?: string;
  lastSeq: number;
  unreadCount: number;
  firstUnreadMessageId?: string;
  lifecycle: ChatLifecycle;
  abortCause?: AbortCause;
}

type SequencedEvent = {
  runId?: string;
  seq?: number;
};

export type ScrollEvent =
  | ({ type: "RUN_STARTED"; runId: string } & SequencedEvent)
  | ({ type: "USER_SCROLL_UP" } & SequencedEvent)
  | ({ type: "TEXT_SELECTION" } & SequencedEvent)
  | ({ type: "POINTER_DOWN_IN_TRANSCRIPT" } & SequencedEvent)
  | ({ type: "LINK_OPEN" } & SequencedEvent)
  | ({ type: "SEARCH_FOCUS" } & SequencedEvent)
  | ({ type: "REACHED_LIVE_EDGE" } & SequencedEvent)
  | ({ type: "LEFT_LIVE_EDGE" } & SequencedEvent)
  | ({ type: "JUMP_TO_LATEST" } & SequencedEvent)
  | ({ type: "RETURN_COMPLETED" } & SequencedEvent)
  | ({ type: "MESSAGE_APPENDED"; messageId?: string } & SequencedEvent)
  | ({ type: "STREAM_STARTED" } & SequencedEvent)
  | ({ type: "STREAM_COMPLETED" } & SequencedEvent)
  | ({ type: "RECONNECTING" } & SequencedEvent)
  | ({ type: "RECONNECTED" } & SequencedEvent)
  | ({ type: "ABORTED"; cause: AbortCause } & SequencedEvent)
  | ({ type: "ERRORED" } & SequencedEvent)
  | ({ type: "SESSION_EXPIRED" } & SequencedEvent)
  | ({ type: "RESET_LIFECYCLE" } & SequencedEvent);

export const initialScrollState: ScrollState = {
  mode: "FOLLOWING",
  lastSeq: 0,
  unreadCount: 0,
  lifecycle: "idle",
};

const readingEvents = new Set<ScrollEvent["type"]>([
  "USER_SCROLL_UP",
  "TEXT_SELECTION",
  "POINTER_DOWN_IN_TRANSCRIPT",
  "LINK_OPEN",
  "SEARCH_FOCUS",
]);

const lifecyclePrecedence: ChatLifecycle[] = [
  "errored",
  "aborted",
  "reconnecting",
  "session-expired",
  "streaming",
  "idle",
];

export function isAtLiveEdge(distanceToBottomPx: number): boolean {
  return distanceToBottomPx <= 24;
}

export function resolveLifecycle(
  candidates: Partial<Record<ChatLifecycle, boolean>>,
): ChatLifecycle {
  return (
    lifecyclePrecedence.find((lifecycle) => candidates[lifecycle]) ?? "idle"
  );
}

function isStaleEvent(state: ScrollState, event: ScrollEvent): boolean {
  if (
    event.type !== "RUN_STARTED" &&
    event.runId &&
    state.activeRunId &&
    event.runId !== state.activeRunId
  ) {
    return true;
  }

  if (
    typeof event.seq === "number" &&
    event.runId &&
    event.runId === state.activeRunId &&
    event.seq <= state.lastSeq
  ) {
    return true;
  }

  return false;
}

function withSeq(state: ScrollState, event: ScrollEvent): ScrollState {
  if (
    typeof event.seq === "number" &&
    event.runId &&
    event.runId === state.activeRunId
  ) {
    return { ...state, lastSeq: event.seq };
  }
  return state;
}

function follow(state: ScrollState): ScrollState {
  return {
    ...state,
    mode: "FOLLOWING",
    unreadCount: 0,
    firstUnreadMessageId: undefined,
  };
}

export function scrollReducer(
  currentState: ScrollState,
  event: ScrollEvent,
): ScrollState {
  if (event.type === "RUN_STARTED") {
    return {
      ...currentState,
      activeRunId: event.runId,
      lastSeq: typeof event.seq === "number" ? event.seq : 0,
      lifecycle: "streaming",
      abortCause: undefined,
    };
  }

  if (isStaleEvent(currentState, event)) {
    return currentState;
  }

  const state = withSeq(currentState, event);

  if (readingEvents.has(event.type)) {
    return { ...state, mode: "READING" };
  }

  switch (event.type) {
    case "REACHED_LIVE_EDGE":
      return follow(state);
    case "LEFT_LIVE_EDGE":
      return state;
    case "JUMP_TO_LATEST":
      return {
        ...state,
        mode: "RETURNING",
        unreadCount: 0,
        firstUnreadMessageId: undefined,
      };
    case "RETURN_COMPLETED":
      return follow(state);
    case "MESSAGE_APPENDED":
      if (state.mode !== "READING") {
        return {
          ...state,
          unreadCount: 0,
          firstUnreadMessageId: undefined,
        };
      }
      return {
        ...state,
        unreadCount: state.unreadCount + 1,
        firstUnreadMessageId:
          state.firstUnreadMessageId ?? event.messageId ?? undefined,
      };
    case "STREAM_STARTED":
      return {
        ...state,
        lifecycle: "streaming",
        abortCause: undefined,
      };
    case "STREAM_COMPLETED":
      return { ...state, lifecycle: "idle", abortCause: undefined };
    case "RECONNECTING":
      return { ...state, lifecycle: "reconnecting" };
    case "RECONNECTED":
      return {
        ...state,
        lifecycle:
          state.lifecycle === "reconnecting" ? "streaming" : state.lifecycle,
      };
    case "ABORTED":
      return {
        ...state,
        lifecycle: event.cause === "error" ? "errored" : "aborted",
        abortCause: event.cause,
      };
    case "ERRORED":
      return { ...state, lifecycle: "errored", abortCause: "error" };
    case "SESSION_EXPIRED":
      return {
        ...state,
        lifecycle: resolveLifecycle({
          [state.lifecycle]: true,
          "session-expired": true,
        }),
      };
    case "RESET_LIFECYCLE":
      return { ...state, lifecycle: "idle", abortCause: undefined };
    default:
      return state;
  }
}
