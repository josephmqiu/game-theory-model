import type { Analysis, AnalysisProfile, AnalysisValidation } from "@/types/analysis";
import { getAnalysisProfileKey } from "./analysis-normalization";

export type AnalysisInsightsStatus = "blocked" | "ready";
export type AnalysisInsightsBlockReason = "invalid" | "incomplete";
export type AnalysisInsightsDominanceKind = "strict" | "weak" | "none";

export interface AnalysisInsightsStrategy {
  id: string;
  name: string;
}

export interface AnalysisInsightsBestResponse {
  opponentStrategyId: string;
  opponentStrategyName: string;
  strategyIds: string[];
  strategyNames: string[];
}

export interface AnalysisInsightsBestResponseGroup {
  playerId: string;
  playerName: string;
  opponentPlayerId: string;
  opponentPlayerName: string;
  responses: AnalysisInsightsBestResponse[];
}

export interface AnalysisInsightsEquilibrium {
  key: string;
  label: string;
  player1StrategyId: string;
  player1StrategyName: string;
  player2StrategyId: string;
  player2StrategyName: string;
  payoffs: [number, number];
}

export interface AnalysisInsightsDominance {
  playerId: string;
  playerName: string;
  kind: AnalysisInsightsDominanceKind;
  strategyIds: string[];
  strategyNames: string[];
}

interface AnalysisInsightsBase {
  status: AnalysisInsightsStatus;
  blockMessage: string | null;
}

export interface AnalysisInsightsBlocked extends AnalysisInsightsBase {
  status: "blocked";
  blockReason: AnalysisInsightsBlockReason;
}

export interface AnalysisInsightsReady extends AnalysisInsightsBase {
  status: "ready";
  pureNashProfileKeys: string[];
  equilibria: AnalysisInsightsEquilibrium[];
  bestResponses: [
    AnalysisInsightsBestResponseGroup,
    AnalysisInsightsBestResponseGroup,
  ];
  dominance: [AnalysisInsightsDominance, AnalysisInsightsDominance];
}

export type AnalysisInsights = AnalysisInsightsBlocked | AnalysisInsightsReady;

function formatFallbackName(
  name: string | undefined,
  fallbackName: string,
): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : fallbackName;
}

function createProfileLabel(
  player1Name: string,
  player1StrategyName: string,
  player2Name: string,
  player2StrategyName: string,
): string {
  return `${player1Name}: ${player1StrategyName} vs ${player2Name}: ${player2StrategyName}`;
}

function createBlockedInsights(
  blockReason: AnalysisInsightsBlockReason,
): AnalysisInsightsBlocked {
  return {
    status: "blocked",
    blockReason,
    blockMessage:
      blockReason === "invalid"
        ? "Fix the validation issues above before strategic insights can be computed from the canonical model."
        : "Complete every payoff cell before strategic insights can compute best responses, dominance, and pure Nash equilibria.",
  };
}

function getProfileMap(analysis: Analysis): Map<string, AnalysisProfile> {
  const profiles = new Map<string, AnalysisProfile>();

  for (const profile of analysis.profiles) {
    profiles.set(
      getAnalysisProfileKey(
        profile.player1StrategyId,
        profile.player2StrategyId,
      ),
      profile,
    );
  }

  return profiles;
}

function getCompletePayoff(
  profileMap: Map<string, AnalysisProfile>,
  player1StrategyId: string,
  player2StrategyId: string,
  playerIndex: 0 | 1,
): number {
  const profile = profileMap.get(
    getAnalysisProfileKey(player1StrategyId, player2StrategyId),
  );
  const payoff = profile?.payoffs[playerIndex];

  if (payoff === null || payoff === undefined) {
    throw new Error(
      `Strategic insights require complete payoffs for ${player1StrategyId}::${player2StrategyId}.`,
    );
  }

  return payoff;
}

