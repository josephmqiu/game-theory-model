// @vitest-environment jsdom

import { StrictMode, useRef } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useScrollEngine,
  type ScrollEngineMessage,
} from "@/components/panels/use-scroll-engine";

type IntersectionCallback = (
  entries: IntersectionObserverEntry[],
  observer: IntersectionObserver,
) => void;

const intersectionObservers: MockIntersectionObserver[] = [];
const resizeObservers: MockResizeObserver[] = [];

class MockIntersectionObserver {
  readonly callback: IntersectionCallback;
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor(callback: IntersectionCallback) {
    this.callback = callback;
    intersectionObservers.push(this);
  }

  observe = (target: Element) => {
    this.targets.add(target);
  };

  unobserve = (target: Element) => {
    this.targets.delete(target);
  };

  disconnect = () => {
    this.disconnected = true;
    this.targets.clear();
  };

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

class MockResizeObserver {
  readonly targets = new Set<Element>();
  disconnected = false;

  constructor() {
    resizeObservers.push(this);
  }

  observe = (target: Element) => {
    this.targets.add(target);
  };

  unobserve = (target: Element) => {
    this.targets.delete(target);
  };

  disconnect = () => {
    this.disconnected = true;
    this.targets.clear();
  };
}

function defineScrollMetrics(element: HTMLElement) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: 300,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: 900,
  });
}

function Harness({ messages }: { messages: ScrollEngineMessage[] }) {
  const engine = useScrollEngine({ messages });
  return (
    <>
      <div data-testid="mode">{engine.state.mode}</div>
      <button type="button" onClick={engine.jumpToLatest}>
        Jump
      </button>
      <div ref={engine.scrollContainerRef} data-testid="container">
        <div ref={engine.messageListRef}>
          {messages.map((message) => (
            <article
              key={message.id}
              ref={engine.setMessageRef(message.id)}
              data-testid={message.id}
            >
              {message.id}
            </article>
          ))}
          <div ref={engine.bottomSentinelRef} data-testid="sentinel" />
        </div>
      </div>
    </>
  );
}

function AnchorHarness() {
  const engine = useScrollEngine({
    messages: [
      { id: "m1", role: "assistant" },
      { id: "m2", role: "assistant" },
    ],
  });
  const anchorRef = useRef<ReturnType<typeof engine.captureAnchor>>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          anchorRef.current = engine.captureAnchor();
        }}
      >
        Capture
      </button>
      <button
        type="button"
        onClick={() => engine.restoreAnchor(anchorRef.current)}
      >
        Restore
      </button>
      <div ref={engine.scrollContainerRef} data-testid="container">
        <div ref={engine.messageListRef}>
          <article ref={engine.setMessageRef("m1")} data-testid="m1">
            m1
          </article>
          <article ref={engine.setMessageRef("m2")} data-testid="m2">
            m2
          </article>
          <div ref={engine.bottomSentinelRef} />
        </div>
      </div>
    </>
  );
}

describe("useScrollEngine", () => {
  beforeEach(() => {
    intersectionObservers.length = 0;
    resizeObservers.length = 0;
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("cleans up observer wiring under StrictMode double mount", () => {
    render(
      <StrictMode>
        <Harness messages={[{ id: "m1", role: "assistant" }]} />
      </StrictMode>,
    );

    const activeIntersectionObservers = intersectionObservers.filter(
      (observer) => !observer.disconnected && observer.targets.size > 0,
    );
    const activeResizeObservers = resizeObservers.filter(
      (observer) => !observer.disconnected && observer.targets.size > 0,
    );

    expect(activeIntersectionObservers).toHaveLength(1);
    expect(activeResizeObservers).toHaveLength(1);

    activeIntersectionObservers[0].trigger(false);
    expect(screen.getByTestId("mode").textContent).toBe("FOLLOWING");
  });

  it("restores the captured topmost intersecting message anchor with a signed offset", () => {
    render(<AnchorHarness />);

    const container = screen.getByTestId("container");
    const m1 = screen.getByTestId("m1");
    const m2 = screen.getByTestId("m2");
    defineScrollMetrics(container);
    container.scrollTop = 100;

    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300 } as DOMRect);
    let m1Top = -10;
    m1.getBoundingClientRect = () =>
      ({ top: m1Top, bottom: m1Top + 20 } as DOMRect);
    let m2Top = 40;
    m2.getBoundingClientRect = () =>
      ({ top: m2Top, bottom: m2Top + 60 } as DOMRect);

    fireEvent.click(screen.getByText("Capture"));
    m1Top = 5;
    m2Top = 55;
    fireEvent.click(screen.getByText("Restore"));

    expect(container.scrollTop).toBe(115);
  });

  it("captures a message taller than the viewport when it intersects the top", () => {
    render(<AnchorHarness />);

    const container = screen.getByTestId("container");
    const m1 = screen.getByTestId("m1");
    const m2 = screen.getByTestId("m2");
    defineScrollMetrics(container);
    container.scrollTop = 100;

    container.getBoundingClientRect = () =>
      ({ top: 0, bottom: 300 } as DOMRect);
    let m1Top = -120;
    m1.getBoundingClientRect = () =>
      ({ top: m1Top, bottom: m1Top + 520 } as DOMRect);
    m2.getBoundingClientRect = () => ({ top: 430, bottom: 490 } as DOMRect);

    fireEvent.click(screen.getByText("Capture"));
    m1Top = -80;
    fireEvent.click(screen.getByText("Restore"));

    expect(container.scrollTop).toBe(140);
  });

  it("does not hard-assign scrollTop when returning with smooth scroll", async () => {
    const scrollTo = vi.fn();
    Element.prototype.scrollTo = scrollTo;
    render(<Harness messages={[{ id: "m1", role: "assistant" }]} />);

    const container = screen.getByTestId("container");
    defineScrollMetrics(container);
    container.scrollTop = 0;

    fireEvent.wheel(container, { deltaY: -40 });
    await act(async () => {
      fireEvent.click(screen.getByText("Jump"));
    });

    expect(scrollTo).toHaveBeenCalledWith({ top: 600, behavior: "smooth" });
    expect(container.scrollTop).toBe(0);
  });
});
