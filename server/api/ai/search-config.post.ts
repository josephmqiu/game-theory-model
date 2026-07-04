import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import {
  isSearchConfigured,
  setSearchConfig,
} from "../../services/search/config-cache";
import { serverLog } from "../../utils/ai-logger";

// The renderer re-pushes the BYOK search config here on boot and on every
// settings-save (the server holds it in memory only — see config-cache.ts).
const bodySchema = z.object({
  provider: z.union([z.literal("tavily"), z.literal("brave"), z.null()]),
  apiKey: z.string().nullable(),
});

export default defineEventHandler(async (event) => {
  let rawBody: unknown;
  try {
    rawBody = await readBody(event);
  } catch {
    setResponseStatus(event, 400);
    return { error: "Invalid request body" };
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return { error: "Invalid search-config request" };
  }

  const { provider, apiKey } = parsed.data;
  setSearchConfig({ provider, apiKey });

  const configured = isSearchConfigured();
  // Never log the key itself — provider + length only. A stable pseudo-run id
  // routes these events to their own audit log (serverLog no-ops without one).
  serverLog("search-config", "search-config", "set", {
    provider: provider ?? "none",
    apiKeyLength: apiKey?.length ?? 0,
    configured,
  });

  return { ok: true, configured };
});
