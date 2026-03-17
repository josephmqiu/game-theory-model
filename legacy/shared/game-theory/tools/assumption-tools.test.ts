import { describe, it, expect } from "vitest";
import { createAssumptionTools } from "./assumption-tools";
import { createEvidenceTools } from "./evidence-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

function makeTestContext() {
  let store: CanonicalStore = emptyCanonicalStore();
  let eventLog: EventLog = createEventLog("test-analysis");

  const context: ToolContext = {
    get canonical() {
      return store;
    },
    dispatch: (command: Command) => {
      const result = dispatch(store, eventLog, command);
      if (result.status === "committed") {
        store = result.store;
        eventLog = result.event_log;
      }
      return result;
    },
    getAnalysisState: () => null,
    getDerivedState: () => ({
      readinessReportsByFormalization: {},
      solverResultsByFormalization: {},
      sensitivityByFormalizationAndSolver: {},
      dirtyFormalizations: {},
    }),
  };

  return { context, getStore: () => store };
}

describe("createAssumptionTools", () => {
  it("returns 4 tools with correct names", () => {
    const tools = createAssumptionTools();
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_assumption");
    expect(names).toContain("update_assumption");
    expect(names).toContain("add_contradiction");
    expect(names).toContain("add_latent_factor");
  });
});

describe("add_assumption", () => {
  const tools = createAssumptionTools();
  const addAssumption = tools.find((t) => t.name === "add_assumption")!;

  it("creates an assumption with defaults", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addAssumption.execute(
      { statement: "Players are fully rational." },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.assumptions)).toHaveLength(1);
    const assumption = Object.values(store.assumptions)[0]!;
    expect(assumption.statement).toBe("Players are fully rational.");
    expect(assumption.type).toBe("behavioral");
    expect(assumption.sensitivity).toBe("medium");
  });

  it("applies explicit type and sensitivity", async () => {
    const { context, getStore } = makeTestContext();

    await addAssumption.execute(
      {
        statement: "No outside intervention.",
        type: "structural",
        sensitivity: "critical",
        confidence: 0.9,
      },
      context,
    );

    const store = getStore();
    const assumption = Object.values(store.assumptions)[0]!;
    expect(assumption.type).toBe("structural");
    expect(assumption.sensitivity).toBe("critical");
    expect(assumption.confidence).toBe(0.9);
  });

  it("rejects missing statement", async () => {
    const { context } = makeTestContext();
    const result = (await addAssumption.execute({}, context)) as ToolResult;
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("update_assumption", () => {
  const tools = createAssumptionTools();
  const addAssumption = tools.find((t) => t.name === "add_assumption")!;
  const updateAssumption = tools.find((t) => t.name === "update_assumption")!;

  it("updates sensitivity", async () => {
    const { context, getStore } = makeTestContext();

    const addResult = (await addAssumption.execute(
      { statement: "Players act rationally." },
      context,
    )) as ToolResult;
    if (!addResult.success) return;
    const id = (addResult.data as { id: string }).id;

    const updateResult = (await updateAssumption.execute(
      { id, sensitivity: "critical" },
      context,
    )) as ToolResult;

    expect(updateResult.success).toBe(true);
    const store = getStore();
    const assumption = store.assumptions[id]!;
    expect(assumption.sensitivity).toBe("critical");
  });

  it("rejects missing id", async () => {
    const { context } = makeTestContext();
    const result = (await updateAssumption.execute(
      { sensitivity: "critical" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_contradiction", () => {
  const assumptionTools = createAssumptionTools();
  const evidenceTools = createEvidenceTools();
  const addContradiction = assumptionTools.find(
    (t) => t.name === "add_contradiction",
  )!;
  const addSource = evidenceTools.find((t) => t.name === "add_source")!;
  const addClaim = evidenceTools.find((t) => t.name === "add_claim")!;

  it("creates a contradiction between two existing claims", async () => {
    const { context, getStore } = makeTestContext();

    // Contradiction requires existing claim entities as left_ref and right_ref
    const src = (await addSource.execute(
      { title: "Source" },
      context,
    )) as ToolResult;
    if (!src.success) return;

    const c1 = (await addClaim.execute(
      { statement: "Tariffs increase GDP.", based_on: [] },
      context,
    )) as ToolResult;
    const c2 = (await addClaim.execute(
      { statement: "Tariffs decrease GDP.", based_on: [] },
      context,
    )) as ToolResult;
    if (!c1.success || !c2.success) return;
    const id1 = (c1.data as { id: string }).id;
    const id2 = (c2.data as { id: string }).id;

    const result = (await addContradiction.execute(
      {
        left_ref: id1,
        right_ref: id2,
        description: "Contradictory claims about tariff effects on GDP.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.contradictions)).toHaveLength(1);
    const contradiction = Object.values(store.contradictions)[0]!;
    expect(contradiction.left_ref).toBe(id1);
    expect(contradiction.right_ref).toBe(id2);
    expect(contradiction.resolution_status).toBe("open");
  });

  it("rejects missing required fields", async () => {
    const { context } = makeTestContext();
    const result = (await addContradiction.execute(
      { left_ref: "claim_aaa" },
      context,
    )) as ToolResult;
    expect(result.success).toBe(false);
  });
});

describe("add_latent_factor", () => {
  const tools = createAssumptionTools();
  const addLatent = tools.find((t) => t.name === "add_latent_factor")!;

  it("creates a latent factor", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addLatent.execute(
      {
        name: "Domestic Political Pressure",
        description: "Unseen internal faction dynamics.",
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    const store = getStore();
    expect(Object.keys(store.latent_factors)).toHaveLength(1);
    const lf = Object.values(store.latent_factors)[0]!;
    expect(lf.name).toBe("Domestic Political Pressure");
  });

  it("rejects missing name", async () => {
    const { context } = makeTestContext();
    const result = (await addLatent.execute({}, context)) as ToolResult;
    expect(result.success).toBe(false);
  });
});
