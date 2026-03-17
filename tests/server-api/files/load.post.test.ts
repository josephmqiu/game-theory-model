import { describe, expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import { storeToAnalysisFile } from "shared/game-theory/utils/serialization";
import { createSampleCanonicalStore } from "shared/game-theory/test-support/sample-analysis";
import type { AnalysisFileMeta } from "shared/game-theory/types/file";
import { createSampleAnalysisMeta } from "shared/game-theory/test-support/sample-analysis";
import handler from "../../../server/api/files/load.post.ts";
import { callPost } from "../../../server/test-support/http";

function createAnalysisPayload() {
  const store = createSampleCanonicalStore();
  const meta: AnalysisFileMeta = createSampleAnalysisMeta();
  return JSON.stringify(storeToAnalysisFile(store, meta));
}

describe("/api/files/load.post", () => {
  it("returns parsed and validated analysis payloads", async () => {
    const response = await callPost<
      {
        success: true;
        store: unknown;
        meta: { name: string; description?: string; metadata: unknown };
      }
    >(handler, "/api/files/load", {
      content: createAnalysisPayload(),
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.store).toHaveProperty("games");
    expect(response.body.store).toHaveProperty("players");
    expect(response.body.meta).toMatchObject({
      name: "Sample strategic analysis",
    });
  });

  it("rejects missing content", async () => {
    const response = await callPost<{ success: false; error: string }>(
      handler,
      "/api/files/load",
      {},
    );

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain("content");
  });

  it("returns recovery errors for malformed files", async () => {
    const response = await callPost<{
      success: false;
      stage: string;
      error: string;
    }>(handler, "/api/files/load", {
      content: "{bad json",
    });

    expect(response.status).toBe(422);
    expect(response.body.success).toBe(false);
    expect(response.body.stage).toBe("parse");
    expect(response.body.error).toBeTruthy();
  });
});
