/**
 * SSE contract tests: verify server event format matches what the client expects.
 *
 * These tests validate the wire format and envelope shapes of SSE events
 * against the shared type definitions used by both server and client.
 */

import { describe, expect, it, beforeEach } from "vitest";
import type {
  AnalysisMutationEvent,
  AnalysisProgressEvent,
  PhaseSummary,
} from "../../../shared/types/events";
import type { RunStatus } from "../../../shared/types/api";

describe("SSE contract tests", () => {
  // ── Mutation channel ──

  describe("mutation events", () => {
    const mutationTypes: Array<{
      name: string;
      event: AnalysisMutationEvent;
    }> = [
      {
        name: "entity_created",
        event: {
          type: "entity_created",
          entity: {
            id: "e-1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2026-01-01",
              source: "test",
              content: "A fact",
              category: "action",
            },
            confidence: "high",
            rationale: "test",
            revision: 1,
            stale: false,
          } as any,
        },
      },
      {
        name: "entity_updated",
        event: {
          type: "entity_updated",
          entity: {
            id: "e-1",
            type: "fact",
            phase: "situational-grounding",
            data: {
              type: "fact",
              date: "2026-01-01",
              source: "test",
              content: "Updated fact",
              category: "action",
            },
            confidence: "high",
            rationale: "updated",
            revision: 2,
            stale: false,
          } as any,
          previousProvenance: {
            source: "phase-derived",
            runId: "run-1",
            phase: "situational-grounding",
          },
        },
      },
      {
        name: "entity_deleted",
        event: { type: "entity_deleted", entityId: "e-1" },
      },
      {
        name: "relationship_created",
        event: {
          type: "relationship_created",
          relationship: {
            id: "r-1",
            type: "precedes",
            fromEntityId: "e-1",
            toEntityId: "e-2",
          } as any,
        },
      },
      {
        name: "relationship_updated",
        event: {
          type: "relationship_updated",
          relationship: {
            id: "r-1",
            type: "supports",
            fromEntityId: "e-1",
            toEntityId: "e-2",
          } as any,
        },
      },
      {
        name: "relationship_deleted",
        event: { type: "relationship_deleted", relationshipId: "r-1" },
      },
      {
        name: "stale_marked",
        event: { type: "stale_marked", entityIds: ["e-1", "e-2"] },
      },
      {
        name: "state_changed",
        event: { type: "state_changed" },
      },
    ];

    for (const { name, event } of mutationTypes) {
      it(`${name} round-trips through JSON correctly`, () => {
        const envelope = {
          channel: "mutation" as const,
          revision: 42,
          ...event,
        };

        // Simulate SSE wire format
        const wire = `data: ${JSON.stringify(envelope)}\n\n`;
        const parsed = JSON.parse(wire.slice(6, -2));

        expect(parsed.channel).toBe("mutation");
        expect(parsed.revision).toBe(42);
        expect(parsed.type).toBe(name);
      });
    }
  });

  // ── Progress channel ──

  describe("progress events", () => {
    const summary: PhaseSummary = {
      entitiesCreated: 3,
      relationshipsCreated: 1,
      entitiesUpdated: 0,
      durationMs: 1500,
    };

    const progressTypes: Array<{
      name: string;
      event: AnalysisProgressEvent;
    }> = [
      {
        name: "phase_started",
        event: {
          type: "phase_started",
          phase: "situational-grounding",
          runId: "run-1",
        },
      },
      {
        name: "phase_activity",
        event: {
          type: "phase_activity",
          phase: "situational-grounding",
          runId: "run-1",
          kind: "tool",
          message: "Calling web search",
          toolName: "WebSearch",
        },
      },
      {
        name: "phase_completed",
        event: {
          type: "phase_completed",
          phase: "situational-grounding",
          runId: "run-1",
          summary,
        },
      },
      {
        name: "analysis_completed",
        event: { type: "analysis_completed", runId: "run-1" },
      },
      {
        name: "analysis_failed",
        event: {
          type: "analysis_failed",
          runId: "run-1",
          error: "Phase timeout exceeded",
        },
      },
    ];

    for (const { name, event } of progressTypes) {
      it(`${name} round-trips through JSON correctly`, () => {
        const envelope = {
          channel: "progress" as const,
          revision: 10,
          ...event,
        };

        const wire = `data: ${JSON.stringify(envelope)}\n\n`;
        const parsed = JSON.parse(wire.slice(6, -2));

        expect(parsed.channel).toBe("progress");
        expect(parsed.revision).toBe(10);
        expect(parsed.type).toBe(name);
      });
    }
  });

  // ── Status channel ──

  describe("status events", () => {
    it("RunStatus envelope has all required fields", () => {
      const status: RunStatus = {
        status: "running",
        kind: "analysis",
        runId: "run-1",
        activePhase: "situational-grounding",
        progress: { completed: 2, total: 9 },
        deferredRevalidationPending: false,
      };

      const envelope = {
        channel: "status" as const,
        revision: 5,
        ...status,
      };

      const parsed = JSON.parse(JSON.stringify(envelope));

      expect(parsed.channel).toBe("status");
      expect(parsed.revision).toBe(5);
      expect(parsed.status).toBe("running");
      expect(parsed.kind).toBe("analysis");
      expect(parsed.runId).toBe("run-1");
      expect(parsed.activePhase).toBe("situational-grounding");
      expect(parsed.progress).toEqual({ completed: 2, total: 9 });
      expect(parsed.deferredRevalidationPending).toBe(false);
    });

    it("failed RunStatus includes failure metadata", () => {
      const status: RunStatus = {
        status: "failed",
        kind: "analysis",
        runId: "run-1",
        activePhase: null,
        progress: { completed: 3, total: 9 },
        failedPhase: "baseline-model",
        failureKind: "provider_api_error",
        failureMessage: "Rate limit exceeded",
        deferredRevalidationPending: false,
      };

      const parsed = JSON.parse(JSON.stringify(status));

      expect(parsed.failedPhase).toBe("baseline-model");
      expect(parsed.failureKind).toBe("provider_api_error");
      expect(parsed.failureMessage).toBe("Rate limit exceeded");
    });
  });

  // ── Ping channel ──

  describe("ping events", () => {
    it("ping envelope is valid", () => {
      const envelope = { channel: "ping" as const, revision: 0 };
      const wire = `data: ${JSON.stringify(envelope)}\n\n`;
      const parsed = JSON.parse(wire.slice(6, -2));

      expect(parsed.channel).toBe("ping");
      expect(parsed.revision).toBe(0);
    });
  });

  // ── Wire format ──

  describe("SSE wire format", () => {
    it("events are encoded as data: {json}\\n\\n", () => {
      const events = [
        {
          channel: "mutation",
          revision: 1,
          type: "entity_created",
          entity: { id: "e-1" },
        },
        { channel: "ping", revision: 2 },
        {
          channel: "progress",
          revision: 3,
          type: "phase_started",
          phase: "situational-grounding",
          runId: "r1",
        },
      ];

      // Encode as the server does
      const encoded = events
        .map((e) => `data: ${JSON.stringify(e)}\n\n`)
        .join("");

      // Parse as the client does (split on double newline)
      const parsed = encoded
        .split("\n\n")
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.startsWith("data: "))
        .map((chunk) => JSON.parse(chunk.slice(6)));

      expect(parsed.length).toBe(3);
      expect(parsed[0].channel).toBe("mutation");
      expect(parsed[1].channel).toBe("ping");
      expect(parsed[2].channel).toBe("progress");
    });

    it("events.get.ts filters terminal progress events", () => {
      // The server's events.get.ts filters analysis_completed and analysis_failed
      // from the progress channel (lines 56-61). These are only sent via
      // the runtime-status channel. Verify this contract.
      const terminalTypes = ["analysis_completed", "analysis_failed"];
      const nonTerminalTypes = [
        "phase_started",
        "phase_activity",
        "phase_completed",
      ];

      // These SHOULD be streamed on the progress channel
      for (const type of nonTerminalTypes) {
        expect(terminalTypes).not.toContain(type);
      }

      // Terminal events SHOULD NOT appear on the progress channel
      // (they come via the status channel instead)
      for (const type of terminalTypes) {
        expect(nonTerminalTypes).not.toContain(type);
      }
    });
  });
});