function createBestResponseGroup(
  analysis: Analysis,
  profileMap: Map<string, AnalysisProfile>,
  playerIndex: 0 | 1,
): AnalysisInsightsBestResponseGroup {
  const player = analysis.players[playerIndex];
  const opponent = analysis.players[playerIndex === 0 ? 1 : 0];
  const playerName = formatFallbackName(player.name, `Player ${playerIndex + 1}`);
  const opponentName = formatFallbackName(
    opponent.name,
    `Player ${playerIndex === 0 ? 2 : 1}`,
  );

  const responses = opponent.strategies.map((opponentStrategy, opponentIndex) => {
    const opponentStrategyName = formatFallbackName(
      opponentStrategy.name,
      `Strategy ${opponentIndex + 1}`,
    );

    const payoffs = player.strategies.map((strategy, strategyIndex) => ({
      id: strategy.id,
      name: formatFallbackName(strategy.name, `Strategy ${strategyIndex + 1}`),
      payoff:
        playerIndex === 0
          ? getCompletePayoff(profileMap, strategy.id, opponentStrategy.id, 0)
          : getCompletePayoff(profileMap, opponentStrategy.id, strategy.id, 1),
    }));
    const maxPayoff = Math.max(...payoffs.map((entry) => entry.payoff));
    const bestResponses = payoffs.filter((entry) => entry.payoff === maxPayoff);

    return {
      opponentStrategyId: opponentStrategy.id,
      opponentStrategyName,
      strategyIds: bestResponses.map((entry) => entry.id),
      strategyNames: bestResponses.map((entry) => entry.name),
    };
  });

  return {
    playerId: player.id,
    playerName,
    opponentPlayerId: opponent.id,
    opponentPlayerName: opponentName,
    responses,
  };
}

function strategyDominates(
  analysis: Analysis,
  profileMap: Map<string, AnalysisProfile>,
  playerIndex: 0 | 1,
  candidateStrategyId: string,
  alternativeStrategyId: string,
  kind: "strict" | "weak",
): boolean {
  const opponentStrategies = analysis.players[playerIndex === 0 ? 1 : 0].strategies;

  let sawStrictImprovement = false;

  for (const opponentStrategy of opponentStrategies) {
    const candidatePayoff =
      playerIndex === 0
        ? getCompletePayoff(profileMap, candidateStrategyId, opponentStrategy.id, 0)
        : getCompletePayoff(profileMap, opponentStrategy.id, candidateStrategyId, 1);
    const alternativePayoff =
      playerIndex === 0
        ? getCompletePayoff(profileMap, alternativeStrategyId, opponentStrategy.id, 0)
        : getCompletePayoff(profileMap, opponentStrategy.id, alternativeStrategyId, 1);

    if (kind === "strict") {
      if (candidatePayoff <= alternativePayoff) {
        return false;
      }
      sawStrictImprovement = true;
      continue;
    }

    if (candidatePayoff < alternativePayoff) {
      return false;
    }

    if (candidatePayoff > alternativePayoff) {
      sawStrictImprovement = true;
    }
  }

  return kind === "strict" ? sawStrictImprovement : sawStrictImprovement;
}

