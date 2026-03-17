import { beforeEach, describe, expect, it } from "vitest";
import { analysisStore } from "@/stores/analysis-store";
import { generateEntityId } from "shared/game-theory/engine/id-generator";
import type { NormalFormModel } from "shared/game-theory/types/formalizations";

function now(): string {
  return "2026-03-16T12:00:00.000Z";
}

describe("manual modeling command spine", () => {
  beforeEach(() => {
    analysisStore.getState().newAnalysis();
  });

  it("creates core modeling entities through canonical commands", () => {
    const gameId = generateEntityId("game");
    const formalizationId = generateEntityId("formalization");
    const playerId = generateEntityId("player");
    const assumptionId = generateEntityId("assumption");
    const scenarioId = generateEntityId("scenario");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_game",
        id: gameId,
        payload: {
          name: "Trade crisis bargaining",
          description: "Escalation and concessions between two states",
          semantic_labels: ["custom"],
          players: [],
          status: "active",
          formalizations: [],
          coupling_links: [],
          key_assumptions: [],
          created_at: now(),
          updated_at: now(),
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_formalization",
        id: formalizationId,
        payload: ({
          game_id: gameId,
          kind: "normal_form",
          purpose: "computational",
          abstraction_level: "minimal",
          assumptions: [],
          strategies: {},
          payoff_cells: [],
        } as unknown) as Omit<NormalFormModel, "id">,
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "attach_formalization_to_game",
        payload: {
          game_id: gameId,
          formalization_id: formalizationId,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_player",
        id: playerId,
        payload: {
          name: "Treasury",
          type: "state",
          objectives: [],
          constraints: [],
          role: "primary",
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "attach_player_to_game",
        payload: {
          game_id: gameId,
          player_id: playerId,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_assumption",
        id: assumptionId,
        payload: {
          statement: "Both sides prioritize domestic stability.",
          type: "behavioral",
          sensitivity: "medium",
          confidence: 0.7,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_scenario",
        id: scenarioId,
        payload: {
          name: "Contained escalation",
          formalization_id: formalizationId,
          path: [],
          probability_model: "independent",
          key_assumptions: [],
          invalidators: [],
          narrative: "Escalation peaks and then backs off through side payments.",
        },
      }).status,
    ).toBe("committed");

    const canonical = analysisStore.getState().canonical;
    expect(canonical.games[gameId]?.formalizations).toContain(formalizationId);
    expect(canonical.games[gameId]?.players).toContain(playerId);
    expect(canonical.assumptions[assumptionId]?.statement).toContain("domestic stability");
    expect(canonical.scenarios[scenarioId]?.formalization_id).toBe(formalizationId);
  });

  it("creates evidence-chain entities used by manual modeling", () => {
    const sourceId = generateEntityId("source");
    const observationId = generateEntityId("observation");
    const claimId = generateEntityId("claim");
    const inferenceId = generateEntityId("inference");
    const assumptionId = generateEntityId("assumption");
    const gameId = generateEntityId("game");
    const formalizationId = generateEntityId("formalization");
    const scenarioId = generateEntityId("scenario");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_source",
        id: sourceId,
        payload: {
          kind: "article",
          title: "IMF country risk update",
          publisher: "IMF",
          captured_at: now(),
          quality_rating: "high",
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_observation",
        id: observationId,
        payload: {
          source_id: sourceId,
          text: "Reserves are falling faster than forecast.",
          captured_at: now(),
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_claim",
        id: claimId,
        payload: {
          statement: "Balance-of-payments pressure is rising.",
          based_on: [observationId],
          confidence: 0.75,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_inference",
        id: inferenceId,
        payload: {
          statement: "External financing stress is likely to intensify.",
          derived_from: [claimId],
          rationale: "Falling reserves and rising pressure usually compress policy options.",
          confidence: 0.7,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_assumption",
        id: assumptionId,
        payload: {
          statement: "Emergency swaps remain politically available.",
          type: "institutional",
          sensitivity: "high",
          confidence: 0.65,
          supported_by: [claimId, inferenceId],
          contradicted_by: [claimId],
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_game",
        id: gameId,
        payload: {
          name: "Stabilization bargaining",
          description: "Crisis management under reserve pressure",
          semantic_labels: ["custom"],
          players: [],
          status: "active",
          formalizations: [],
          coupling_links: [],
          key_assumptions: [],
          created_at: now(),
          updated_at: now(),
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_formalization",
        id: formalizationId,
        payload: ({
          game_id: gameId,
          kind: "normal_form",
          purpose: "computational",
          abstraction_level: "minimal",
          assumptions: [],
          strategies: {},
          payoff_cells: [],
        } as unknown) as Omit<NormalFormModel, "id">,
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "attach_formalization_to_game",
        payload: {
          game_id: gameId,
          formalization_id: formalizationId,
        },
      }).status,
    ).toBe("committed");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_scenario",
        id: scenarioId,
        payload: {
          name: "Managed de-escalation",
          formalization_id: formalizationId,
          path: [],
          probability_model: "dependency_aware",
          key_assumptions: [assumptionId],
          invalidators: [claimId, inferenceId, assumptionId],
          narrative: "Authorities stabilize expectations before financing options close.",
        },
      }).status,
    ).toBe("committed");

    const canonical = analysisStore.getState().canonical;
    expect(canonical.sources[sourceId]?.title).toBe("IMF country risk update");
    expect(canonical.observations[observationId]?.source_id).toBe(sourceId);
    expect(canonical.claims[claimId]?.based_on).toEqual([observationId]);
    expect(canonical.inferences[inferenceId]?.derived_from).toEqual([claimId]);
    expect(canonical.assumptions[assumptionId]?.supported_by).toEqual([
      claimId,
      inferenceId,
    ]);
    expect(canonical.scenarios[scenarioId]?.invalidators).toEqual([
      claimId,
      inferenceId,
      assumptionId,
    ]);
  });

  it("rejects claims based on raw source ids", () => {
    const sourceId = generateEntityId("source");

    expect(
      analysisStore.getState().dispatch({
        kind: "add_source",
        id: sourceId,
        payload: {
          kind: "article",
          title: "Market close note",
          captured_at: now(),
          quality_rating: "medium",
        },
      }).status,
    ).toBe("committed");

    const result = analysisStore.getState().dispatch({
      kind: "add_claim",
      id: generateEntityId("claim"),
      payload: {
        statement: "This should fail.",
        based_on: [sourceId],
        confidence: 0.4,
      },
    });

    expect(result.status).toBe("rejected");
  });
});
