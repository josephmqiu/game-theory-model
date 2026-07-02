import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
  type RefCallback,
} from "react";
import {
  initialScrollState,
  isAtLiveEdge,
  scrollReducer,
  type ScrollEvent,
  type ScrollState,
} from "./scroll-state";

export interface ScrollEngineMessage {
  id: string;
  role?: "user" | "assistant";
}

interface ScrollAnchor {
  messageId: string;
  offsetWithinMessage: number;
}

interface PendingMessageAnchor {
  messageId: string;
  viewportRatio: number;
}

interface SequencedEventFields {
  runId: string;
  seq: number;
}

export interface UseScrollEngineResult {
  state: ScrollState;
  dispatch: (event: ScrollEvent) => void;
  scrollContainerRef: RefCallback<HTMLDivElement>;
  messageListRef: RefCallback<HTMLDivElement>;
  bottomSentinelRef: RefCallback<HTMLDivElement>;
  setMessageRef: (messageId: string) => RefCallback<HTMLElement>;
  captureAnchor: () => ScrollAnchor | null;
  restoreAnchor: (anchor?: ScrollAnchor | null) => void;
  preserveAnchorForNextLayout: () => void;
  requestMessageAnchor: (messageId: string, viewportRatio: number) => void;
  scrollMessageToViewportRatio: (
    messageId: string,
    viewportRatio: number,
  ) => void;
  focusMessage: (messageId: string) => void;
  jumpToLatest: () => void;
  isAtLiveEdgeNow: () => boolean;
  prefersReducedMotion: boolean;
}

function getDistanceToBottom(container: HTMLElement): number {
  return container.scrollHeight - container.scrollTop - container.clientHeight;
}

function setScrollTop(
  container: HTMLElement,
  top: number,
  behavior: ScrollBehavior,
): void {
  if (typeof container.scrollTo === "function") {
    container.scrollTo({ top, behavior });
    if (behavior !== "smooth") {
      container.scrollTop = top;
    }
    return;
  }
  container.scrollTop = top;
}

function isWithin(container: HTMLElement, node: Node | null): boolean {
  return !!node && (node === container || container.contains(node));
}

