import type { AnalysisProgressEvent } from "../../../shared/types/events";
import type {
  WorkspaceRuntimeChannelRevisions,
  WorkspaceRuntimeAnalysisMutationPayload,
  WorkspaceRuntimeAnalysisProgressPayload,
  WorkspaceRuntimeAnalysisStatusPayload,
  WorkspaceRuntimePushEnvelope,
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
const latestBroadcastByChannel = new Map<
  AnalysisBroadcastChannel,
  AnalysisBroadcast
>();
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
  latestBroadcastByChannel.set(channel, broadcast);
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

export function getAnalysisBroadcastChannelRevisions(): WorkspaceRuntimeChannelRevisions {
  const revisions: WorkspaceRuntimeChannelRevisions = {};

  for (const [channel, broadcast] of latestBroadcastByChannel.entries()) {
    revisions[channel] = broadcast.revision;
  }

  return revisions;
}

export function listAnalysisBroadcastReplayPushes(input: {
  workspaceId: string;
  lastSeenByChannel?: WorkspaceRuntimeChannelRevisions;
}): Array<
  | WorkspaceRuntimePushEnvelope<"analysis-mutation">
  | WorkspaceRuntimePushEnvelope<"analysis-status">
  | WorkspaceRuntimePushEnvelope<"analysis-progress">
> {
  const replayable: Array<
    | WorkspaceRuntimePushEnvelope<"analysis-mutation">
    | WorkspaceRuntimePushEnvelope<"analysis-status">
    | WorkspaceRuntimePushEnvelope<"analysis-progress">
  > = [];

  for (const [channel, broadcast] of latestBroadcastByChannel.entries()) {
    const lastSeen = input.lastSeenByChannel?.[channel] ?? 0;
    if (broadcast.revision <= lastSeen) {
      continue;
    }

    if (channel === "analysis-mutation") {
      replayable.push({
        type: "push",
        channel,
        revision: broadcast.revision,
        scope: { workspaceId: input.workspaceId },
        payload: broadcast.payload as WorkspaceRuntimeAnalysisMutationPayload,
        replayed: true,
      });
      continue;
    }

    if (channel === "analysis-status") {
      replayable.push({
        type: "push",
        channel,
        revision: broadcast.revision,
        scope: { workspaceId: input.workspaceId },
        payload: broadcast.payload as WorkspaceRuntimeAnalysisStatusPayload,
        replayed: true,
      });
      continue;
    }

    replayable.push({
      type: "push",
      channel,
      revision: broadcast.revision,
      scope: { workspaceId: input.workspaceId },
      payload: broadcast.payload as WorkspaceRuntimeAnalysisProgressPayload,
      replayed: true,
    });
  }

  return replayable;
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
  latestBroadcastByChannel.clear();
  // Intentionally not clearing listeners — module-level subscriptions
  // (from the transport) are registered once at import time and must
  // persist across test resets.
}
