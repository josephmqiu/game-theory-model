/**
 * POST /api/mcp/state — receives state updates from renderer or MCP.
 * Passive: stores snapshot and broadcasts via SSE.
 * Does NOT dispatch commands server-side (renderer is authoritative).
 */

import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { setSyncState } from "../../utils/mcp-sync-state";

const syncStateSchema = z.object({
  state: z.object({
    canonical: z.record(z.unknown()).optional(),
    pipelineState: z.record(z.unknown()).optional(),
    runtimeState: z.record(z.unknown()).optional(),
    conversationState: z.record(z.unknown()).optional(),
  }),
  sourceClientId: z.string().optional(),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);

  const parsed = syncStateSchema.safeParse(raw);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { status: "error", message: "Invalid state payload" };
  }

  const version = setSyncState(
    parsed.data.state as Parameters<typeof setSyncState>[0],
    parsed.data.sourceClientId,
  );
  return { status: "ok", version };
});
