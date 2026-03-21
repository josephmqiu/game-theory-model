// SSE endpoint for server-side analysis orchestration.
// Accepts { topic, provider?, model? }, runs the analysis pipeline,
// and streams progress + mutation events back to the client.

import {
  defineEventHandler,
  readBody,
  setResponseHeaders,
  setResponseStatus,
} from "h3";
import type { AnalysisRuntimeOverrides } from "../../../shared/types/analysis-runtime";
import * as analysisOrchestrator from "../../agents/analysis-agent";
import { analysisRuntimeConfig } from "../../config/analysis-runtime";
import * as entityGraphService from "../../services/entity-graph-service";

interface AnalyzeBody {
  topic: string;
  provider?: string;
  model?: string;
  runtime?: AnalysisRuntimeOverrides;
}

/** Keep-alive ping interval (ms) — prevents client timeout while waiting for AI */
const KEEPALIVE_INTERVAL_MS =
  analysisRuntimeConfig.analyzeSse.keepaliveIntervalMs;

/** Safety timeout (ms) — close stream even if orchestrator never emits terminal event */
const STREAM_TIMEOUT_MS = analysisRuntimeConfig.analyzeSse.streamTimeoutMs;
const SNAPSHOT_SETTLE_DELAY_MS =
  analysisRuntimeConfig.analyzeSse.snapshotSettleDelayMs;

export default defineEventHandler(async (event) => {
  const body = await readBody<AnalyzeBody>(event);
  if (!body?.topic) {
    setResponseStatus(event, 400);
    return { error: "Missing required field: topic" };
  }

  setResponseHeaders(event, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (data: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          /* stream already closed */
        }
      };

      const pingTimer = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "ping", content: "" })}\n\n`,
            ),
          );
        } catch {
          /* stream already closed */
        }
      }, KEEPALIVE_INTERVAL_MS);

      let runComplete = false;

      // Abort on client disconnect
      const abortController = new AbortController();
      const req = event.node?.req;
      if (req) {
        req.on("close", () => {
          abortController.abort();
        });
      }

      // Promise resolves when analysis finishes (or is aborted/times out)
      const analysisPromise = new Promise<void>((resolve) => {
        const unsubProgress = analysisOrchestrator.onProgress((ev) => {
          emit({ channel: "progress", ...ev });
          if (
            ev.type === "analysis_completed" ||
            ev.type === "analysis_failed"
          ) {
            runComplete = true;
            unsubProgress();
            resolve();
          }
        });

        // Handle abort — orchestrator may not emit a terminal event
        abortController.signal.addEventListener("abort", () => {
          if (!runComplete) {
            runComplete = true;
            unsubProgress();
            resolve();
          }
        });

        // Safety timeout — prevent stream from hanging indefinitely
        setTimeout(() => {
          if (!runComplete) {
            runComplete = true;
            unsubProgress();
            resolve();
          }
        }, STREAM_TIMEOUT_MS);
      });

      // Subscribe to entity/relationship mutations
      const unsubMutation = entityGraphService.onMutation((ev) => {
        emit({ channel: "mutation", ...ev });
      });

      try {
        // Reset entity graph and start analysis
        entityGraphService.newAnalysis(body.topic);
        const { runId } = await analysisOrchestrator.runFull(
          body.topic,
          body.provider,
          body.model,
          abortController.signal,
          body.runtime,
        );
        emit({ channel: "started", runId });

        // Wait for completion, abort, or timeout
        await analysisPromise;

        // Wait for edit queue to drain (orchestrator drains in finally block after emitting events)
        await new Promise((resolve) =>
          setTimeout(resolve, SNAPSHOT_SETTLE_DELAY_MS),
        );

        // Now send snapshot with queued edits applied
        emit({
          channel: "snapshot",
          analysis: entityGraphService.getAnalysis(),
        });
      } catch (error) {
        emit({
          channel: "error",
          message: error instanceof Error ? error.message : "Analysis failed",
        });
      } finally {
        clearInterval(pingTimer);
        unsubMutation();
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream);
});
