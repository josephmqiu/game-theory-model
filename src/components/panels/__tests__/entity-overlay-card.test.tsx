// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { AnalysisEntity, ChallengeRecord } from "@/types/entity";
import { useEntityGraphStore } from "@/stores/entity-graph-store";
import { useCanvasStore } from "@/stores/canvas-store";

const updateEntityMock = vi.fn();
const challengeEntityMock = vi.fn();
const getDownstreamEntityIdsMock = vi.fn();
const markChallengeViewedMock = vi.fn();
const isRunningMock = vi.fn();

vi.mock("@/services/ai/analysis-client", () => ({
  updateEntity: (...args: unknown[]) => updateEntityMock(...args),
  challengeEntity: (...args: unknown[]) => challengeEntityMock(...args),
  getDownstreamEntityIds: (...args: unknown[]) =>
    getDownstreamEntityIdsMock(...args),
  markChallengeViewed: (...args: unknown[]) => markChallengeViewedMock(...args),
  isRunning: () => isRunningMock(),
}));

import EntityOverlayCard from "../entity-overlay-card";

function makeFactEntity(
  overrides: Partial<AnalysisEntity> = {},
): AnalysisEntity {
  return {
    id: "entity-1",
    type: "fact",
    phase: "situational-grounding",
    data: {
      type: "fact",
      date: "2026-03-19",
      source: "Reuters",
      content: "Original content",
      category: "action",
    },
    confidence: "high",
    rationale: "Original rationale",
    revision: 1,
    stale: false,
    provenance: { source: "phase-derived", timestamp: 1 },
    ...overrides,
  };
}

function seedStore(entity: AnalysisEntity, challenges: ChallengeRecord[] = []) {
  useEntityGraphStore.setState({
    analysis: {
      id: "a1",
      name: "Test",
      topic: "Test",
      entities: [entity],
      relationships: [],
      phases: [],
      challenges,
    },
  });
}

function renderCard(entity: AnalysisEntity) {
  return render(
    <EntityOverlayCard
      entity={entity}
      screenPosition={{ x: 100, y: 100 }}
      onClose={() => {}}
    />,
  );
}

// RTL auto-cleanup needs vitest globals (off in this repo) — clean explicitly
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.clearAllMocks();
  isRunningMock.mockReturnValue(false);
  getDownstreamEntityIdsMock.mockResolvedValue([]);
  updateEntityMock.mockResolvedValue({ status: "applied" });
  challengeEntityMock.mockResolvedValue({ status: "created" });
  markChallengeViewedMock.mockResolvedValue(undefined);
  useCanvasStore.setState({ viewedRevisionLogNos: {} });
});

describe("edit form (7A single write path + 2.3A state table)", () => {
  it("saves through the server endpoint with only editable fields", async () => {
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    const contentInput = screen.getByDisplayValue("Original content");
    fireEvent.change(contentInput, { target: { value: "Edited content" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(updateEntityMock).toHaveBeenCalledTimes(1));
    expect(updateEntityMock).toHaveBeenCalledWith("entity-1", {
      data: expect.objectContaining({ content: "Edited content" }),
      rationale: "Original rationale",
    });
  });

  it("save failure preserves input, shows field errors, and rolls back the optimistic apply", async () => {
    updateEntityMock.mockResolvedValue({
      status: "error",
      error: "Validation failed",
      fieldErrors: { "data.content": "Content rejected by server" },
    });
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByDisplayValue("Original content"), {
      target: { value: "Bad edit" },
    });
    fireEvent.click(screen.getByText("Save"));

    // Field error renders inline under the input (1.2A anatomy)
    await screen.findByText("Content rejected by server");
    // Preserved input — the form did NOT reset
    expect(screen.getByDisplayValue("Bad edit")).toBeTruthy();
    // Footer error banner
    expect(screen.getByText("Validation failed")).toBeTruthy();
    // Optimistic apply rolled back in the store
    const stored = useEntityGraphStore
      .getState()
      .analysis.entities.find((e) => e.id === "entity-1")!;
    expect((stored.data as { content: string }).content).toBe(
      "Original content",
    );
  });

  it("client-side validation rejects invalid data without a server round-trip", async () => {
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByDisplayValue("action"), {
      target: { value: "not-a-category" },
    });
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("Validation failed");
    expect(updateEntityMock).not.toHaveBeenCalled();
  });

  it("double-submit triggers exactly one server call", async () => {
    let resolveUpdate!: (v: unknown) => void;
    updateEntityMock.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByDisplayValue("Original content"), {
      target: { value: "Edited" },
    });
    const save = screen.getByText("Save");
    fireEvent.click(save);
    // Second click while saving — the button is disabled and the reducer
    // ignores SUBMIT from a busy state
    fireEvent.click(screen.getByText("Saving…"));

    resolveUpdate({ status: "applied" });
    await waitFor(() => expect(updateEntityMock).toHaveBeenCalledTimes(1));
  });

  it("queued saves show the mid-run chip (2.3A)", async () => {
    updateEntityMock.mockResolvedValue({ status: "queued" });
    isRunningMock.mockReturnValue(true);
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.change(screen.getByDisplayValue("Original content"), {
      target: { value: "Mid-run edit" },
    });
    fireEvent.click(screen.getByText("Save"));

    await screen.findByText("Queued — applies after current phase");
    // No optimistic apply while a run is active
    const stored = useEntityGraphStore
      .getState()
      .analysis.entities.find((e) => e.id === "entity-1")!;
    expect((stored.data as { content: string }).content).toBe(
      "Original content",
    );
  });

  it("renders the analysis-report edit form (previously return null)", () => {
    const entity = makeFactEntity({
      id: "report-1",
      type: "analysis-report",
      phase: "meta-check",
      data: {
        type: "analysis-report",
        executive_summary: "Summary",
        why: "Because",
        key_evidence: ["E1"],
        open_assumptions: [],
        entity_references: [],
        prediction_verdict: null,
        what_would_change: ["Change"],
        source_url: null,
        analysis_timestamp: "2026-07-02",
      },
    });
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Executive summary")).toBeTruthy();
    expect(screen.getByDisplayValue("Summary")).toBeTruthy();
  });

  it("renders the meta-check edit form with per-question fields", () => {
    const entity = makeFactEntity({
      id: "meta-1",
      type: "meta-check",
      phase: "meta-check",
      data: {
        type: "meta-check",
        questions: Array.from({ length: 10 }, (_, i) => ({
          question_number: i + 1,
          answer: `Answer ${i + 1}`,
          disruption_trigger_identified: false,
        })),
      },
    });
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Edit"));
    expect(screen.getByText("Question 1")).toBeTruthy();
    expect(screen.getByDisplayValue("Answer 10")).toBeTruthy();
  });
});

