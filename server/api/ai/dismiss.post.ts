import { defineEventHandler, readBody } from "h3";
import * as runtimeStatus from "../../services/runtime-status";
import { serverLog } from "../../utils/ai-logger";

interface DismissBody {
  runId?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<DismissBody>(event);

  console.log("[AI:dismiss] request", {
    runId: body?.runId ?? null,
  });

  const result = runtimeStatus.dismiss(body?.runId);

  if (body?.runId) {
    serverLog(body.runId, "dismiss", "request-complete", result);
  }

  console.log("[AI:dismiss] response", {
    runId: body?.runId ?? null,
    ...result,
  });

  return result;
});
