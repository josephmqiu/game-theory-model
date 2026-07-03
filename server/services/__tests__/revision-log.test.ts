import { describe, expect, it } from "vitest";
import type { RevisionLogEntry } from "../../../shared/types/entity";
import { REVISION_LOG_LIMIT } from "../../../src/types/entity";
import {
  appendRevisionLog,
  computeFieldDiffs,
  latestLogNo,
  nextLogNo,
  stableStringify,
} from "../revision-log";

const factBefore = {
  type: "fact" as const,
  phase: "situational-grounding" as const,
  data: {
    type: "fact" as const,
    date: "2026-03-19",
    source: "test",
    content: "Original content",
    category: "action" as const,
  },
  confidence: "high" as const,
  rationale: "original rationale",
};

describe("computeFieldDiffs", () => {
  it("returns [] for identical content regardless of key order", () => {
    const reordered = {
      rationale: "original rationale",
      confidence: "high" as const,
      phase: "situational-grounding" as const,
      type: "fact" as const,
      data: {
        category: "action" as const,
        content: "Original content",
        source: "test",
        date: "2026-03-19",
        type: "fact" as const,
      },
    };
    expect(computeFieldDiffs(factBefore, reordered)).toEqual([]);
  });

  it("captures data-level diffs with dot paths and JSON-encoded values", () => {
    const after = {
      ...factBefore,
      data: { ...factBefore.data, content: "Edited content" },
    };
    const diffs = computeFieldDiffs(factBefore, after);
    expect(diffs).toEqual([
      {
        field: "data.content",
        old: '"Original content"',
        new: '"Edited content"',
      },
    ]);
  });

  it("captures top-level diffs (confidence, rationale)", () => {
    const after = {
      ...factBefore,
      confidence: "low" as const,
      rationale: "updated",
    };
    const fields = computeFieldDiffs(factBefore, after).map((d) => d.field);
    expect(fields).toContain("confidence");
    expect(fields).toContain("rationale");
    expect(fields).toHaveLength(2);
  });

  it("truncates oversized values with a marker (~2KB, E4A)", () => {
    const after = {
      ...factBefore,
      data: { ...factBefore.data, content: "x".repeat(5000) },
    };
    const diff = computeFieldDiffs(factBefore, after)[0];
    expect(diff.new.length).toBeLessThan(2100);
    expect(diff.new.endsWith("…[truncated]")).toBe(true);
    expect(diff.old).toBe('"Original content"');
  });
});

describe("appendRevisionLog", () => {
  it("assigns monotonic logNos starting at 1", () => {
    let log: RevisionLogEntry[] | undefined;
    log = appendRevisionLog(log, { logSource: "phase", fieldDiffs: [] });
    log = appendRevisionLog(log, {
      logSource: "human",
      fieldDiffs: [{ field: "rationale", old: '"a"', new: '"b"' }],
    });
    expect(log.map((e) => e.logNo)).toEqual([1, 2]);
    expect(log[0].logSource).toBe("phase");
    expect(log[1].logSource).toBe("human");
  });

  it("bounds the log while keeping logNo monotonic across trimming", () => {
    let log: RevisionLogEntry[] | undefined;
    for (let i = 0; i < REVISION_LOG_LIMIT + 5; i++) {
      log = appendRevisionLog(log, { logSource: "phase", fieldDiffs: [] });
    }
    expect(log).toHaveLength(REVISION_LOG_LIMIT);
    // Oldest entries trimmed; numbering continues past the window
    expect(log![0].logNo).toBe(6);
    expect(latestLogNo(log)).toBe(REVISION_LOG_LIMIT + 5);
    expect(nextLogNo(log)).toBe(REVISION_LOG_LIMIT + 6);
  });

  it("records the conflict marker only when requested", () => {
    const plain = appendRevisionLog(undefined, {
      logSource: "human",
      fieldDiffs: [],
    });
    expect("conflict" in plain[0]).toBe(false);

    const conflicted = appendRevisionLog(undefined, {
      logSource: "human",
      fieldDiffs: [],
      conflict: true,
    });
    expect(conflicted[0].conflict).toBe(true);
  });
});

describe("stableStringify", () => {
  it("is order-insensitive for nested objects", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [{ e: 3, f: 4 }] } })).toBe(
      stableStringify({ b: { d: [{ f: 4, e: 3 }], c: 2 }, a: 1 }),
    );
  });
});
