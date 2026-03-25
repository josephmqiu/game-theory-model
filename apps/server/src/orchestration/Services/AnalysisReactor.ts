/**
 * AnalysisReactor - Analysis event reaction service interface.
 *
 * Owns background workers that react to analysis CQRS events and apply them
 * to the canonical EntityGraphService, bridging the event-sourced aggregate
 * to the module-level entity store.
 *
 * @module AnalysisReactor
 */
import { ServiceMap } from "effect";
import type { Effect, Scope } from "effect";

/**
 * AnalysisReactorShape - Service API for analysis event reactors.
 */
export interface AnalysisReactorShape {
  /**
   * Start reacting to analysis domain events from the orchestration engine.
   *
   * The returned effect must be run in a scope so all worker fibers can be
   * finalized on shutdown.
   */
  readonly start: Effect.Effect<void, never, Scope.Scope>;

  /**
   * Resolves when the internal processing queue is empty and idle.
   * Intended for test use to replace timing-sensitive sleeps.
   */
  readonly drain: Effect.Effect<void>;
}

/**
 * AnalysisReactor - Service tag for analysis event reaction workers.
 */
export class AnalysisReactor extends ServiceMap.Service<
  AnalysisReactor,
  AnalysisReactorShape
>()("t3/orchestration/Services/AnalysisReactor") {}
