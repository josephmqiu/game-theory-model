import { randomUUID } from "node:crypto";
import type { ServerResponse } from "node:http";
import { defineEventHandler } from "h3";
import type {
  AnalysisMutationEvent,
  AnalysisProgressEvent,
} from "../../../shared/types/events";
import type { RunStatus } from "../../../shared/types/api";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import * as revalidationService from "../../services/revalidation-service";
import * as entityGraphService from "../../services/entity-graph-service";
import * as runtimeStatus from "../../services/runtime-status";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";

const HEARTBEAT_INTERVAL_MS =
  analysisRuntimeConfig.analyzeSse.keepaliveIntervalMs;

function writeEvent(
  res: ServerResponse,
  payload:
    | ({ channel: "mutation" } & AnalysisMutationEvent & { revision: number })
    | ({ channel: "status" } & RunStatus & { revision: number })
    | ({ channel: "progress" } & AnalysisProgressEvent & { revision: number })
    | { channel: "ping"; revision: number },
): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export default defineEventHandler((event) => {
  const clientId = randomUUID();
  const res = event.node!.res! as ServerResponse;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  console.log(`[AI:events] connection-open client=${clientId}`);

  const unsubMutation = entityGraphService.onMutation((payload) => {
    writeEvent(res, {
      channel: "mutation",
      revision: runtimeStatus.getRevision(),
      ...payload,
    });
  });

  const unsubStatus = runtimeStatus.onStatusChange((payload) => {
    writeEvent(res, {
      channel: "status",
      revision: runtimeStatus.getRevision(),
      ...payload,
    });
  });

  const onProgress = (payload: AnalysisProgressEvent) => {
    if (
      payload.type === "analysis_completed" ||
      payload.type === "analysis_failed"
    ) {
      return;
    }

    writeEvent(res, {
      channel: "progress",
      revision: runtimeStatus.getRevision(),
      ...payload,
    });
  };

  const unsubOrchestrator = analysisOrchestrator.onProgress(onProgress);
  const unsubRevalidation = revalidationService.onProgress(onProgress);

  const heartbeat = setInterval(() => {
    writeEvent(res, {
      channel: "ping",
      revision: runtimeStatus.getRevision(),
    });
  }, HEARTBEAT_INTERVAL_MS);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    clearInterval(heartbeat);
    unsubMutation();
    unsubStatus();
    unsubOrchestrator();
    unsubRevalidation();
    console.log(`[AI:events] connection-close client=${clientId}`);
  };

  res.on("close", cleanup);

  return new Promise<void>((resolve) => {
    res.on("close", () => {
      cleanup();
      resolve();
    });
  });
});
