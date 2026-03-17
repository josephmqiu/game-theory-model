import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { readFile } from "node:fs/promises";
import { loadAnalysisJson } from "shared/game-theory/utils/file-io";
import { resolveSafeReadPath } from "../../utils/safe-path";

/**
 * GET endpoint to load a .gta.json analysis file.
 * Reads the file path from the `path` query parameter.
 * Runs the canonical migration/validation pipeline from file-io.
 */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filePath = query.path as string | undefined;

  if (!filePath) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: "Missing required query parameter: path",
    };
  }

  if (!filePath.endsWith(".gta.json")) {
    setResponseStatus(event, 400);
    return {
      success: false,
      error: "File path must end with .gta.json",
    };
  }

  const safePath = await resolveSafeReadPath(filePath);
  if (!safePath.ok) {
    setResponseStatus(event, 403);
    return {
      success: false,
      error: safePath.error,
    };
  }

  let raw: string;
  try {
    raw = await readFile(safePath.path, "utf-8");
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      setResponseStatus(event, 404);
      return {
        success: false,
        error: `File not found: ${filePath}`,
      };
    }

    setResponseStatus(event, 500);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to read file",
    };
  }

  try {
    const result = await loadAnalysisJson(raw, safePath.path);

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
      filePath: safePath.path,
      store: result.store,
      meta: {
        name: result.analysis.name,
        createdAt: result.analysis.created_at,
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
