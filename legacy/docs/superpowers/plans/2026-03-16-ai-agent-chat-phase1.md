# AI Agent Chat — Phase 1: Tool Registry + Agent Loop

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational layer — tool registry, provider adapters, agent loop endpoint, and prompt files — so the app can send user messages to an AI provider with game theory tools and stream back tool calls + text.

**Architecture:** A tool registry in `shared/game-theory/tools/` defines tools as `{ name, description, inputSchema, execute }` objects. A provider adapter layer normalizes Anthropic/OpenAI request/response formats. A Nitro endpoint (`server/api/ai/agent.ts`) runs the agent loop: send messages + tools to provider → receive tool calls → execute locally → send results back → repeat until done. All entity mutations flow through the existing command spine (`dispatch()`).

**Tech Stack:** TypeScript, Zod (validation), Anthropic SDK (`@anthropic-ai/sdk`), Nitro/H3 (server), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-16-ai-agent-chat-design.md`

**Scope:** This plan covers Migration Phase 1 only. Phases 2-4 (chat panel UI, analysis views integration, prompt tuning) will be separate plans.

---

## Chunk 1: Types and Tool Registry Infrastructure

### Task 1: Agent event types

**Files:**

- Create: `shared/game-theory/types/agent.ts`
- Test: `shared/game-theory/types/agent.test.ts`

- [ ] **Step 1: Write the type definitions**

```typescript
// shared/game-theory/types/agent.ts
import type { JsonSchema } from "./json-schema";
import type { CanonicalStore } from "./canonical";
import type { Command } from "../engine/commands";
import type { DispatchResult } from "../engine/dispatch";

// --- Agent event protocol (SSE) ---

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | {
      type: "tool_call";
      id: string;
      name: string;
      input: Record<string, unknown>;
    }
  | { type: "tool_result"; id: string; result: unknown; duration_ms: number }
  | { type: "status"; analysis_status: AnalysisStatus }
  | { type: "compaction"; summary: string }
  | { type: "error"; content: string }
  | { type: "done"; content: string }
  | { type: "ping"; content: string };

// --- Analysis status (returned by get_analysis_status) ---

export interface PhaseProgress {
  phase: number;
  name: string;
  has_entities: boolean;
  entity_counts: Record<string, number>;
  coverage_warnings: string[];
}

export interface AnalysisStatus {
  has_analysis: boolean;
  description: string | null;
  phases: PhaseProgress[];
  total_entities: number;
  solver_ready_formalizations: string[];
  warnings: string[];
}

// --- Tool definitions ---

export interface ToolContext {
  canonical: CanonicalStore;
  dispatch: (command: Command) => DispatchResult;
  getAnalysisState: () => AnalysisState | null;
  getDerivedState: () => DerivedState;
}

export type ToolResult =
  | { success: true; data: unknown }
  | { success: false; error: string };

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: unknown, context: ToolContext) => ToolResult;
}

// --- Provider adapter ---

export interface NormalizedMessage {
  role: "user" | "assistant" | "tool_result";
  content: string | NormalizedContentBlock[];
}

export interface NormalizedContentBlock {
  type: "text" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ContextManagementConfig {
  enabled: boolean;
}

export interface ProviderCapabilities {
  toolUse: boolean;
  webSearch: boolean;
  compaction: boolean;
}

export interface ProviderAdapter {
  name: string;
  capabilities: ProviderCapabilities;

  formatRequest(params: {
    system: string;
    messages: NormalizedMessage[];
    tools: ToolDefinition[];
    contextManagement?: ContextManagementConfig;
    enableWebSearch?: boolean;
  }): unknown;

  parseStreamChunk(chunk: unknown): AgentEvent[];

