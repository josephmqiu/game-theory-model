import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { isRunnablePhase } from "../../../src/types/methodology";
import * as revalidationService from "../../services/revalidation-service";

interface RevalidateBody {
  phase?: string;
}

export default defineEventHandler(async (event) => {
  let body: RevalidateBody;
  try {
    body = ((await readBody<RevalidateBody | undefined>(event)) ??
      {}) as RevalidateBody;
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  if (typeof body.phase !== "string" || !isRunnablePhase(body.phase)) {
    setResponseStatus(event, 400);
    return { error: "Invalid phase" };
  }

  const { runId } = revalidationService.revalidate(undefined, body.phase);
  return { runId };
});
