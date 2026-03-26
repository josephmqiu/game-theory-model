// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { screen, fireEvent } from "@testing-library/dom";
import { describe, expect, it, vi, afterEach, beforeAll } from "vitest";
import { QuestionCard } from "@/components/panels/question-card";
import type { UserInputQuestion } from "../../../../shared/types/user-input";

// Use createRoot directly instead of @testing-library/react's render to avoid
// the dual-React-instance issue in this project's vitest + React 19 setup.

beforeAll(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function renderComponent(ui: React.ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(ui);
  });
  return { container };
}

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
    root = null;
  }
  if (container) {
    document.body.removeChild(container);
    container = null;
  }
});

function makeQuestion(
  overrides: Partial<UserInputQuestion> = {},
): UserInputQuestion {
  return {
    id: "q-1",
    threadId: "thread-1",
    header: "Actor Identification",
    question: "Who are the primary actors?",
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("QuestionCard", () => {
  it("renders the question header and text when pending", () => {
    renderComponent(
      <QuestionCard
        question={makeQuestion()}
        questionIndex={0}
        totalQuestions={1}
        isPending={true}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText(/Actor Identification/)).toBeTruthy();
    expect(screen.getByText("Who are the primary actors?")).toBeTruthy();
  });

  it("renders option buttons when options are provided", () => {
    const question = makeQuestion({
      options: [
        { label: "Option A", description: "First option" },
        { label: "Option B" },
      ],
    });

    renderComponent(
      <QuestionCard
        question={question}
        questionIndex={0}
        totalQuestions={1}
        isPending={true}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("Option A")).toBeTruthy();
    expect(screen.getByText("First option")).toBeTruthy();
    expect(screen.getByText("Option B")).toBeTruthy();
  });

  it("calls onResolve with selectedOptions when an option is clicked", () => {
    const onResolve = vi.fn();
    const question = makeQuestion({
      options: [{ label: "Option A" }, { label: "Option B" }],
    });

    renderComponent(
      <QuestionCard
        question={question}
        questionIndex={0}
        totalQuestions={1}
        isPending={true}
        onResolve={onResolve}
      />,
    );

    fireEvent.click(screen.getByText("Option B"));

    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith("q-1", { selectedOptions: [1] });
  });

  it("shows free-text input and calls onResolve with customText on submit", () => {
    const onResolve = vi.fn();

    renderComponent(
      <QuestionCard
        question={makeQuestion()}
        questionIndex={0}
        totalQuestions={1}
        isPending={true}
        onResolve={onResolve}
      />,
    );

    const input = screen.getByPlaceholderText("Type your answer...");
    expect(input).toBeTruthy();

    act(() => {
      fireEvent.change(input, { target: { value: "My custom answer" } });
    });

    act(() => {
      fireEvent.click(screen.getByText("Submit"));
    });

    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith("q-1", {
      customText: "My custom answer",
    });
  });

  it("renders resolved state with answer text when isPending is false and resolvedAnswer is set", () => {
    renderComponent(
      <QuestionCard
        question={makeQuestion()}
        questionIndex={0}
        totalQuestions={1}
        isPending={false}
        resolvedAnswer="The government and opposition"
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText("A: The government and opposition")).toBeTruthy();
    expect(screen.getByText(/Q: Who are the primary actors\?/)).toBeTruthy();
  });

  it("does not render option buttons when no options provided", () => {
    const { container: el } = renderComponent(
      <QuestionCard
        question={makeQuestion()}
        questionIndex={0}
        totalQuestions={1}
        isPending={true}
        onResolve={vi.fn()}
      />,
    );

    // With no options, the only button should be the Submit button.
    const buttons = el!.querySelectorAll("button");
    expect(buttons.length).toBe(1);
    expect(buttons[0].textContent).toBe("Submit");
  });

  it('shows "Question X of Y" header when totalQuestions > 1', () => {
    renderComponent(
      <QuestionCard
        question={makeQuestion()}
        questionIndex={2}
        totalQuestions={5}
        isPending={true}
        onResolve={vi.fn()}
      />,
    );

    expect(screen.getByText(/3 of 5/)).toBeTruthy();
  });
});