  formatToolResult(toolCallId: string, result: ToolResult): NormalizedMessage;
}

// --- Agent loop config ---

export interface AgentLoopConfig {
  maxIterations: number;
  inactivityTimeoutMs: number;
  enableWebSearch: boolean;
}

export const DEFAULT_AGENT_LOOP_CONFIG: AgentLoopConfig = {
  maxIterations: 100,
  inactivityTimeoutMs: 60_000,
  enableWebSearch: true,
};
```

Note: `AnalysisState`, `DerivedState`, and `JsonSchema` types are referenced from existing codebase types. `AnalysisState` is defined in `shared/game-theory/types/analysis-pipeline.ts`. `DerivedState` is in `src/stores/derived-store.ts`. For `JsonSchema`, create a minimal type alias if one doesn't exist:

```typescript
// Add to shared/game-theory/types/json-schema.ts if it doesn't exist
export type JsonSchema = Record<string, unknown>;
```

- [ ] **Step 2: Write a basic type-level test to verify exports**

```typescript
// shared/game-theory/types/agent.test.ts
import { describe, it, expect } from "vitest";
import type {
  AgentEvent,
  ToolDefinition,
  ToolContext,
  ToolResult,
  ProviderAdapter,
  AgentLoopConfig,
  AnalysisStatus,
} from "./agent";
import { DEFAULT_AGENT_LOOP_CONFIG } from "./agent";

describe("agent types", () => {
  it("exports default agent loop config", () => {
    expect(DEFAULT_AGENT_LOOP_CONFIG.maxIterations).toBe(100);
    expect(DEFAULT_AGENT_LOOP_CONFIG.inactivityTimeoutMs).toBe(60_000);
    expect(DEFAULT_AGENT_LOOP_CONFIG.enableWebSearch).toBe(true);
  });

  it("AgentEvent type covers all event types", () => {
    const events: AgentEvent[] = [
      { type: "text", content: "hello" },
      { type: "thinking", content: "hmm" },
      { type: "tool_call", id: "1", name: "add_player", input: {} },
      { type: "tool_result", id: "1", result: {}, duration_ms: 10 },
      {
        type: "status",
        analysis_status: {
          has_analysis: false,
          description: null,
          phases: [],
          total_entities: 0,
          solver_ready_formalizations: [],
          warnings: [],
        },
      },
      { type: "compaction", summary: "compacted" },
      { type: "error", content: "err" },
      { type: "done", content: "" },
      { type: "ping", content: "" },
    ];
    expect(events).toHaveLength(9);
  });
});
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run shared/game-theory/types/agent.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add shared/game-theory/types/agent.ts shared/game-theory/types/agent.test.ts
git commit -m "feat: add agent event types, tool definition interface, and provider adapter types"
```

---

### Task 2: Tool registry loader

**Files:**

- Create: `shared/game-theory/tools/registry.ts`
- Create: `shared/game-theory/tools/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// shared/game-theory/tools/registry.test.ts
import { describe, it, expect } from "vitest";
import { createToolRegistry, type ToolRegistry } from "./registry";
import type { ToolDefinition } from "../types/agent";

describe("ToolRegistry", () => {
  it("registers and retrieves a tool by name", () => {
    const registry = createToolRegistry();
    const tool: ToolDefinition = {
      name: "test_tool",
      description: "A test tool",
      inputSchema: { type: "object", properties: {} },
      execute: () => ({ success: true, data: "ok" }),
    };
    registry.register(tool);
    expect(registry.get("test_tool")).toBe(tool);
  });

  it("returns undefined for unknown tool", () => {
    const registry = createToolRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all registered tools", () => {
    const registry = createToolRegistry();
    registry.register({
      name: "tool_a",
      description: "A",
      inputSchema: { type: "object" },
      execute: () => ({ success: true, data: null }),
    });
    registry.register({
      name: "tool_b",
      description: "B",
      inputSchema: { type: "object" },
      execute: () => ({ success: true, data: null }),
    });
    const all = registry.listAll();
    expect(all).toHaveLength(2);
    expect(all.map((t) => t.name)).toEqual(["tool_a", "tool_b"]);
  });

  it("returns tool schemas for provider requests", () => {
    const registry = createToolRegistry();
    registry.register({
      name: "add_player",
      description: "Add a player",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
      execute: () => ({ success: true, data: null }),
    });
    const schemas = registry.getSchemas();
    expect(schemas).toHaveLength(1);
    expect(schemas[0]).toEqual({
      name: "add_player",
      description: "Add a player",
      input_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    });
  });

  it("rejects duplicate tool names", () => {
    const registry = createToolRegistry();
    const tool: ToolDefinition = {
      name: "dup",
      description: "D",
      inputSchema: { type: "object" },
      execute: () => ({ success: true, data: null }),
    };
    registry.register(tool);
    expect(() => registry.register(tool)).toThrow("already registered");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/game-theory/tools/registry.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// shared/game-theory/tools/registry.ts
import type { ToolDefinition } from "../types/agent";

export interface ToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolRegistry {
  register: (tool: ToolDefinition) => void;
  get: (name: string) => ToolDefinition | undefined;
  listAll: () => readonly ToolDefinition[];
  getSchemas: () => ToolSchema[];
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDefinition>();

  return {
    register(tool) {
      if (tools.has(tool.name)) {
        throw new Error(`Tool "${tool.name}" is already registered`);
      }
      tools.set(tool.name, tool);
    },

    get(name) {
      return tools.get(name);
    },

    listAll() {
      return [...tools.values()];
    },

    getSchemas() {
      return [...tools.values()].map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/game-theory/tools/registry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/game-theory/tools/registry.ts shared/game-theory/tools/registry.test.ts
git commit -m "feat: add tool registry with register, get, listAll, getSchemas"
```

---

### Task 3: Prompt file loader

**Files:**

- Create: `shared/game-theory/prompts/loader.ts`
- Create: `shared/game-theory/prompts/loader.test.ts`
- Create: `shared/game-theory/prompts/system.md` (initial stub)
- Create: `shared/game-theory/prompts/phases/phase-1.md` (initial stub)

- [ ] **Step 1: Write the failing test**

```typescript
// shared/game-theory/prompts/loader.test.ts
import { describe, it, expect, vi } from "vitest";
import {
  loadSystemPrompt,
  loadPhaseMethodology,
  loadToolDescription,
} from "./loader";

// These tests read real files from the prompts directory.
// They verify the loader reads .md files and returns strings.

describe("prompt loader", () => {
  it("loads system prompt from system.md", () => {
    const prompt = loadSystemPrompt();
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain("game theory");
  });

  it("loads phase methodology by phase number", () => {
    const phase1 = loadPhaseMethodology(1);
    expect(typeof phase1).toBe("string");
    expect(phase1.length).toBeGreaterThan(0);
  });

  it("returns fallback for missing phase", () => {
    const phase99 = loadPhaseMethodology(99);
    expect(phase99).toContain("not available");
  });

  it("loads tool description by tool name", () => {
    const desc = loadToolDescription("get_analysis_status");
    expect(typeof desc).toBe("string");
    // May return fallback if file doesn't exist yet
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/game-theory/prompts/loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create stub prompt files**

Create `shared/game-theory/prompts/system.md`:

```markdown
# Game Theory Analysis Agent

You are an expert game theory analyst. You analyze real-world situations using a structured 10-phase methodology.

## Core Principle

Facts first. Players second. Baseline model third. History fourth. Full formalization fifth. Predictions last.

Game theory applied to a misunderstood situation produces confident-looking nonsense. The model is only as good as the factual foundation, the player identification, the institutional structure, and the historical context.

## Phase Structure

1. **Situational grounding** — Build the factual picture before identifying any games
2. **Player identification** — Know who's playing and what they're optimizing for
3. **Baseline strategic model** — Build the smallest game that captures the main tension
4. **Historical repeated game** — Use history to refine the baseline model
5. **Recursive revalidation** — Check if new findings require re-running earlier phases
6. **Full formal modeling** — Apply game-theoretic tools to the stabilized picture
7. **Assumption extraction** — Make every assumption explicit and rate sensitivity
8. **Elimination** — Establish what can't happen before predicting what will
9. **Scenario generation** — Generate predictions with full traceability
10. **Meta-check** — Catch blind spots before finalizing

## Tool Usage

- Call `get_analysis_status` before advancing to a new phase to check coverage and readiness
- Always trace evidence to sources — use `add_source` before `add_observation` before `add_claim`
- Use `propose_revision` when changing entities the user has reviewed; use direct `update_*` tools for your own recent work
- Use `check_disruption_triggers` after significant changes to verify upstream phases remain valid
- Use web search for Phase 1 grounding and Phase 4 historical research — find real facts, not hypotheticals

## Failure Modes to Avoid

- **Premature formalization** — Don't jump to "it's a prisoner's dilemma" before understanding who's playing
- **Complexity inflation** — Add games/players only when they change the answer
- **Monolithic players** — States, firms, alliances are often multiple agents with divergent incentives
- **False precision** — Use ordinal preferences when you only have ordinal data
- **Linear analysis** — The methodology has backward edges. Phase 4 discoveries routinely revise Phase 2

## Recursive Loop

| Discovery                                 | Action                                |
| ----------------------------------------- | ------------------------------------- |
| New player with independent agency        | → Revisit Phase 2                     |
| Player's objective function changed       | → Revisit Phase 2 + Phase 3           |
| New game identified                       | → Revisit Phase 3                     |
| Repeated interaction dominates one-shot   | → Revisit Phase 3 + Phase 4           |
| Critical empirical assumption invalidated | → Revisit Phase 7 + Phase 8 + Phase 9 |

## Output Style

- Be specific. Use numbers, dates, names — not generalities.
- Cite evidence. Every claim should trace to a source or observation.
- Show your reasoning. Explain why a game type was chosen, why a payoff was ranked.
- Flag uncertainty. Distinguish equilibrium predictions from discretionary judgment.
```

Create `shared/game-theory/prompts/phases/phase-1.md` (extract from the methodology doc — Phase 1 section):

```markdown
# Phase 1: Situational Grounding

**Purpose:** Build the factual picture before identifying any games.

Do not start with theory. Start with: what is actually happening right now? Research the current state thoroughly. Collect specific data points, not summaries. Numbers anchor the analysis and prevent narrative drift.

**What to capture:**

- Capabilities and resources (military assets and deployments; product features and market position; financial reserves and legal representation — whatever each side can bring to bear)
- Economic and financial impact (prices, supply disruptions, market reactions, sanctions, revenue shifts, cost structures)
- Stakeholder positions from each side (political statements, company announcements, legal filings — distinguish public posturing from operational signals)
- Impact on affected parties (civilian casualties and displacement; customer disruption; employee impact; collateral damage to third parties)
- Timeline of key events with exact dates
- What each side has actually done (actions), not just what they've said (words)
- Rules and constraints already in force (treaties, sanctions regimes, alliance commitments; regulations, contracts, platform terms; legal authorities, organizational mandates)

**Discipline:** Capture sources with timestamps. Preserve specific numbers and quotes. These become the evidence foundation that every later claim traces back to.

**What to watch for:** Facts that surprise you. If something doesn't fit your initial mental model of the situation, that's signal — it usually means the game structure is different from what you assumed.

**Tools to use:** `web_search` to research facts, then `add_source` → `add_observation` → `add_claim` → `add_inference` → `add_derivation` to build evidence chains.
```

- [ ] **Step 4: Write the loader implementation**

```typescript
// shared/game-theory/prompts/loader.ts
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PROMPTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)));

function readPromptFile(relativePath: string): string | null {
  const fullPath = resolve(PROMPTS_DIR, relativePath);
  if (!existsSync(fullPath)) {
    return null;
  }
  return readFileSync(fullPath, "utf-8");
}

export function loadSystemPrompt(): string {
  const content = readPromptFile("system.md");
  if (!content) {
    throw new Error(
      "System prompt file not found: shared/game-theory/prompts/system.md",
    );
  }
  return content;
}

export function loadPhaseMethodology(phase: number): string {
  const content = readPromptFile(`phases/phase-${phase}.md`);
  if (!content) {
    return `Detailed methodology for Phase ${phase} is not available. Use the system prompt guidance for this phase.`;
  }
  return content;
}

export function loadToolDescription(toolName: string): string {
  const content = readPromptFile(`tools/${toolName}.md`);
  if (!content) {
    return `Tool: ${toolName}`;
  }
  return content;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run shared/game-theory/prompts/loader.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add shared/game-theory/prompts/loader.ts shared/game-theory/prompts/loader.test.ts shared/game-theory/prompts/system.md shared/game-theory/prompts/phases/phase-1.md
git commit -m "feat: add prompt file loader with system prompt and Phase 1 methodology"
```

---

### Task 4: Analysis tools — get_analysis_status and get_methodology_phase

**Files:**

- Create: `shared/game-theory/tools/analysis-tools.ts`
- Create: `shared/game-theory/tools/analysis-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/game-theory/tools/analysis-tools.test.ts
import { describe, it, expect } from "vitest";
import {
  createGetAnalysisStatusTool,
  createGetMethodologyPhaseTool,
} from "./analysis-tools";
import { createEmptyCanonicalStore } from "../engine/canonical-store";

describe("get_analysis_status", () => {
  it("returns empty status when no analysis exists", () => {
    const tool = createGetAnalysisStatusTool();
    const result = tool.execute(
      {},
      {
        canonical: createEmptyCanonicalStore(),
        dispatch: () => {
          throw new Error("should not dispatch");
        },
        getAnalysisState: () => null,
        getDerivedState: () => ({ solverResults: {} }),
      },
    );
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: unknown }).data as {
      has_analysis: boolean;
    };
    expect(data.has_analysis).toBe(false);
  });

  it("counts entities and reports phase progress", () => {
    const tool = createGetAnalysisStatusTool();
    const canonical = createEmptyCanonicalStore();
    // Simulate having 2 players
    const withPlayers = {
      ...canonical,
      players: {
        p1: { id: "p1", name: "US", type: "state", role: "primary" } as any,
        p2: { id: "p2", name: "China", type: "state", role: "primary" } as any,
      },
    };
    const result = tool.execute(
      {},
      {
        canonical: withPlayers,
        dispatch: () => {
          throw new Error("should not dispatch");
        },
        getAnalysisState: () =>
          ({
            id: "test",
            event_description: "US vs China",
            status: "running",
          }) as any,
        getDerivedState: () => ({ solverResults: {} }),
      },
    );
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: unknown }).data as {
      has_analysis: boolean;
      total_entities: number;
      phases: Array<{ phase: number; entity_counts: Record<string, number> }>;
    };
    expect(data.has_analysis).toBe(true);
    expect(data.total_entities).toBe(2);
    const phase2 = data.phases.find((p) => p.phase === 2);
    expect(phase2?.entity_counts["players"]).toBe(2);
  });
});

describe("get_methodology_phase", () => {
  it("returns methodology text for valid phase", () => {
    const tool = createGetMethodologyPhaseTool();
    const result = tool.execute(
      { phase: 1 },
      {
        canonical: createEmptyCanonicalStore(),
        dispatch: () => {
          throw new Error("should not dispatch");
        },
        getAnalysisState: () => null,
        getDerivedState: () => ({ solverResults: {} }),
      },
    );
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: unknown }).data as string;
    expect(data).toContain("Situational Grounding");
  });

  it("returns fallback for invalid phase", () => {
    const tool = createGetMethodologyPhaseTool();
    const result = tool.execute(
      { phase: 99 },
      {
        canonical: createEmptyCanonicalStore(),
        dispatch: () => {
          throw new Error("should not dispatch");
        },
        getAnalysisState: () => null,
        getDerivedState: () => ({ solverResults: {} }),
      },
    );
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: unknown }).data as string;
    expect(data).toContain("not available");
  });

  it("fails on invalid input", () => {
    const tool = createGetMethodologyPhaseTool();
    const result = tool.execute(
      { phase: "not a number" },
      {
        canonical: createEmptyCanonicalStore(),
        dispatch: () => {
          throw new Error("should not dispatch");
        },
        getAnalysisState: () => null,
        getDerivedState: () => ({ solverResults: {} }),
      },
    );
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/game-theory/tools/analysis-tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// shared/game-theory/tools/analysis-tools.ts
import { z } from "zod";
import type {
  ToolDefinition,
  ToolContext,
  AnalysisStatus,
  PhaseProgress,
} from "../types/agent";
import { loadPhaseMethodology } from "../prompts/loader";

const PHASE_NAMES: Record<number, string> = {
  1: "Situational Grounding",
  2: "Player Identification",
  3: "Baseline Strategic Model",
  4: "Historical Repeated Game",
  5: "Recursive Revalidation",
  6: "Full Formal Modeling",
  7: "Assumption Extraction",
  8: "Elimination",
  9: "Scenario Generation",
  10: "Meta-check",
};

const PHASE_ENTITY_MAP: Record<
  number,
  { collections: string[]; label: string }
> = {
  1: {
    collections: ["sources", "observations", "claims", "inferences"],
    label: "evidence",
  },
  2: { collections: ["players"], label: "players" },
  3: { collections: ["games", "formalizations"], label: "games" },
  4: {
    collections: [
      "trust_assessments",
      "repeated_game_patterns",
      "dynamic_inconsistency_risks",
    ],
    label: "history",
  },
  5: { collections: ["revalidation_events"], label: "revalidation" },
  6: {
    collections: ["formalizations", "signal_classifications"],
    label: "formalizations",
  },
  7: {
    collections: ["assumptions", "contradictions", "latent_factors"],
    label: "assumptions",
  },
  8: { collections: ["eliminated_outcomes"], label: "eliminations" },
  9: {
    collections: ["scenarios", "tail_risks", "central_theses"],
    label: "scenarios",
  },
  10: { collections: [], label: "meta-check" },
};

function buildPhaseProgress(
  canonical: Record<string, Record<string, unknown>>,
): PhaseProgress[] {
  return Array.from({ length: 10 }, (_, i) => {
    const phase = i + 1;
    const mapping = PHASE_ENTITY_MAP[phase] ?? { collections: [], label: "" };
    const entityCounts: Record<string, number> = {};
    let hasEntities = false;

    for (const collection of mapping.collections) {
      const store = canonical[collection];
      const count = store ? Object.keys(store).length : 0;
      entityCounts[collection] = count;
      if (count > 0) {
        hasEntities = true;
      }
    }

    const warnings: string[] = [];
    if (phase === 2 && hasEntities && (entityCounts["players"] ?? 0) < 2) {
      warnings.push(
        "Only 1 player identified. Most strategic situations involve at least 2 players.",
      );
    }
    if (
      phase === 2 &&
      hasEntities &&
      (canonical["sources"] ? Object.keys(canonical["sources"]).length : 0) ===
        0
    ) {
      warnings.push(
        "Players exist but no evidence has been gathered. The methodology says facts first.",
      );
    }
    if (
      phase === 3 &&
      hasEntities &&
      (entityCounts["formalizations"] ?? 0) === 0
    ) {
      warnings.push(
        "Games exist but none have formalizations. Add a formal representation to enable solver analysis.",
      );
    }

    return {
      phase,
      name: PHASE_NAMES[phase] ?? `Phase ${phase}`,
      has_entities: hasEntities,
      entity_counts: entityCounts,
      coverage_warnings: warnings,
    };
  });
}

export function createGetAnalysisStatusTool(): ToolDefinition {
  return {
    name: "get_analysis_status",
    description:
      "Returns phase progress, entity counts, coverage warnings, and solver readiness indicators for the current analysis.",
    inputSchema: { type: "object", properties: {}, required: [] },
    execute(_input: unknown, context: ToolContext) {
      const analysisState = context.getAnalysisState();
      const canonical = context.canonical as unknown as Record<
        string,
        Record<string, unknown>
      >;
      const phases = buildPhaseProgress(canonical);

      const totalEntities = phases.reduce(
        (sum, phase) =>
          sum + Object.values(phase.entity_counts).reduce((a, b) => a + b, 0),
        0,
      );

      const solverReadyFormalizations: string[] = [];
      const formalizations = context.canonical.formalizations;
      for (const [id, formalization] of Object.entries(formalizations)) {
        if (
          formalization.kind === "normal_form" &&
          formalization.payoff_cells.length > 0
        ) {
          const hasAllPayoffs = formalization.payoff_cells.every(
            (cell) => Object.keys(cell.payoffs).length > 0,
          );
          if (hasAllPayoffs) {
            solverReadyFormalizations.push(id);
          }
        }
      }

      const allWarnings = phases.flatMap((p) => p.coverage_warnings);

      const status: AnalysisStatus = {
        has_analysis: analysisState !== null,
        description: analysisState?.event_description ?? null,
        phases,
        total_entities: totalEntities,
        solver_ready_formalizations: solverReadyFormalizations,
        warnings: allWarnings,
      };

      return { success: true, data: status };
    },
  };
}

const getMethodologyPhaseInputSchema = z.object({
  phase: z.number().int().min(1).max(10),
});

export function createGetMethodologyPhaseTool(): ToolDefinition {
  return {
    name: "get_methodology_phase",
    description:
      "Returns the full analytical methodology for a specific phase (1-10).",
    inputSchema: {
      type: "object",
      properties: {
        phase: { type: "number", description: "Phase number (1-10)" },
      },
      required: ["phase"],
    },
    execute(input: unknown, _context: ToolContext) {
      const parsed = getMethodologyPhaseInputSchema.safeParse(input);
      if (!parsed.success) {
        return {
          success: false,
          error: `Invalid input: ${parsed.error.message}`,
        };
      }
      const text = loadPhaseMethodology(parsed.data.phase);
      return { success: true, data: text };
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/game-theory/tools/analysis-tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/game-theory/tools/analysis-tools.ts shared/game-theory/tools/analysis-tools.test.ts
git commit -m "feat: add get_analysis_status and get_methodology_phase tools"
```

---

## Chunk 2: Entity Tools (Evidence + Players)

### Task 5: Evidence tools — add_source, add_observation, add_claim, add_inference, add_derivation

**Files:**

- Create: `shared/game-theory/tools/evidence-tools.ts`
- Create: `shared/game-theory/tools/evidence-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/game-theory/tools/evidence-tools.test.ts
import { describe, it, expect } from "vitest";
import { createEvidenceTools } from "./evidence-tools";
import { createEmptyCanonicalStore } from "../engine/canonical-store";
import { createEventLog } from "../engine/events";
import { dispatch } from "../engine/dispatch";

function makeContext() {
  let canonical = createEmptyCanonicalStore();
  let eventLog = createEventLog("test", 0);
  return {
    canonical,
    dispatch(command: any) {
      const result = dispatch(canonical, eventLog, command);
      if (result.status === "committed") {
        canonical = result.store;
        eventLog = result.event_log;
        // Update the context reference so subsequent tools see the new state
        ctx.canonical = canonical;
      }
      return result;
    },
    getAnalysisState: () => null,
    getDerivedState: () => ({ solverResults: {} }),
    get ctx() {
      return this;
    },
  };
}

describe("evidence tools", () => {
  const tools = createEvidenceTools();
  const toolMap = Object.fromEntries(tools.map((t) => [t.name, t]));

  it("creates all 5 evidence tools", () => {
    expect(tools).toHaveLength(5);
    expect(tools.map((t) => t.name)).toEqual([
      "add_source",
      "add_observation",
      "add_claim",
      "add_inference",
      "add_derivation",
    ]);
  });

  it("add_source creates a source entity", () => {
    const context = makeContext();
    const result = toolMap["add_source"]!.execute(
      {
        title: "Reuters Report",
        quality_rating: "high",
        notes: "Breaking news coverage",
      },
      context,
    );
    expect(result.success).toBe(true);
    const data = (result as any).data;
    expect(data.id).toBeDefined();
    expect(Object.keys(context.canonical.sources)).toHaveLength(1);
  });

  it("add_source rejects missing title", () => {
    const context = makeContext();
    const result = toolMap["add_source"]!.execute(
      {
        quality_rating: "high",
      },
      context,
    );
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run shared/game-theory/tools/evidence-tools.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Each tool validates input with Zod, builds a Command, and dispatches it. The pattern is the same for all entity tools — the key difference is the command `kind` and payload shape.

```typescript
// shared/game-theory/tools/evidence-tools.ts
import { z } from "zod";
import type { ToolDefinition, ToolContext, ToolResult } from "../types/agent";

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function executeTool(
  input: unknown,
  schema: z.ZodType,
  buildCommand: (parsed: any) => { kind: string; id: string; payload: any },
  context: ToolContext,
): ToolResult {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: `Invalid input: ${parsed.error.message}` };
  }

  const command = buildCommand(parsed.data);
  const result = context.dispatch(command as any);

  if (result.status === "committed") {
    return { success: true, data: { id: command.id, kind: command.kind } };
  }

  return {
    success: false,
    error:
      result.status === "rejected"
        ? result.errors.join("; ")
        : `Dispatch returned unexpected status: ${result.status}`,
  };
}

const addSourceSchema = z.object({
  title: z.string().min(1),
  quality_rating: z
    .enum(["high", "medium", "low"])
    .optional()
    .default("medium"),
  notes: z.string().optional(),
  url: z.string().optional(),
});

const addObservationSchema = z.object({
  source_id: z.string().min(1),
  text: z.string().min(1),
});

const addClaimSchema = z.object({
  statement: z.string().min(1),
  based_on: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1).optional().default(0.7),
});

const addInferenceSchema = z.object({
  statement: z.string().min(1),
  derived_from: z.array(z.string()).min(1),
  confidence: z.number().min(0).max(1).optional().default(0.7),
  rationale: z.string().optional(),
});

const addDerivationSchema = z.object({
  from_ref: z.string().min(1),
  to_ref: z.string().min(1),
  relation: z.enum(["supports", "infers", "contradicts"]),
});

export function createEvidenceTools(): ToolDefinition[] {
  return [
    {
      name: "add_source",
      description: "Register an information source with quality rating.",
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Source title" },
          quality_rating: { type: "string", enum: ["high", "medium", "low"] },
          notes: { type: "string", description: "Additional notes" },
          url: { type: "string", description: "Source URL" },
        },
        required: ["title"],
      },
      execute: (input, context) =>
        executeTool(
          input,
          addSourceSchema,
          (data) => ({
            kind: "add_source",
            id: makeId("source"),
            payload: {
              kind: "manual",
              title: data.title,
              captured_at: new Date().toISOString(),
              quality_rating: data.quality_rating,
              notes: data.notes ?? null,
              url: data.url ?? null,
            },
          }),
          context,
        ),
    },
    {
      name: "add_observation",
      description: "Record a specific data point from a source.",
      inputSchema: {
        type: "object",
        properties: {
          source_id: {
            type: "string",
            description: "ID of the source this observation comes from",
          },
          text: { type: "string", description: "The observation text" },
        },
        required: ["source_id", "text"],
      },
      execute: (input, context) =>
        executeTool(
          input,
          addObservationSchema,
          (data) => ({
            kind: "add_observation",
            id: makeId("observation"),
            payload: {
              source_id: data.source_id,
              text: data.text,
              captured_at: new Date().toISOString(),
            },
          }),
          context,
        ),
    },
    {
      name: "add_claim",
      description: "State a factual claim derived from observations.",
      inputSchema: {
        type: "object",
        properties: {
          statement: { type: "string", description: "The claim statement" },
          based_on: {
            type: "array",
            items: { type: "string" },
            description: "Observation IDs this claim is based on",
          },
          confidence: { type: "number", description: "0-1 confidence level" },
        },
        required: ["statement", "based_on"],
      },
      execute: (input, context) =>
        executeTool(
          input,
          addClaimSchema,
          (data) => ({
            kind: "add_claim",
            id: makeId("claim"),
            payload: {
              statement: data.statement,
              based_on: data.based_on,
              confidence: data.confidence,
            },
          }),
          context,
        ),
    },
    {
      name: "add_inference",
      description: "Draw an inference from claims.",
      inputSchema: {
        type: "object",
        properties: {
          statement: { type: "string", description: "The inference statement" },
          derived_from: {
            type: "array",
            items: { type: "string" },
            description: "Claim IDs this inference is derived from",
          },
          confidence: { type: "number", description: "0-1 confidence level" },
          rationale: {
            type: "string",
            description: "Why this inference follows",
          },
        },
        required: ["statement", "derived_from"],
      },
      execute: (input, context) =>
        executeTool(
          input,
          addInferenceSchema,
          (data) => ({
            kind: "add_inference",
            id: makeId("inference"),
            payload: {
              statement: data.statement,
              derived_from: data.derived_from,
              confidence: data.confidence,
              rationale: data.rationale ?? null,
            },
          }),
          context,
        ),
    },
    {
      name: "add_derivation",
      description: "Link evidence chain (observation→claim, claim→inference).",
      inputSchema: {
        type: "object",
        properties: {
          from_ref: { type: "string", description: "Source entity ID" },
          to_ref: { type: "string", description: "Target entity ID" },
          relation: {
            type: "string",
            enum: ["supports", "infers", "contradicts"],
          },
        },
        required: ["from_ref", "to_ref", "relation"],
      },
      execute: (input, context) =>
        executeTool(
          input,
          addDerivationSchema,
          (data) => ({
            kind: "add_derivation",
            id: makeId("derivation"),
            payload: {
              from_ref: data.from_ref,
              to_ref: data.to_ref,
              relation: data.relation,
            },
          }),
          context,
        ),
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run shared/game-theory/tools/evidence-tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add shared/game-theory/tools/evidence-tools.ts shared/game-theory/tools/evidence-tools.test.ts
git commit -m "feat: add evidence tools (add_source, add_observation, add_claim, add_inference, add_derivation)"
```

---

### Task 6: Player tools — add_player, update_player

**Files:**

- Create: `shared/game-theory/tools/player-tools.ts`
- Create: `shared/game-theory/tools/player-tools.test.ts`

This follows the exact same pattern as Task 5. The `executeTool` helper can be extracted to a shared util — or each tool file can define its own (keep it simple for v1, extract later if duplication is painful).

- [ ] **Step 1: Write the failing tests**

Test that `add_player` creates a player with name, type, role, objectives. Test that `update_player` modifies an existing player. Test input validation rejects invalid payloads.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the implementation** following the same `executeTool` pattern from Task 5, using `add_player` and `update_player` command kinds.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add player tools (add_player, update_player, add_player_objective, update_information_state)"
```

---

### Task 7: Remaining entity tools (games, history, assumptions, scenarios, workflow)

**Files:**

- Create: `shared/game-theory/tools/game-tools.ts`
- Create: `shared/game-theory/tools/history-tools.ts`
- Create: `shared/game-theory/tools/assumption-tools.ts`
- Create: `shared/game-theory/tools/scenario-tools.ts`
- Create: `shared/game-theory/tools/workflow-tools.ts`
- Create: `shared/game-theory/tools/read-tools.ts` (get_entity, list_entities)
- Create corresponding test files for each

Each file follows the same pattern: Zod schema → Command → dispatch. Test at least one add + one update per file, plus validation rejection.

For `run_solver`: delegates to the existing solver infrastructure in `src/stores/derived-store.ts`. Hard-gates on formalization readiness.

For `propose_revision`: creates a proposal via the existing proposal system in `conversation-store`. Returns a proposal ID.

For `check_disruption_triggers`: reads canonical state + analysis state, checks the trigger table from the methodology, returns list of affected phases.

- [ ] **Step 1-5 per file:** Write tests → fail → implement → pass → commit. One commit per tool file.

```bash
git commit -m "feat: add game tools (add_game, update_game, add_formalization, add_escalation_ladder, add_strategy, set_payoff)"
git commit -m "feat: add history tools (add_repeated_game_entry, add_trust_assessment, update_trust_assessment, add_dynamic_inconsistency_risk, add_repeated_game_pattern, update_escalation_ladder)"
git commit -m "feat: add assumption tools (add_assumption, update_assumption, add_contradiction, add_latent_factor)"
git commit -m "feat: add scenario tools (add_scenario, update_scenario, add_tail_risk, add_central_thesis, update_central_thesis, add_eliminated_outcome, add_signal_classification)"
git commit -m "feat: add workflow tools (propose_revision, check_disruption_triggers, add_cross_game_link)"
git commit -m "feat: add read tools (get_entity, list_entities)"
```

---

## Chunk 3: Provider Adapters

### Task 8: Anthropic provider adapter

**Files:**

- Create: `shared/game-theory/providers/anthropic-adapter.ts`
- Create: `shared/game-theory/providers/anthropic-adapter.test.ts`
- Create: `shared/game-theory/providers/types.ts` (shared provider types)

- [ ] **Step 1: Write the failing tests**

```typescript
// shared/game-theory/providers/anthropic-adapter.test.ts
import { describe, it, expect } from "vitest";
import { createAnthropicAdapter } from "./anthropic-adapter";

describe("AnthropicAdapter", () => {
  const adapter = createAnthropicAdapter();

  it("has correct capabilities", () => {
    expect(adapter.capabilities).toEqual({
      toolUse: true,
      webSearch: true,
      compaction: true,
    });
  });

  it("formats request with tools and system prompt", () => {
    const request = adapter.formatRequest({
      system: "You are an analyst",
      messages: [{ role: "user", content: "Analyze X" }],
      tools: [
        {
          name: "add_player",
          description: "Add a player",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" } },
          },
          execute: () => ({ success: true, data: null }),
        },
      ],
      enableWebSearch: true,
    });

    // Anthropic format: tools array with input_schema
    const req = request as any;
    expect(req.system).toBe("You are an analyst");
    expect(req.messages).toHaveLength(1);
    expect(req.tools).toBeDefined();
    expect(req.tools.length).toBeGreaterThanOrEqual(1);
    // Should include web_search tool when enabled
    const toolNames = req.tools.map((t: any) => t.name);
    expect(toolNames).toContain("add_player");
    expect(toolNames).toContain("web_search");
  });

  it("formats request with compaction config", () => {
    const request = adapter.formatRequest({
      system: "test",
      messages: [{ role: "user", content: "test" }],
      tools: [],
      contextManagement: { enabled: true },
    });
    const req = request as any;
    expect(req.context_management).toBeDefined();
  });

  it("formats tool results as tool_result content block", () => {
    const message = adapter.formatToolResult("call_123", {
      success: true,
      data: { id: "player_1", kind: "add_player" },
    });
    expect(message.role).toBe("tool_result");
    const blocks = message.content as any[];
    expect(blocks[0].type).toBe("tool_result");
    expect(blocks[0].tool_use_id).toBe("call_123");
  });

  it("parses text delta stream chunk", () => {
    const events = adapter.parseStreamChunk({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "hello" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: "text", content: "hello" });
  });

  it("parses tool_use stream chunk", () => {
    const events = adapter.parseStreamChunk({
      type: "content_block_start",
      content_block: {
        type: "tool_use",
        id: "call_1",
        name: "add_player",
        input: {},
      },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe("tool_call");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the implementation**

The adapter translates between the app's `NormalizedMessage` / `ToolDefinition` types and Anthropic's Messages API format. Key mappings:

- `ToolDefinition` → `{ name, description, input_schema }` (Anthropic tool format)
- `tool_use` content block → `NormalizedToolCall`
- `ToolResult` → `tool_result` content block
- Web search: add `{ type: 'web_search_20250305', name: 'web_search' }` to tools array
- Compaction: add `context_management: { edits: ['compact_20260112'] }`
- Streaming: parse `content_block_start`, `content_block_delta`, `message_delta` SSE events

```typescript
// shared/game-theory/providers/anthropic-adapter.ts
import type {
  ProviderAdapter,
  NormalizedMessage,
  NormalizedContentBlock,
  ToolDefinition,
  ToolResult,
  AgentEvent,
  ContextManagementConfig,
} from "../types/agent";

export function createAnthropicAdapter(): ProviderAdapter {
  return {
    name: "anthropic",
    capabilities: { toolUse: true, webSearch: true, compaction: true },

    formatRequest({
      system,
      messages,
      tools,
      contextManagement,
      enableWebSearch,
    }) {
      const anthropicTools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));

      if (enableWebSearch) {
        anthropicTools.push({
          name: "web_search",
          description: "Search the web for current information.",
          input_schema: { type: "web_search_20250305" } as any,
        } as any);
      }

      const request: Record<string, unknown> = {
        model: "claude-sonnet-4-6",
        max_tokens: 16384,
        system,
        messages: messages.map(formatMessage),
        tools: anthropicTools,
      };

      if (contextManagement?.enabled) {
        request.context_management = {
          edits: ["compact_20260112"],
        };
      }

      return request;
    },

    parseStreamChunk(chunk: unknown): AgentEvent[] {
      const event = chunk as Record<string, unknown>;
      const type = event.type as string;

      if (type === "content_block_delta") {
        const delta = event.delta as Record<string, unknown>;
        if (delta.type === "text_delta") {
          return [{ type: "text", content: delta.text as string }];
        }
        if (delta.type === "thinking_delta") {
          return [{ type: "thinking", content: delta.thinking as string }];
        }
        if (delta.type === "input_json_delta") {
          // Accumulate tool input — handled by caller
          return [];
        }
      }

      if (type === "content_block_start") {
        const block = event.content_block as Record<string, unknown>;
        if (block.type === "tool_use") {
          return [
            {
              type: "tool_call",
              id: block.id as string,
              name: block.name as string,
              input: (block.input as Record<string, unknown>) ?? {},
            },
          ];
        }
      }

      if (type === "message_stop") {
        return [{ type: "done", content: "" }];
      }

      return [];
    },

    formatToolResult(
      toolCallId: string,
      result: ToolResult,
    ): NormalizedMessage {
      const content = result.success
        ? JSON.stringify(result.data)
        : JSON.stringify({ error: result.error });

      return {
        role: "tool_result",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolCallId,
            content,
          },
        ],
      };
    },
  };
}

function formatMessage(msg: NormalizedMessage): Record<string, unknown> {
  if (typeof msg.content === "string") {
    return {
      role: msg.role === "tool_result" ? "user" : msg.role,
      content: msg.content,
    };
  }

  return {
    role: msg.role === "tool_result" ? "user" : msg.role,
    content: (msg.content as NormalizedContentBlock[]).map((block) => {
      if (block.type === "tool_result") {
        return {
          type: "tool_result",
          tool_use_id: block.tool_use_id,
          content: block.content,
        };
      }
      if (block.type === "tool_use") {
        return {
          type: "tool_use",
          id: block.id,
          name: block.name,
          input: block.input,
        };
      }
      return { type: "text", text: block.text ?? "" };
    }),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add shared/game-theory/providers/
git commit -m "feat: add Anthropic provider adapter with tool_use, web search, and compaction support"
```

---

### Task 9: OpenAI provider adapter

**Files:**

- Create: `shared/game-theory/providers/openai-adapter.ts`
- Create: `shared/game-theory/providers/openai-adapter.test.ts`

Same pattern as Task 8 but mapping to OpenAI's function calling format. Key differences:

- Tools format: `{ type: 'function', function: { name, description, parameters } }`
- Tool results: `{ role: 'tool', tool_call_id, content }`
- Web search: `{ type: 'web_search_preview' }` in tools
- Compaction: `context_management: { compact_threshold: ... }`
- Streaming: parse `response.output_text.delta`, `response.function_call_arguments.delta`

- [ ] **Steps 1-5:** Write tests → fail → implement → pass → commit

```bash
git commit -m "feat: add OpenAI provider adapter with function calling, web search, and compaction"
```

---

### Task 10: Generic (degraded) adapter + adapter factory

**Files:**

- Create: `shared/game-theory/providers/generic-adapter.ts`
- Create: `shared/game-theory/providers/adapter-factory.ts`
- Create: `shared/game-theory/providers/adapter-factory.test.ts`

The factory selects the right adapter based on provider name.

```typescript
// shared/game-theory/providers/adapter-factory.ts
import type { ProviderAdapter } from "../types/agent";
import { createAnthropicAdapter } from "./anthropic-adapter";
import { createOpenAIAdapter } from "./openai-adapter";
import { createGenericAdapter } from "./generic-adapter";

export function createProviderAdapter(provider: string): ProviderAdapter {
  switch (provider) {
    case "anthropic":
      return createAnthropicAdapter();
    case "openai":
      return createOpenAIAdapter();
    default:
      return createGenericAdapter(provider);
  }
}
```

- [ ] **Steps 1-5:** Write tests → fail → implement → pass → commit

```bash
git commit -m "feat: add generic adapter (degraded mode) and provider adapter factory"
```

---

## Chunk 4: Agent Loop Endpoint

### Task 11: Agent loop core

**Files:**

- Create: `server/api/ai/agent.ts`
- Create: `shared/game-theory/agent/loop.ts`
- Create: `shared/game-theory/agent/loop.test.ts`

The agent loop is the core of the system. It's separated into:

- `shared/game-theory/agent/loop.ts` — pure logic (testable without Nitro)
- `server/api/ai/agent.ts` — Nitro endpoint that wires the loop to HTTP/SSE

- [ ] **Step 1: Write the failing tests for the loop**

```typescript
// shared/game-theory/agent/loop.test.ts
import { describe, it, expect, vi } from "vitest";
import { runAgentLoop, type AgentLoopDeps } from "./loop";
import type { AgentEvent } from "../types/agent";
import { createEmptyCanonicalStore } from "../engine/canonical-store";

function makeMockDeps(
  responses: Array<{
    textChunks?: string[];
    toolCalls?: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }>;
  }>,
): AgentLoopDeps {
  let callIndex = 0;

  return {
    callProvider: vi.fn(async function* () {
      const response = responses[callIndex] ?? { textChunks: ["Done."] };
      callIndex++;

      if (response.toolCalls) {
        for (const tc of response.toolCalls) {
          yield {
            type: "tool_call" as const,
            id: tc.id,
            name: tc.name,
            input: tc.input,
          };
        }
      }
      if (response.textChunks) {
        for (const text of response.textChunks) {
          yield { type: "text" as const, content: text };
        }
      }
    }),
    executeTool: vi.fn(async (name, input) => ({
      success: true as const,
      data: { id: "entity_1", kind: name },
    })),
    onEvent: vi.fn(),
    config: {
      maxIterations: 10,
      inactivityTimeoutMs: 5000,
      enableWebSearch: false,
    },
  };
}

describe("runAgentLoop", () => {
  it("streams text when no tool calls", async () => {
    const deps = makeMockDeps([{ textChunks: ["Hello world"] }]);
    await runAgentLoop(deps, new AbortController().signal);

    const events = (deps.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    ) as AgentEvent[];
    expect(events.some((e) => e.type === "text")).toBe(true);
    expect(events.some((e) => e.type === "done")).toBe(true);
  });

  it("executes tool calls and continues", async () => {
    const deps = makeMockDeps([
      { toolCalls: [{ id: "tc1", name: "add_player", input: { name: "US" } }] },
      { textChunks: ["Player added."] },
    ]);
    await runAgentLoop(deps, new AbortController().signal);

    expect(deps.executeTool).toHaveBeenCalledWith("add_player", { name: "US" });
    const events = (deps.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    ) as AgentEvent[];
    expect(events.some((e) => e.type === "tool_call")).toBe(true);
    expect(events.some((e) => e.type === "tool_result")).toBe(true);
    expect(events.some((e) => e.type === "text")).toBe(true);
  });

  it("respects maxIterations", async () => {
    // Every response has a tool call — should stop after maxIterations
    const infiniteToolCalls = Array.from({ length: 15 }, () => ({
      toolCalls: [{ id: "tc", name: "add_player", input: { name: "X" } }],
    }));
    const deps = makeMockDeps(infiniteToolCalls);
    deps.config.maxIterations = 3;

    await runAgentLoop(deps, new AbortController().signal);

    expect(
      (deps.callProvider as ReturnType<typeof vi.fn>).mock.calls.length,
    ).toBeLessThanOrEqual(4);
    const events = (deps.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    ) as AgentEvent[];
    const doneEvent = events.find(
      (e) => e.type === "done" || e.type === "text",
    );
    expect(doneEvent).toBeDefined();
  });

  it("stops on abort signal", async () => {
    const controller = new AbortController();
    const deps = makeMockDeps([
      { toolCalls: [{ id: "tc1", name: "add_player", input: {} }] },
    ]);

    // Abort after first tool call
    const originalExecute = deps.executeTool as ReturnType<typeof vi.fn>;
    deps.executeTool = vi.fn(async (...args) => {
      controller.abort();
      return originalExecute(...args);
    });

    await runAgentLoop(deps, controller.signal);

    const events = (deps.onEvent as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0],
    ) as AgentEvent[];
    expect(events.some((e) => e.type === "done")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Write the implementation**

```typescript
// shared/game-theory/agent/loop.ts
import type { AgentEvent, AgentLoopConfig, ToolResult } from "../types/agent";

export interface AgentLoopDeps {
  callProvider: (iteration: number) => AsyncGenerator<AgentEvent>;
  executeTool: (
    name: string,
    input: Record<string, unknown>,
  ) => Promise<ToolResult>;
  onEvent: (event: AgentEvent) => void;
  config: AgentLoopConfig;
}

export async function runAgentLoop(
  deps: AgentLoopDeps,
  abortSignal: AbortSignal,
): Promise<void> {
  let iteration = 0;

  while (!abortSignal.aborted) {
    if (iteration >= deps.config.maxIterations) {
      deps.onEvent({
        type: "text",
        content:
          "\n\nPausing — reached iteration limit. Send another message to continue.",
      });
      deps.onEvent({ type: "done", content: "" });
      return;
    }

    const pendingToolCalls: Array<{
      id: string;
      name: string;
      input: Record<string, unknown>;
    }> = [];
    let hasText = false;

    const stream = deps.callProvider(iteration);

    for await (const event of stream) {
      if (abortSignal.aborted) break;

      if (event.type === "tool_call") {
        pendingToolCalls.push({
          id: event.id,
          name: event.name,
          input: event.input,
        });
      }

      deps.onEvent(event);

      if (event.type === "text") {
        hasText = true;
      }
    }

    if (abortSignal.aborted) {
      deps.onEvent({ type: "done", content: "" });
      return;
    }

    // If there were tool calls, execute them and continue the loop
    if (pendingToolCalls.length > 0) {
      for (const toolCall of pendingToolCalls) {
        if (abortSignal.aborted) break;

        const startTime = Date.now();
        const result = await deps.executeTool(toolCall.name, toolCall.input);
        const durationMs = Date.now() - startTime;

        deps.onEvent({
          type: "tool_result",
          id: toolCall.id,
          result: result.success ? result.data : { error: result.error },
          duration_ms: durationMs,
        });
      }

      iteration++;
      continue;
    }

    // No tool calls — the agent is done
    deps.onEvent({ type: "done", content: "" });
    return;
  }

  deps.onEvent({ type: "done", content: "" });
}
```

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add shared/game-theory/agent/loop.ts shared/game-theory/agent/loop.test.ts
git commit -m "feat: add agent loop with tool execution, maxIterations, and abort support"
```

---

### Task 12: Nitro agent endpoint

**Files:**

- Create: `server/api/ai/agent.ts`

This endpoint:

1. Receives POST with `{ messages, provider, model?, enableWebSearch? }`
2. Creates a provider adapter via factory
3. Loads system prompt and tool registry
4. Builds a `ToolContext` from the request (canonical state passed from client, or loaded from server state)
5. Runs the agent loop, streaming `AgentEvent`s as SSE
6. Returns the stream

- [ ] **Step 1: Write the endpoint**

```typescript
// server/api/ai/agent.ts
import { defineEventHandler, readBody, setResponseHeaders } from "h3";
import { z } from "zod";
import { createProviderAdapter } from "shared/game-theory/providers/adapter-factory";
import { createToolRegistry } from "shared/game-theory/tools/registry";
import { createEvidenceTools } from "shared/game-theory/tools/evidence-tools";
import {
  createGetAnalysisStatusTool,
  createGetMethodologyPhaseTool,
} from "shared/game-theory/tools/analysis-tools";
// Import other tool creators as they're built
import { loadSystemPrompt } from "shared/game-theory/prompts/loader";
import { runAgentLoop } from "shared/game-theory/agent/loop";
import { DEFAULT_AGENT_LOOP_CONFIG } from "shared/game-theory/types/agent";
import type {
  AgentEvent,
  NormalizedMessage,
  ToolContext,
} from "shared/game-theory/types/agent";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "tool_result"]),
        content: z.unknown(),
      }),
    )
    .min(1),
  provider: z.string().default("anthropic"),
  model: z.string().optional(),
  enableWebSearch: z.boolean().default(true),
  maxIterations: z.number().int().min(1).max(500).optional(),
  // Canonical state is passed from the client so the server can execute tools
  canonical: z.record(z.unknown()).optional(),
});

export default defineEventHandler(async (event) => {
  const body = bodySchema.parse(await readBody(event));

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const adapter = createProviderAdapter(body.provider);
  const systemPrompt = loadSystemPrompt();

  // Build tool registry
  const registry = createToolRegistry();
  for (const tool of createEvidenceTools()) {
    registry.register(tool);
  }
  registry.register(createGetAnalysisStatusTool());
  registry.register(createGetMethodologyPhaseTool());
  // Register other tools as they're built

  const config = {
    ...DEFAULT_AGENT_LOOP_CONFIG,
    enableWebSearch: body.enableWebSearch,
    ...(body.maxIterations ? { maxIterations: body.maxIterations } : {}),
  };

  const encoder = new TextEncoder();
  const conversationMessages: NormalizedMessage[] =
    body.messages as NormalizedMessage[];

  const stream = new ReadableStream({
    async start(controller) {
      function emit(agentEvent: AgentEvent) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(agentEvent)}\n\n`),
          );
        } catch {
          // Stream closed
        }
      }

      // Ping to keep connection alive
      const pingTimer = setInterval(() => {
        emit({ type: "ping", content: "" });
      }, 15_000);

      try {
        // TODO: Build ToolContext from canonical state passed in body
        // For now, this is a placeholder — Phase 2 (chat panel UI) will
        // wire this to the actual Zustand store state
        const toolContext: ToolContext = {
          canonical: (body.canonical ?? {}) as any,
          dispatch: () => {
            throw new Error("Dispatch not wired yet");
          },
          getAnalysisState: () => null,
          getDerivedState: () => ({ solverResults: {} }) as any,
        };

        await runAgentLoop(
          {
            callProvider: async function* (iteration) {
              const messagesForProvider = [...conversationMessages];

              const request = adapter.formatRequest({
                system: systemPrompt,
                messages: messagesForProvider,
                tools: registry.listAll(),
                contextManagement: { enabled: adapter.capabilities.compaction },
                enableWebSearch:
                  config.enableWebSearch && adapter.capabilities.webSearch,
              });

              // TODO: Actually call the provider API here
              // For now, yield a placeholder response
              yield {
                type: "text" as const,
                content:
                  "Agent loop endpoint is working. Provider call not yet wired.",
              };
            },
            executeTool: async (name, input) => {
              const tool = registry.get(name);
              if (!tool) {
                return { success: false, error: `Unknown tool: ${name}` };
              }
              return tool.execute(input, toolContext);
            },
            onEvent: emit,
            config,
          },
          new AbortController().signal,
        );
      } catch (error) {
        emit({
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
      } finally {
        clearInterval(pingTimer);
        controller.close();
      }
    },
  });

  return new Response(stream);
});
```

- [ ] **Step 2: Verify the endpoint starts** (manual test — run `bun --bun vite dev --port 3000` and curl the endpoint)

```bash
curl -X POST http://localhost:3000/api/ai/agent \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Analyze US vs China trade war"}],"provider":"anthropic"}'
```

Expected: SSE stream with at least a text event and done event.

- [ ] **Step 3: Commit**

```bash
git add server/api/ai/agent.ts
git commit -m "feat: add agent loop Nitro endpoint with SSE streaming"
```

---

### Task 13: Wire provider API calls into the agent loop

**Files:**

- Modify: `server/api/ai/agent.ts`
- Create: `shared/game-theory/providers/anthropic-client.ts`

This task connects the agent loop to the actual Anthropic Messages API using the `@anthropic-ai/sdk` package (already installed).

- [ ] **Step 1: Write the streaming provider client**

```typescript
// shared/game-theory/providers/anthropic-client.ts
import Anthropic from "@anthropic-ai/sdk";
import type { AgentEvent } from "../types/agent";
import { createAnthropicAdapter } from "./anthropic-adapter";

const adapter = createAnthropicAdapter();

export async function* streamAnthropicChat(
  request: Record<string, unknown>,
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic();

  const stream = client.messages.stream(request as any, {
    signal: abortSignal,
  });

  for await (const event of stream) {
    const parsed = adapter.parseStreamChunk(event);
    for (const agentEvent of parsed) {
      yield agentEvent;
    }
  }
}
```

- [ ] **Step 2: Update the agent endpoint** to use `streamAnthropicChat` in the `callProvider` function instead of the placeholder.

- [ ] **Step 3: Test end-to-end** with a real API key:

```bash
ANTHROPIC_API_KEY=sk-... curl -X POST http://localhost:3000/api/ai/agent \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Hello, what tools do you have?"}],"provider":"anthropic"}'
```

Expected: Streaming text response from Claude listing available tools.

- [ ] **Step 4: Commit**

```bash
git add shared/game-theory/providers/anthropic-client.ts server/api/ai/agent.ts
git commit -m "feat: wire Anthropic Messages API streaming into agent loop"
```

---

## Chunk 5: Integration Test + Remaining Prompt Files

### Task 14: End-to-end integration test

**Files:**

- Create: `shared/game-theory/agent/integration.test.ts`

An integration test that:

1. Creates a tool registry with evidence + analysis tools
2. Creates a mock provider that returns tool calls
3. Runs the agent loop
4. Verifies entities were created in the canonical store

- [ ] **Steps 1-5:** Write test → fail → implement any remaining glue → pass → commit

```bash
git commit -m "test: add agent loop integration test with tool execution"
```

---

### Task 15: Remaining phase methodology files

**Files:**

- Create: `shared/game-theory/prompts/phases/phase-2.md` through `phase-10.md`

Extract each phase's section from `docs/game-theory-analytical-methodology.md` into its own file. Add a "Tools to use" footer to each, similar to Phase 1.

- [ ] **Step 1: Extract and create all phase files**

- [ ] **Step 2: Verify loader works for all phases**

Run: `npx vitest run shared/game-theory/prompts/loader.test.ts`

- [ ] **Step 3: Commit**

```bash
git add shared/game-theory/prompts/phases/
git commit -m "docs: add phase methodology files (phases 2-10) for agent system prompt"
```

---

### Task 16: Tool description .md files

**Files:**

- Create: `shared/game-theory/prompts/tools/add_source.md`, `add_player.md`, `get_analysis_status.md`, etc.

One file per tool. These are loaded at startup and injected into the tool's `description` field. Keep them short (2-4 sentences) — they're included in every API call.

- [ ] **Step 1: Create description files for all tools**

- [ ] **Step 2: Update tool registration to load descriptions from .md files**

Modify each tool creator function to accept an optional description override, defaulting to the .md file content.

- [ ] **Step 3: Commit**

```bash
git add shared/game-theory/prompts/tools/
git commit -m "docs: add tool description .md files for all agent tools"
```

---

## File Structure Summary

```
shared/game-theory/
├── types/
│   └── agent.ts                          # AgentEvent, ToolDefinition, ProviderAdapter types
├── tools/
│   ├── registry.ts                       # ToolRegistry (register, get, listAll, getSchemas)
│   ├── evidence-tools.ts                 # add_source, add_observation, add_claim, add_inference, add_derivation
│   ├── player-tools.ts                   # add_player, update_player, add_player_objective, update_information_state
│   ├── game-tools.ts                     # add_game, update_game, add_formalization, add_escalation_ladder, add_strategy, set_payoff
│   ├── history-tools.ts                  # add_repeated_game_entry, add_trust_assessment, update_trust_assessment, etc.
│   ├── assumption-tools.ts              # add_assumption, update_assumption, add_contradiction, add_latent_factor
│   ├── scenario-tools.ts               # add_scenario, update_scenario, add_tail_risk, add_central_thesis, etc.
│   ├── workflow-tools.ts               # propose_revision, check_disruption_triggers, add_cross_game_link
│   ├── read-tools.ts                    # get_entity, list_entities
│   └── analysis-tools.ts               # get_analysis_status, get_methodology_phase
├── providers/
│   ├── anthropic-adapter.ts             # Anthropic Messages API adapter
│   ├── anthropic-client.ts              # Streaming Anthropic API client
│   ├── openai-adapter.ts               # OpenAI Responses API adapter
│   ├── generic-adapter.ts              # Degraded mode adapter
│   └── adapter-factory.ts             # createProviderAdapter(provider) factory
├── agent/
│   └── loop.ts                          # runAgentLoop() core logic
└── prompts/
    ├── system.md                        # Condensed system prompt
    ├── loader.ts                        # loadSystemPrompt, loadPhaseMethodology, loadToolDescription
    ├── phases/
    │   ├── phase-1.md through phase-10.md
    └── tools/
        ├── add_source.md, add_player.md, etc.

server/api/ai/
└── agent.ts                             # Nitro SSE endpoint wiring loop + tools + provider
```

---

## Follow-On Plans

This plan covers **Migration Phase 1** from the spec. The remaining phases should each get their own plan:

- **Phase 2: Chat Panel UI** — Floating panel component, message rendering (text/thinking/tool calls), SSE client, model selector, Stop button
- **Phase 3: Analysis Views Integration** — Entity-based phase progress, real-time view updates on tool execution, propose_revision UI flow
- **Phase 4: Polish + Prompt Tuning** — System prompt iteration, tool description iteration, multi-provider testing, compaction indicators