export function useScrollEngine({
  messages,
  latestAssistantMessageId,
  sequenceStreamEvent,
}: {
  messages: ScrollEngineMessage[];
  latestAssistantMessageId?: string;
  sequenceStreamEvent?: () => SequencedEventFields | undefined;
}): UseScrollEngineResult {
  const [state, reducerDispatch] = useReducer(
    scrollReducer,
    initialScrollState,
  );
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const scrollContainerNodeRef = useRef<HTMLDivElement | null>(null);
  const messageListNodeRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelNodeRef = useRef<HTMLDivElement | null>(null);
  const messageNodeRefs = useRef(new Map<string, HTMLElement>());
  const stateRef = useRef(state);
  const anchorRef = useRef<ScrollAnchor | null>(null);
  const pendingRestoreAnchorRef = useRef<ScrollAnchor | null>(null);
  const pendingMessageAnchorRef = useRef<PendingMessageAnchor | null>(null);
  const previousMessageIdsRef = useRef<Set<string> | null>(null);
  const previousScrollTopRef = useRef(0);
  const latestAssistantMessageIdRef = useRef(latestAssistantMessageId);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    latestAssistantMessageIdRef.current = latestAssistantMessageId;
  }, [latestAssistantMessageId]);

  const dispatch = useCallback((event: ScrollEvent) => {
    reducerDispatch(event);
  }, []);

  const scrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerNodeRef.current = node;
    if (node) {
      previousScrollTopRef.current = node.scrollTop;
    }
  }, []);

  const messageListRef = useCallback((node: HTMLDivElement | null) => {
    messageListNodeRef.current = node;
  }, []);

  const bottomSentinelRef = useCallback((node: HTMLDivElement | null) => {
    bottomSentinelNodeRef.current = node;
  }, []);

  const setMessageRef = useCallback(
    (messageId: string): RefCallback<HTMLElement> =>
      (node) => {
        if (node) {
          messageNodeRefs.current.set(messageId, node);
        } else {
          messageNodeRefs.current.delete(messageId);
        }
      },
    [],
  );

  const captureAnchor = useCallback((): ScrollAnchor | null => {
    const container = scrollContainerNodeRef.current;
    if (!container) return null;

    const containerRect = container.getBoundingClientRect();
    const candidates = Array.from(messageNodeRefs.current.entries())
      .map(([messageId, node]) => ({
        messageId,
        node,
        rect: node.getBoundingClientRect(),
      }))
      .filter(({ node, rect }) => {
        if (!container.contains(node)) return false;
        return rect.bottom > containerRect.top && rect.top < containerRect.bottom;
      })
      .sort((a, b) => a.rect.top - b.rect.top);

    const topmost = candidates[0];
    if (!topmost) return null;

    return {
      messageId: topmost.messageId,
      offsetWithinMessage: topmost.rect.top - containerRect.top,
    };
  }, []);

  const restoreAnchor = useCallback((anchor?: ScrollAnchor | null) => {
    const targetAnchor = anchor ?? anchorRef.current;
    const container = scrollContainerNodeRef.current;
    if (!targetAnchor || !container) return;

    const node = messageNodeRefs.current.get(targetAnchor.messageId);
    if (!node || !container.contains(node)) return;

    const containerRect = container.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const delta =
      nodeRect.top - containerRect.top - targetAnchor.offsetWithinMessage;
    if (Math.abs(delta) < 0.5) return;

    container.scrollTop += delta;
  }, []);

  const preserveAnchorForNextLayout = useCallback(() => {
    pendingRestoreAnchorRef.current = captureAnchor();
    anchorRef.current = pendingRestoreAnchorRef.current;
  }, [captureAnchor]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "auto") => {
      const container = scrollContainerNodeRef.current;
      if (!container) return;
      const nextTop = Math.max(0, container.scrollHeight - container.clientHeight);
      setScrollTop(container, nextTop, prefersReducedMotion ? "auto" : behavior);
    },
    [prefersReducedMotion],
  );

  const scrollMessageToViewportRatio = useCallback(
    (messageId: string, viewportRatio: number) => {
      const container = scrollContainerNodeRef.current;
      const node = messageNodeRefs.current.get(messageId);
      if (!container || !node || !container.contains(node)) return;

      const containerRect = container.getBoundingClientRect();
      const nodeRect = node.getBoundingClientRect();
      const nextTop =
        container.scrollTop +
        (nodeRect.top - containerRect.top) -
        container.clientHeight * viewportRatio;
      setScrollTop(container, Math.max(0, nextTop), "auto");
    },
    [],
  );

  const requestMessageAnchor = useCallback(
    (messageId: string, viewportRatio: number) => {
      pendingMessageAnchorRef.current = { messageId, viewportRatio };
      requestAnimationFrame(() => {
        const pending = pendingMessageAnchorRef.current;
        if (!pending || pending.messageId !== messageId) return;
        scrollMessageToViewportRatio(pending.messageId, pending.viewportRatio);
        pendingMessageAnchorRef.current = null;
      });
    },
    [scrollMessageToViewportRatio],
  );

  const focusMessage = useCallback((messageId: string) => {
    messageNodeRefs.current
      .get(messageId)
      ?.focus({ preventScroll: true });
  }, []);

  const focusLatestAssistant = useCallback(() => {
    const latestId = latestAssistantMessageIdRef.current;
    if (!latestId) return;
    focusMessage(latestId);
  }, [focusMessage]);

  const jumpToLatest = useCallback(() => {
    dispatch({ type: "JUMP_TO_LATEST" });
  }, [dispatch]);

  const isAtLiveEdgeNow = useCallback((): boolean => {
    const container = scrollContainerNodeRef.current;
    if (!container) return true;
    return isAtLiveEdge(getDistanceToBottom(container));
  }, []);

  const enterReading = useCallback(
    (event: ScrollEvent) => {
      anchorRef.current = captureAnchor();
      dispatch(event);
    },
    [captureAnchor, dispatch],
  );

  const moveMessageFocus = useCallback((direction: -1 | 1) => {
    const container = scrollContainerNodeRef.current;
    if (!container) return;

    const nodes = Array.from(messageNodeRefs.current.values()).filter((node) =>
      container.contains(node),
    );
    if (nodes.length === 0) return;

    const active = document.activeElement;
    const currentIndex = nodes.findIndex((node) => node === active);
    const fallbackIndex = direction > 0 ? -1 : nodes.length;
    const nextIndex = Math.min(
      nodes.length - 1,
      Math.max(0, (currentIndex >= 0 ? currentIndex : fallbackIndex) + direction),
    );
    nodes[nextIndex]?.focus({ preventScroll: false });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(media.matches);
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    media.addEventListener?.("change", listener);
    return () => media.removeEventListener?.("change", listener);
  }, []);

  useEffect(() => {
    const container = scrollContainerNodeRef.current;
    const sentinel = bottomSentinelNodeRef.current;
    if (!container || !sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        dispatch({
          type: entry.isIntersecting ? "REACHED_LIVE_EDGE" : "LEFT_LIVE_EDGE",
        });
      },
      { root: container, threshold: 1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [dispatch]);

  useEffect(() => {
    const list = messageListNodeRef.current;
    if (!list || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => {
      if (stateRef.current.mode === "READING") {
        const anchor = anchorRef.current ?? captureAnchor();
        requestAnimationFrame(() => restoreAnchor(anchor));
        return;
      }

      if (stateRef.current.mode === "FOLLOWING") {
        requestAnimationFrame(() => scrollToBottom("auto"));
      }
    });

    observer.observe(list);
    return () => observer.disconnect();
  }, [captureAnchor, restoreAnchor, scrollToBottom]);

  useEffect(() => {
    const container = scrollContainerNodeRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.deltaY < 0) {
        enterReading({ type: "USER_SCROLL_UP" });
      }
    };

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      if (scrollTop < previousScrollTopRef.current - 1) {
        enterReading({ type: "USER_SCROLL_UP" });
      }
      previousScrollTopRef.current = scrollTop;

      if (isAtLiveEdge(getDistanceToBottom(container))) {
        dispatch({ type: "REACHED_LIVE_EDGE" });
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a")) {
        enterReading({ type: "LINK_OPEN" });
        return;
      }
      enterReading({ type: "POINTER_DOWN_IN_TRANSCRIPT" });
    };

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("a")) {
        enterReading({ type: "LINK_OPEN" });
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.matches('input[type="search"], [role="searchbox"], [data-search-focus]')
      ) {
        enterReading({ type: "SEARCH_FOCUS" });
      }
    };

    const handleSelection = () => {
      const selection = document.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }
      const range = selection.getRangeAt(0);
      if (
        isWithin(container, range.startContainer) ||
        isWithin(container, range.endContainer)
      ) {
        enterReading({ type: "TEXT_SELECTION" });
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "End" || (event.metaKey && event.key === "ArrowDown")) {
        event.preventDefault();
        jumpToLatest();
        return;
      }

      if (
        event.key === "PageUp" ||
        event.key === "Home" ||
        event.key === "ArrowUp"
      ) {
        enterReading({ type: "USER_SCROLL_UP" });
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        moveMessageFocus(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        moveMessageFocus(1);
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: true });
    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("pointerdown", handlePointerDown);
    container.addEventListener("click", handleClick);
    container.addEventListener("focusin", handleFocusIn);
    container.addEventListener("mouseup", handleSelection);
    container.addEventListener("keyup", handleSelection);
    container.addEventListener("keydown", handleKeyDown);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("pointerdown", handlePointerDown);
      container.removeEventListener("click", handleClick);
      container.removeEventListener("focusin", handleFocusIn);
      container.removeEventListener("mouseup", handleSelection);
      container.removeEventListener("keyup", handleSelection);
      container.removeEventListener("keydown", handleKeyDown);
    };
  }, [dispatch, enterReading, jumpToLatest, moveMessageFocus]);

  useLayoutEffect(() => {
    const previousIds = previousMessageIdsRef.current;
    const nextIds = new Set(messages.map((message) => message.id));
    if (previousIds) {
      for (const message of messages) {
        if (!previousIds.has(message.id)) {
          dispatch({
            type: "MESSAGE_APPENDED",
            messageId: message.id,
            ...sequenceStreamEvent?.(),
          });
        }
      }
    }
    previousMessageIdsRef.current = nextIds;

    const pendingMessageAnchor = pendingMessageAnchorRef.current;
    if (pendingMessageAnchor) {
      scrollMessageToViewportRatio(
        pendingMessageAnchor.messageId,
        pendingMessageAnchor.viewportRatio,
      );
      pendingMessageAnchorRef.current = null;
      return;
    }

    const pendingRestoreAnchor = pendingRestoreAnchorRef.current;
    if (pendingRestoreAnchor) {
      restoreAnchor(pendingRestoreAnchor);
      pendingRestoreAnchorRef.current = null;
      return;
    }

    if (stateRef.current.mode === "READING") {
      restoreAnchor(anchorRef.current);
      return;
    }

    if (stateRef.current.mode === "FOLLOWING" && previousIds) {
      scrollToBottom("auto");
    }
  }, [
    dispatch,
    messages,
    restoreAnchor,
    scrollMessageToViewportRatio,
    scrollToBottom,
    sequenceStreamEvent,
  ]);

  useEffect(() => {
    if (state.mode !== "RETURNING") return;

    scrollToBottom(prefersReducedMotion ? "auto" : "smooth");

    if (prefersReducedMotion) {
      const frame = requestAnimationFrame(() => {
        dispatch({ type: "RETURN_COMPLETED" });
        focusLatestAssistant();
      });
      return () => cancelAnimationFrame(frame);
    }

    const container = scrollContainerNodeRef.current;
    let completed = false;
    const complete = () => {
      if (completed) return;
      completed = true;
      dispatch({ type: "RETURN_COMPLETED" });
      focusLatestAssistant();
    };
    const timeout = window.setTimeout(complete, 300);
    container?.addEventListener("scrollend", complete, { once: true });

    return () => {
      window.clearTimeout(timeout);
      container?.removeEventListener("scrollend", complete);
    };
  }, [dispatch, focusLatestAssistant, prefersReducedMotion, scrollToBottom, state.mode]);

  return {
    state,
    dispatch,
    scrollContainerRef,
    messageListRef,
    bottomSentinelRef,
    setMessageRef,
    captureAnchor,
    restoreAnchor,
    preserveAnchorForNextLayout,
    requestMessageAnchor,
    scrollMessageToViewportRatio,
    focusMessage,
    jumpToLatest,
    isAtLiveEdgeNow,
    prefersReducedMotion,
  };
}
