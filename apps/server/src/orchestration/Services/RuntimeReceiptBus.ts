import {
  IsoDateTime,
  NonNegativeInt,
  ThreadId,
  TurnId,
} from "@t3tools/contracts";
import { Schema, ServiceMap } from "effect";
import type { Effect, Stream } from "effect";

export const TurnProcessingQuiescedReceipt = Schema.Struct({
  type: Schema.Literal("turn.processing.quiesced"),
  threadId: ThreadId,
  turnId: TurnId,
  checkpointTurnCount: NonNegativeInt,
  createdAt: IsoDateTime,
});
export type TurnProcessingQuiescedReceipt =
  typeof TurnProcessingQuiescedReceipt.Type;

export const OrchestrationRuntimeReceipt = TurnProcessingQuiescedReceipt;
export type OrchestrationRuntimeReceipt =
  typeof OrchestrationRuntimeReceipt.Type;

export interface RuntimeReceiptBusShape {
  readonly publish: (
    receipt: OrchestrationRuntimeReceipt,
  ) => Effect.Effect<void>;
  readonly stream: Stream.Stream<OrchestrationRuntimeReceipt>;
}

export class RuntimeReceiptBus extends ServiceMap.Service<
  RuntimeReceiptBus,
  RuntimeReceiptBusShape
>()("t3/orchestration/Services/RuntimeReceiptBus") {}
