import { defineEventHandler, readBody, setResponseStatus } from "h3";
import * as entityGraphService from "../../../src/services/ai/entity-graph-service";
import * as analysisOrchestrator from "../../../src/services/ai/analysis-orchestrator";

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    action: string;
    id?: string;
    updates?: Record<string, unknown>;
    topic?: string;
  }>(event);
  if (!body?.action) {
    setResponseStatus(event, 400);
    return { error: "Missing action" };
  }

  // If analysis running and this is a mutation, queue it
  if (analysisOrchestrator.isRunning() && body.action !== "get") {
    analysisOrchestrator.queueEdit(() => executeAction(body));
    return { queued: true };
  }

  return executeAction(body);
});

function executeAction(body: any) {
  switch (body.action) {
    case "update": {
      const updated = entityGraphService.updateEntity(body.id, body.updates, {
        source: "user-edited",
      });
      return { updated, staleMarked: entityGraphService.getStaleEntityIds() };
    }
    case "get":
      return { analysis: entityGraphService.getAnalysis() };
    case "newAnalysis":
      entityGraphService.newAnalysis(body.topic || "");
      return { analysis: entityGraphService.getAnalysis() };
    default:
      return { error: `Unknown action: ${body.action}` };
  }
}
