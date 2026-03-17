import { describe, it, expect } from "vitest";
import { createEvidenceTools } from "./evidence-tools";
import { emptyCanonicalStore } from "../types/canonical";
import { dispatch, createEventLog } from "../engine/dispatch";
import type { ToolContext, ToolResult } from "../types/agent";
import type { CanonicalStore } from "../types/canonical";
import type { Command } from "../engine/commands";
import type { EventLog } from "../engine/events";

// ── Test context factory ──────────────────────────────────────────────────────

interface TestContext {
  context: ToolContext;
  getStore: () => CanonicalStore;
}

function makeTestContext(): TestContext {
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

  return {
    context,
    getStore: () => store,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createEvidenceTools", () => {
  it("returns 5 tools with correct names", () => {
    const tools = createEvidenceTools();
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain("add_source");
    expect(names).toContain("add_observation");
    expect(names).toContain("add_claim");
    expect(names).toContain("add_inference");
    expect(names).toContain("add_derivation");
  });
});

describe("add_source", () => {
  const tools = createEvidenceTools();
  const addSource = tools.find((t) => t.name === "add_source")!;

  it("creates a source entity in canonical.sources", async () => {
    const { context, getStore } = makeTestContext();

    const result = (await addSource.execute(
      { title: "Reuters article on trade talks" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(true);
    if (!result.success) return;

    const store = getStore();
    expect(Object.keys(store.sources)).toHaveLength(1);

    const source = Object.values(store.sources)[0]!;
    expect(source.title).toBe("Reuters article on trade talks");
    expect(source.quality_rating).toBe("medium");
  });

  it("applies quality_rating and url when provided", async () => {
    const { context, getStore } = makeTestContext();

    await addSource.execute(
      {
        title: "UN Security Council transcript",
        quality_rating: "high",
        url: "https://example.com/un-transcript",
        notes: "Official UN source",
      },
      context,
    );

    const store = getStore();
    const source = Object.values(store.sources)[0]!;
    expect(source.quality_rating).toBe("high");
    expect(source.url).toBe("https://example.com/un-transcript");
    expect(source.notes).toBe("Official UN source");
  });

  it("rejects missing title", async () => {
    const { context } = makeTestContext();

    const result = (await addSource.execute({}, context)) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_observation", () => {
  const tools = createEvidenceTools();
  const addSource = tools.find((t) => t.name === "add_source")!;
  const addObservation = tools.find((t) => t.name === "add_observation")!;

  it("creates an observation linked to a source", async () => {
    const { context, getStore } = makeTestContext();

    // First add a source
    const sourceResult = (await addSource.execute(
      { title: "Reuters" },
      context,
    )) as ToolResult;
    expect(sourceResult.success).toBe(true);
    if (!sourceResult.success) return;

    const sourceId = (sourceResult.data as { id: string }).id;

    // Then add observation referencing that source
    const obsResult = (await addObservation.execute(
      { source_id: sourceId, text: "Trade deficit widened to $80bn in Q1." },
      context,
    )) as ToolResult;

    expect(obsResult.success).toBe(true);

    const store = getStore();
    expect(Object.keys(store.observations)).toHaveLength(1);

    const obs = Object.values(store.observations)[0]!;
    expect(obs.source_id).toBe(sourceId);
    expect(obs.text).toBe("Trade deficit widened to $80bn in Q1.");
  });

  it("rejects missing source_id", async () => {
    const { context } = makeTestContext();

    const result = (await addObservation.execute(
      { text: "Some fact" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_claim", () => {
  const tools = createEvidenceTools();
  const addSource = tools.find((t) => t.name === "add_source")!;
  const addObservation = tools.find((t) => t.name === "add_observation")!;
  const addClaim = tools.find((t) => t.name === "add_claim")!;

  it("creates a claim with default confidence of 0.7", async () => {
    const { context, getStore } = makeTestContext();

    // Set up source + observation to reference
    const sourceResult = (await addSource.execute(
      { title: "FT analysis" },
      context,
    )) as ToolResult;
    expect(sourceResult.success).toBe(true);
    if (!sourceResult.success) return;
    const sourceId = (sourceResult.data as { id: string }).id;

    const obsResult = (await addObservation.execute(
      { source_id: sourceId, text: "Country X imposed tariffs." },
      context,
    )) as ToolResult;
    expect(obsResult.success).toBe(true);
    if (!obsResult.success) return;
    const obsId = (obsResult.data as { id: string }).id;

    const claimResult = (await addClaim.execute(
      { statement: "Country X is engaging in a trade war.", based_on: [obsId] },
      context,
    )) as ToolResult;

    expect(claimResult.success).toBe(true);

    const store = getStore();
    expect(Object.keys(store.claims)).toHaveLength(1);

    const claim = Object.values(store.claims)[0]!;
    expect(claim.statement).toBe("Country X is engaging in a trade war.");
    expect(claim.confidence).toBe(0.7);
    expect(claim.based_on).toContain(obsId);
  });

  it("accepts explicit confidence value", async () => {
    const { context, getStore } = makeTestContext();

    await addClaim.execute(
      {
        statement: "Escalation is likely.",
        based_on: [],
        confidence: 0.9,
      },
      context,
    );

    const store = getStore();
    const claim = Object.values(store.claims)[0]!;
    expect(claim.confidence).toBe(0.9);
  });
});

describe("add_inference", () => {
  const tools = createEvidenceTools();
  const addClaim = tools.find((t) => t.name === "add_claim")!;
  const addInference = tools.find((t) => t.name === "add_inference")!;

  it("creates an inference derived from a claim", async () => {
    const { context, getStore } = makeTestContext();

    const claimResult = (await addClaim.execute(
      { statement: "Country X imposed tariffs.", based_on: [] },
      context,
    )) as ToolResult;
    expect(claimResult.success).toBe(true);
    if (!claimResult.success) return;
    const claimId = (claimResult.data as { id: string }).id;

    const infResult = (await addInference.execute(
      {
        statement: "Country X is signalling resolve.",
        derived_from: [claimId],
        rationale:
          "Tariff imposition is a costly signal consistent with resolve.",
      },
      context,
    )) as ToolResult;

    expect(infResult.success).toBe(true);

    const store = getStore();
    expect(Object.keys(store.inferences)).toHaveLength(1);

    const inference = Object.values(store.inferences)[0]!;
    expect(inference.statement).toBe("Country X is signalling resolve.");
    expect(inference.rationale).toBe(
      "Tariff imposition is a costly signal consistent with resolve.",
    );
    expect(inference.derived_from).toContain(claimId);
    expect(inference.confidence).toBe(0.7);
  });

  it("rejects missing rationale", async () => {
    const { context } = makeTestContext();

    const result = (await addInference.execute(
      {
        statement: "Some inference.",
        derived_from: [],
      },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});

describe("add_derivation", () => {
  const tools = createEvidenceTools();
  const addClaim = tools.find((t) => t.name === "add_claim")!;
  const addDerivation = tools.find((t) => t.name === "add_derivation")!;

  it("creates a derivation edge between two entities", async () => {
    const { context, getStore } = makeTestContext();

    const c1 = (await addClaim.execute(
      { statement: "Claim A", based_on: [] },
      context,
    )) as ToolResult;
    const c2 = (await addClaim.execute(
      { statement: "Claim B", based_on: [] },
      context,
    )) as ToolResult;
    expect(c1.success).toBe(true);
    expect(c2.success).toBe(true);
    if (!c1.success || !c2.success) return;

    const fromId = (c1.data as { id: string }).id;
    const toId = (c2.data as { id: string }).id;

    const derivResult = (await addDerivation.execute(
      { from_ref: fromId, to_ref: toId, relation: "supports" },
      context,
    )) as ToolResult;

    expect(derivResult.success).toBe(true);

    const store = getStore();
    expect(Object.keys(store.derivations)).toHaveLength(1);

    const derivation = Object.values(store.derivations)[0]!;
    expect(derivation.from_ref).toBe(fromId);
    expect(derivation.to_ref).toBe(toId);
    expect(derivation.relation).toBe("supports");
  });

  it("rejects invalid relation value", async () => {
    const { context } = makeTestContext();

    const result = (await addDerivation.execute(
      { from_ref: "a", to_ref: "b", relation: "operationalizes" },
      context,
    )) as ToolResult;

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain("Invalid input");
  });
});
