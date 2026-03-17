/**
 * POST /api/files/load — parses raw .gta.json content from the client.
 * Used when the client reads file content directly (browser file input, Electron IPC).
 * Runs the canonical migration/validation pipeline from file-io.
 */

import { defineEventHandler, readBody, setResponseStatus } from "h3";
import { z } from "zod";
import { loadAnalysisJson } from "shared/game-theory/utils/file-io";

const loadSchema = z.object({
  content: z.string().min(1),
});

export default defineEventHandler(async (event) => {
  const raw = await readBody(event);

  const parsed = loadSchema.safeParse(raw);
  if (!parsed.success) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: "Missing or invalid content in request body",
    };
  }

  try {
    const result = await loadAnalysisJson(parsed.data.content, null);

    if (result.status === "recovery") {
      setResponseStatus(event, 422);
      return {
        success: false,
        stage: result.stage,
        error: result.error.message,
        issues: result.error.issues ?? result.error.structural_issues,
      };
    }

    return {
      success: true,
      store: result.store,
      meta: {
        name: result.analysis.name,
        description: result.analysis.description,
        metadata: result.analysis.metadata,
      },
      migration: result.migration,
      integrity: result.integrity,
    };
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process file",
    };
  }
});
