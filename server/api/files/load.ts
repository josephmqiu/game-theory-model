import { defineEventHandler, getQuery, setResponseStatus } from "h3";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir, tmpdir } from "node:os";
import { loadAnalysisJson } from "shared/game-theory/utils/file-io";

function isSafePath(filePath: string): boolean {
  if (filePath.includes("\0")) return false;

  const resolved = resolve(filePath);
  const home = homedir();
  const tmp = tmpdir();

  return resolved.startsWith(home) || resolved.startsWith(tmp);
}

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

  if (!isSafePath(filePath)) {
    setResponseStatus(event, 403);
    return {
      success: false,
      error: "Path is outside the allowed directory",
    };
  }

  let raw: string;
  try {
    raw = await readFile(resolve(filePath), "utf-8");
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
    const result = await loadAnalysisJson(raw, resolve(filePath));

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
      filePath: resolve(filePath),
      store: result.store,
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
