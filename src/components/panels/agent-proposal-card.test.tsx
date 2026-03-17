/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithShell } from "@/test-support/render-router";
import { AgentProposalCard } from "./agent-proposal-card";
import type { AgentToolCallEntry } from "@/stores/ai-store";
import { analysisStore } from "@/stores/analysis-store";

// Stub analysisStore.dispatch so tests don't run real engine logic
vi.mock("@/stores/analysis-store", () => ({
  analysisStore: {
    getState: vi.fn(() => ({
      dispatch: vi.fn(),
    })),
  },
}));

function makeToolCall(
  overrides: Partial<AgentToolCallEntry> = {},
): AgentToolCallEntry {
  return {
    id: "tc-proposal-1",
    name: "propose_revision",
    input: {
      entity_type: "Player",
      entity_id: "player-a",
      changes: { name: "Alice" },
      rationale: "Rename player for clarity",
    },
    status: "complete",
    durationMs: 210,
    result: {
      success: true,
      data: {
        proposal_id: "prop-001",
        entity_type: "Player",
        entity_id: "player-a",
        changes: { name: "Alice" },
        rationale: "Rename player for clarity",
        status: "pending",
      },
    },
    ...overrides,
  };
}

describe("AgentProposalCard", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("renders entity type, entity id, rationale, and action buttons", async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={makeToolCall()}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Proposed revision")).toBeDefined();
      expect(screen.getByText("Player")).toBeDefined();
      expect(screen.getByText("player-a")).toBeDefined();
      expect(screen.getByText("Rename player for clarity")).toBeDefined();
      expect(screen.getByText("Accept")).toBeDefined();
      expect(screen.getByText("Reject")).toBeDefined();
    });

    shell.unmount();
  });

  it("Accept button calls onAccept and transitions to accepted state", async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={makeToolCall()}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Accept")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeDefined();
    });

    expect(onAccept).toHaveBeenCalledOnce();
    expect(onAccept).toHaveBeenCalledWith(
      expect.objectContaining({
        proposal_id: "prop-001",
        entity_type: "Player",
      }),
    );
    // Action buttons should be gone after acceptance
    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();

    shell.unmount();
  });

  it("Accept button dispatches _commands from the tool result", async () => {
    const mockDispatch = vi.fn();
    vi.mocked(analysisStore.getState).mockReturnValue({
      dispatch: mockDispatch,
    } as unknown as ReturnType<typeof analysisStore.getState>);

    const commands = [{ type: "SET_PLAYER_NAME", payload: { name: "Alice" } }];
    const toolCallWithCommands = makeToolCall({
      result: {
        success: true,
        _commands: commands,
        data: {
          proposal_id: "prop-002",
          entity_type: "Player",
          entity_id: "player-b",
          changes: { name: "Alice" },
          rationale: "Rename",
          status: "pending",
        },
      },
    });

    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={toolCallWithCommands}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Accept")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => {
      expect(screen.getByText("Accepted")).toBeDefined();
    });

    expect(mockDispatch).toHaveBeenCalledWith(commands[0]);

    shell.unmount();
  });

  it("Reject button shows rejection input and transitions to rejected state on confirm", async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();

    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={makeToolCall()}
        onAccept={onAccept}
        onReject={onReject}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Reject")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Reject"));

    await waitFor(() => {
      expect(screen.getByLabelText("Rejection reason")).toBeDefined();
      expect(screen.getByText("Confirm rejection")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Confirm rejection"));

    await waitFor(() => {
      expect(screen.getByText("Rejected")).toBeDefined();
    });

    expect(onReject).toHaveBeenCalledOnce();
    expect(onAccept).not.toHaveBeenCalled();
    // Buttons gone after rejection
    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();

    shell.unmount();
  });

  it("buttons are absent after acceptance", async () => {
    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={makeToolCall()}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Accept")).toBeDefined());

    fireEvent.click(screen.getByText("Accept"));

    await waitFor(() => expect(screen.getByText("Accepted")).toBeDefined());

    expect(screen.queryByText("Accept")).toBeNull();
    expect(screen.queryByText("Reject")).toBeNull();

    shell.unmount();
  });

  it("renders fallback when result data is malformed", async () => {
    const badToolCall = makeToolCall({
      result: { success: false },
    });

    const shell = renderWithShell(
      <AgentProposalCard
        toolCall={badToolCall}
        onAccept={vi.fn()}
        onReject={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("propose_revision")).toBeDefined();
    });

    expect(screen.queryByText("Accept")).toBeNull();
    shell.unmount();
  });
});
