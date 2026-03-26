/**
 * Shared test fixtures and factory functions for integration tests.
 * Extracted from individual test files to provide a single source of truth.
 */

import type { MethodologyPhase } from "../../shared/types/methodology";

// ── Service reset ──

export async function resetAllServices(): Promise<void> {
  const [
    entityGraph,
    runtimeStatus,
    revalidation,
    orchestrator,
    commandHandlers,
    workspaceDb,
  ] = await Promise.all([
    import("../services/entity-graph-service"),
    import("../services/runtime-status"),
    import("../services/revalidation-service"),
    import("../agents/analysis-agent"),
    import("../services/command-handlers"),
    import("../services/workspace/workspace-db"),
  ]);
  // Ensure entity-graph-service can reach the workspace database in tests
  entityGraph._bindWorkspaceDatabaseForInit(workspaceDb.getWorkspaceDatabase);
  entityGraph._resetForTest();
  runtimeStatus._resetForTest();
  revalidation._resetForTest();
  orchestrator._resetForTest();
  commandHandlers._resetForTest();
}

// ── Provenance helpers ──

export const defaultProvenance = {
  source: "phase-derived" as const,
  runId: "test-run-1",
  phase: "situational-grounding" as const,
};

export function makeProvenance(
  phase: string,
  runId = "test-run-1",
  source: "phase-derived" | "user-edited" = "phase-derived",
) {
  return { source, runId, phase };
}

// ── Entity factories (for entity-graph-service) ──

export function makeFactData(overrides?: Partial<Record<string, unknown>>) {
  return {
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: "A fact",
      category: "action" as const,
      ...((overrides as Record<string, unknown>) ?? {}),
    },
    confidence: "high" as const,
    rationale: "test rationale",
    revision: 1,
    stale: false,
  };
}

export function makePlayerData(overrides?: { name?: string }) {
  return {
    type: "player" as const,
    phase: "player-identification" as const,
    data: {
      type: "player" as const,
      name: overrides?.name ?? "USA",
      playerType: "primary" as const,
      knowledge: [],
    },
    confidence: "high" as const,
    rationale: "primary actor",
    revision: 1,
    stale: false,
  };
}

// ── Phase output factories (for adapter mock responses & commitPhaseSnapshot) ──

export function makeFactOutput(overrides?: {
  id?: string | null;
  ref?: string;
  content?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "fact-ref",
    type: "fact" as const,
    phase: "situational-grounding" as const,
    data: {
      type: "fact" as const,
      date: "2026-03-19",
      source: "test",
      content: overrides?.content ?? "A fact",
      category: "action" as const,
    },
    confidence: "high" as const,
    rationale: `rationale:${overrides?.content ?? "A fact"}`,
  };
}

export function makePlayerOutput(overrides?: {
  id?: string | null;
  ref?: string;
  name?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "player-ref",
    type: "player" as const,
    phase: "player-identification" as const,
    data: {
      type: "player" as const,
      name: overrides?.name ?? "Country A",
      playerType: "primary" as const,
      knowledge: ["Own tariff schedule"],
    },
    confidence: "high" as const,
    rationale: "Initiator of the tariff action",
  };
}

export function makeObjectiveOutput(overrides?: {
  id?: string | null;
  ref?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "obj-ref",
    type: "objective" as const,
    phase: "player-identification" as const,
    data: {
      type: "objective" as const,
      description: "Protect domestic steel industry",
      priority: "high" as const,
      stability: "stable" as const,
    },
    confidence: "high" as const,
    rationale: "Stated policy goal",
  };
}

export function makeGameOutput(overrides?: {
  id?: string | null;
  ref?: string;
}) {
  return {
    id: overrides?.id ?? null,
    ref: overrides?.ref ?? "game-ref",
    type: "game" as const,
    phase: "baseline-model" as const,
    data: {
      type: "game" as const,
      name: "Steel Trade War",
      gameType: "chicken" as const,
      timing: "sequential" as const,
      description: "Escalation game between two trading nations",
    },
    confidence: "medium" as const,
    rationale: "Fits chicken structure",
  };
}

// ── Complete phase output fixtures (valid adapter responses) ──

export const PHASE_FIXTURES: Partial<
  Record<MethodologyPhase, { entities: unknown[]; relationships: unknown[] }>
> = {
  "situational-grounding": {
    entities: [
      {
        id: null,
        ref: "fact-1",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2025-06-15",
          source: "Reuters",
          content: "Country A imposed 25% tariffs on Country B steel imports",
          category: "action",
        },
        confidence: "high",
        rationale: "Confirmed by official trade records",
      },
      {
        id: null,
        ref: "fact-2",
        type: "fact",
        phase: "situational-grounding",
        data: {
          type: "fact",
          date: "2025-06-20",
          source: "Bloomberg",
          content: "Country B steel exports dropped 40% in the first week",
          category: "economic",
        },
        confidence: "medium",
        rationale: "Early data, may be revised",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "precedes",
        fromEntityId: "fact-1",
        toEntityId: "fact-2",
      },
    ],
  },

  "player-identification": {
    entities: [
      {
        id: null,
        ref: "player-a",
        type: "player",
        phase: "player-identification",
        data: {
          type: "player",
          name: "Country A",
          playerType: "primary",
          knowledge: ["Own tariff schedule"],
        },
        confidence: "high",
        rationale: "Initiator of the tariff action",
      },
      {
        id: null,
        ref: "obj-a1",
        type: "objective",
        phase: "player-identification",
        data: {
          type: "objective",
          description: "Protect domestic steel industry",
          priority: "high",
          stability: "stable",
        },
        confidence: "high",
        rationale: "Stated policy goal",
      },
    ],
    relationships: [
      {
        id: "rel-1",
        type: "has-objective",
        fromEntityId: "player-a",
        toEntityId: "obj-a1",
      },
    ],
  },

  "baseline-model": {
    entities: [
      {
        id: null,
        ref: "game-1",
        type: "game",
        phase: "baseline-model",
        data: {
          type: "game",
          name: "Steel Trade War",
          gameType: "chicken",
          timing: "sequential",
          description: "Escalation game between two trading nations",
        },
        confidence: "medium",
        rationale: "Fits chicken structure",
      },
    ],
    relationships: [],
  },

  assumptions: {
    entities: [
      {
        id: null,
        ref: "assumption-1",
        type: "assumption",
        phase: "assumptions",
        data: {
          type: "assumption",
          description: "Both players are rational utility maximizers",
          sensitivity: "critical",
          category: "rationality",
          classification: "game-theoretic",
          correlatedClusterId: "cluster-rationality",
          rationale: "Foundation of all game-theoretic predictions",
          dependencies: ["game-1", "player-a"],
        },
        confidence: "medium",
        rationale:
          "Standard assumption but may not hold under domestic pressure",
      },
    ],
    relationships: [],
  },
};

/**
 * Returns a deep-cloned phase output fixture for use in tests.
 */
export function getPhaseFixture(phase: MethodologyPhase) {
  const fixture = PHASE_FIXTURES[phase];
  if (!fixture) {
    throw new Error(
      `No fixture for phase "${phase}". Available: ${Object.keys(PHASE_FIXTURES).join(", ")}`,
    );
  }
  return JSON.parse(JSON.stringify(fixture));
}
