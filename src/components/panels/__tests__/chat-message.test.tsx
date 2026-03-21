// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ChatMessage from "@/components/panels/chat-message";

describe("ChatMessage assistant markdown rendering", () => {
  it("renders headings and bold text as markdown for assistant messages", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={"## Findings\n\n**Bold** callout"}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Findings", level: 2 }),
    ).toBeTruthy();
    expect(container.querySelector("strong")?.textContent).toBe("Bold");
    expect(container.textContent).not.toContain("## Findings");
    expect(container.textContent).not.toContain("**Bold**");
  });

  it("renders GFM lists, horizontal rules, and tables structurally", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={
          "- Rock\n- Paper\n\n---\n\n| Move | Beats |\n| --- | --- |\n| Rock | Scissors |"
        }
      />,
    );

    expect(container.querySelector("ul")).toBeTruthy();
    expect(container.querySelector("hr")).toBeTruthy();
    expect(container.querySelector("table")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    expect(container.textContent).not.toContain("| Move | Beats |");
  });

  it("renders fenced code through the custom code block UI", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={"```ts\nconst winner = 'rock'\n```"}
      />,
    );

    expect(screen.getByTitle("Copy code")).toBeTruthy();
    expect(container.querySelector("pre code")?.textContent).toContain(
      "const winner = 'rock'",
    );
    expect(container.textContent).not.toContain("```ts");
  });

  it("keeps design JSON blocks on the existing expandable path", () => {
    render(
      <ChatMessage
        role="assistant"
        content={'```json\n{"id":"node-1","type":"frame"}\n```'}
        onApplyDesign={() => undefined}
      />,
    );

    expect(screen.getByText("1 design element")).toBeTruthy();
    expect(screen.getByText("Apply to Canvas")).toBeTruthy();
  });

  it("renders an unfinished streaming design block without raw backticks", () => {
    const { container } = render(
      <ChatMessage
        role="assistant"
        content={'```json\n{"id":"node-1","type":"frame"}'}
        isStreaming
        onApplyDesign={() => undefined}
      />,
    );

    expect(screen.getByText("Generating design...")).toBeTruthy();
    expect(container.textContent).not.toContain("```json");
  });

  it("keeps user messages as plain text", () => {
    const rawContent = "## Heading\n\n**Bold**";
    const { container } = render(
      <ChatMessage role="user" content={rawContent} />,
    );

    expect(screen.queryByRole("heading", { name: "Heading" })).toBeNull();
    expect(container.textContent).toContain("## Heading");
    expect(container.textContent).toContain("**Bold**");
  });
});