function createDominanceSummary(
  analysis: Analysis,
  profileMap: Map<string, AnalysisProfile>,
  playerIndex: 0 | 1,
): AnalysisInsightsDominance {
  const player = analysis.players[playerIndex];
  const playerName = formatFallbackName(player.name, `Player ${playerIndex + 1}`);
  const strategies = player.strategies.map((strategy, strategyIndex) => ({
    id: strategy.id,
    name: formatFallbackName(strategy.name, `Strategy ${strategyIndex + 1}`),
  }));

  const strictDominantStrategies = strategies.filter((candidate) =>
    strategies
      .filter((alternative) => alternative.id !== candidate.id)
      .every((alternative) =>
        strategyDominates(
          analysis,
          profileMap,
          playerIndex,
          candidate.id,
          alternative.id,
          "strict",
        ),
      ),
  );

  if (strictDominantStrategies.length > 0) {
    return {
      playerId: player.id,
      playerName,
      kind: "strict",
      strategyIds: strictDominantStrategies.map((strategy) => strategy.id),
      strategyNames: strictDominantStrategies.map((strategy) => strategy.name),
    };
  }

  const weakDominantStrategies = strategies.filter((candidate) =>
    strategies
      .filter((alternative) => alternative.id !== candidate.id)
      .every((alternative) =>
        strategyDominates(
          analysis,
          profileMap,
          playerIndex,
          candidate.id,
          alternative.id,
          "weak",
        ),
      ),
  );

  if (weakDominantStrategies.length > 0) {
    return {
      playerId: player.id,
      playerName,
      kind: "weak",
      strategyIds: weakDominantStrategies.map((strategy) => strategy.id),
      strategyNames: weakDominantStrategies.map((strategy) => strategy.name),
    };
  }

  return {
    playerId: player.id,
    playerName,
    kind: "none",
    strategyIds: [],
    strategyNames: [],
  };
}

export function createAnalysisInsights(
  analysis: Analysis,
  validation: AnalysisValidation,
): AnalysisInsights {
  if (!validation.isValid) {
    return createBlockedInsights("invalid");
  }

  if (!validation.isComplete) {
    return createBlockedInsights("incomplete");
  }

  const profileMap = getProfileMap(analysis);
  const [player1, player2] = analysis.players;
  const player1Name = formatFallbackName(player1.name, "Player 1");
  const player2Name = formatFallbackName(player2.name, "Player 2");

  const bestResponses: [
    AnalysisInsightsBestResponseGroup,
    AnalysisInsightsBestResponseGroup,
  ] = [
    createBestResponseGroup(analysis, profileMap, 0),
    createBestResponseGroup(analysis, profileMap, 1),
  ];

  const player1BestResponseMap = new Map(
    bestResponses[0].responses.map((response) => [
      response.opponentStrategyId,
      new Set(response.strategyIds),
    ]),
  );
  const player2BestResponseMap = new Map(
    bestResponses[1].responses.map((response) => [
      response.opponentStrategyId,
      new Set(response.strategyIds),
    ]),
  );

  const equilibria: AnalysisInsightsEquilibrium[] = [];

  for (const [player1Index, player1Strategy] of player1.strategies.entries()) {
    for (const [
      player2Index,
      player2Strategy,
    ] of player2.strategies.entries()) {
      const key = getAnalysisProfileKey(player1Strategy.id, player2Strategy.id);

      if (
        !player1BestResponseMap.get(player2Strategy.id)?.has(player1Strategy.id) ||
        !player2BestResponseMap.get(player1Strategy.id)?.has(player2Strategy.id)
      ) {
        continue;
      }

      const player1StrategyName = formatFallbackName(
        player1Strategy.name,
        `Strategy ${player1Index + 1}`,
      );
      const player2StrategyName = formatFallbackName(
        player2Strategy.name,
        `Strategy ${player2Index + 1}`,
      );

      equilibria.push({
        key,
        label: createProfileLabel(
          player1Name,
          player1StrategyName,
          player2Name,
          player2StrategyName,
        ),
        player1StrategyId: player1Strategy.id,
        player1StrategyName,
        player2StrategyId: player2Strategy.id,
        player2StrategyName,
        payoffs: [
          getCompletePayoff(profileMap, player1Strategy.id, player2Strategy.id, 0),
          getCompletePayoff(profileMap, player1Strategy.id, player2Strategy.id, 1),
        ],
      });
    }
  }

  return {
    status: "ready",
    blockMessage: null,
    pureNashProfileKeys: equilibria.map((equilibrium) => equilibrium.key),
    equilibria,
    bestResponses,
    dominance: [
      createDominanceSummary(analysis, profileMap, 0),
      createDominanceSummary(analysis, profileMap, 1),
    ],
  };
}
