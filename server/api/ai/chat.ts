import {
  defineEventHandler,
  getRequestHeader,
  readBody,
  setResponseStatus,
} from "h3";
import {
  createChatResponse,
  parseChatRequest,
} from "../../services/ai/chat-service";

export function formatOpenCodeError(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return String((error as { message: string }).message);
  }
  return "Unknown OpenCode error";
}

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody<unknown>(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  let request;
  try {
    request = parseChatRequest(rawBody);
  } catch (error) {
    setResponseStatus(event, 400);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Missing or invalid required fields for chat request.",
    };
  }

  const runId = getRequestHeader(event, "x-run-id")?.trim() || undefined;
  return createChatResponse(event, request, runId);
});