describe("challenge form (2.1A)", () => {
  it("disables submit below 10 characters and shows the counter", async () => {
    getDownstreamEntityIdsMock.mockResolvedValue(["d1", "d2"]);
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Challenge"));
    const submit = await screen.findByText("Challenge & re-run");
    expect((submit.closest("button") as HTMLButtonElement).disabled).toBe(true);

    const textarea = screen.getByPlaceholderText(/cited tariff rate/);
    fireEvent.change(textarea, { target: { value: "too short" } });
    expect((submit.closest("button") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("9 / 2000")).toBeTruthy();

    fireEvent.change(textarea, {
      target: { value: "This objection is long enough." },
    });
    await waitFor(() =>
      expect((submit.closest("button") as HTMLButtonElement).disabled).toBe(
        false,
      ),
    );
  });

  it("shows the downstream impact preview and submits the objection", async () => {
    getDownstreamEntityIdsMock.mockResolvedValue(["d1", "d2", "d3"]);
    const entity = makeFactEntity();
    seedStore(entity);
    renderCard(entity);

    fireEvent.click(screen.getByText("Challenge"));
    await screen.findByText(/3 downstream entities will be marked stale/);

    fireEvent.change(screen.getByPlaceholderText(/cited tariff rate/), {
      target: { value: "  The evidence is stale and superseded.  " },
    });
    fireEvent.click(screen.getByText("Challenge & re-run"));

    await waitFor(() =>
      expect(challengeEntityMock).toHaveBeenCalledWith(
        "entity-1",
        "The evidence is stale and superseded.",
      ),
    );
  });
});

describe("resolution surface (2.2A) + what-changed peek (3.1A)", () => {
  it("shows the objection with outcome chip AND the response diff", async () => {
    const entity = makeFactEntity({
      revisionLog: [
        {
          logNo: 5,
          ts: 1,
          logSource: "revalidation",
          runId: "reval-1",
          fieldDiffs: [
            { field: "data.content", old: '"Old claim"', new: '"New claim"' },
          ],
        },
      ],
    });
    const challenge: ChallengeRecord = {
      id: "ch-1",
      entityId: "entity-1",
      objection: "The claim is outdated.",
      createdAt: 1,
      status: "resolved",
      outcome: "REVISED",
      responseLogNo: 5,
      responseRationale: "Revised per the objection.",
      viewed: false,
    };
    seedStore(entity, [challenge]);
    renderCard(entity);

    expect(screen.getByText("Objection addressed")).toBeTruthy();
    expect(screen.getByText("REVISED")).toBeTruthy();
    expect(screen.getByText(/The claim is outdated/)).toBeTruthy();
    expect(screen.getByText("Revised per the objection.")).toBeTruthy();
    // Chip never ships alone — the diff is present (it also appears in the
    // revalidation peek, which reads the same log entry)
    expect(screen.getAllByText("Old claim").length).toBeGreaterThan(0);
    expect(screen.getAllByText("New claim").length).toBeGreaterThan(0);

    // Viewing clears the until-viewed badge
    await waitFor(() =>
      expect(markChallengeViewedMock).toHaveBeenCalledWith("ch-1"),
    );
  });

  it("CONFIRMED outcome explains that the entity stood", () => {
    const entity = makeFactEntity();
    const challenge: ChallengeRecord = {
      id: "ch-2",
      entityId: "entity-1",
      objection: "Surely this is wrong.",
      createdAt: 1,
      status: "resolved",
      outcome: "CONFIRMED",
      responseRationale: "Evidence still supports the claim.",
      viewed: true,
    };
    seedStore(entity, [challenge]);
    renderCard(entity);

    expect(screen.getByText("CONFIRMED")).toBeTruthy();
    expect(screen.getByText(/No material change/)).toBeTruthy();
    expect(markChallengeViewedMock).not.toHaveBeenCalled();
  });

  it("renders the revalidation peek and clears the updated-dot on view", () => {
    const entity = makeFactEntity({
      revisionLog: [
        {
          logNo: 7,
          ts: 1,
          logSource: "revalidation",
          runId: "reval-2",
          fieldDiffs: [{ field: "confidence", old: '"high"', new: '"medium"' }],
        },
      ],
    });
    seedStore(entity);
    renderCard(entity);

    expect(screen.getByText("Updated by revalidation")).toBeTruthy();
    expect(screen.getByText("high")).toBeTruthy();
    expect(screen.getByText("medium")).toBeTruthy();
    // Watermark advanced — the canvas dot clears (3.1A "clears on view")
    expect(useCanvasStore.getState().viewedRevisionLogNos["entity-1"]).toBe(7);
  });
});
