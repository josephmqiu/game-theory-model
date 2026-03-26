import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type {
  WorkspaceRuntimeAnalysisMutationPayload,
  WorkspaceRuntimeAnalysisProgressPayload,
  WorkspaceRuntimeAnalysisStatusPayload,
} from "../../../shared/types/workspace-runtime";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import * as revalidationService from "../revalidation-service";
import * as entityGraphService from "../entity-graph-service";
import * as runtimeStatus from "../runtime-status";

export type AnalysisBroadcastChannel =
  | "analysis-mutation"
  | "analysis-status"
  | "analysis-progress";

interface AnalysisBroadcastPayloadMap {
  "analysis-mutation": WorkspaceRuntimeAnalysisMutationPayload;
  "analysis-status": WorkspaceRuntimeAnalysisStatusPayload;
  "analysis-progress": WorkspaceRuntimeAnalysisProgressPayload;
}

export interface AnalysisBroadcast<
  TChannel extends AnalysisBroadcastChannel = AnalysisBroadcastChannel,
> {
  channel: TChannel;
  revision: number;
  payload: AnalysisBroadcastPayloadMap[TChannel];
}

type BroadcastListener = (broadcast: AnalysisBroadcast) => void;

const listeners = new Set<BroadcastListener>();
let revision = 0;

function nextRevision(): number {
  return ++revision;
}

function emit<TChannel extends AnalysisBroadcastChannel>(
  channel: TChannel,
  payload: AnalysisBroadcastPayloadMap[TChannel],
): void {
  const broadcast: AnalysisBroadcast<TChannel> = {
    channel,
    revision: nextRevision(),
    payload,
  };
  for (const listener of listeners) {
    listener(broadcast);
  }
}

export function onAnalysisBroadcast(listener: BroadcastListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Subscribe to server-side analysis event emitters at module load.

entityGraphService.onMutation((event) => {
  emit("analysis-mutation", { event });
});

runtimeStatus.onStatusChange((runStatus) => {
  emit("analysis-status", { runStatus });
});

const onProgress = (event: AnalysisProgressEvent) => {
  // Same filter as the former SSE endpoint: terminal events are delivered
  // through the status channel (via runtimeStatus.onStatusChange), not
  // duplicated on the progress channel.
  if (event.type === "analysis_completed" || event.type === "analysis_failed") {
    return;
  }
  emit("analysis-progress", { event });
};

analysisOrchestrator.onProgress(onProgress);
revalidationService.onProgress(onProgress);

export function _resetAnalysisEventBridgeForTest(): void {
  revision = 0;
  // Intentionally not clearing listeners — module-level subscriptions
  // (from the transport) are registered once at import time and must
  // persist across test resets.
}
