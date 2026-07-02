// Design-guard tests (decision 6A): fail the build when the implementation
// drifts from the locked design decisions. These deliberately read source
// files — they guard STRUCTURE (single sources, landmarks, token pinning),
// not runtime behavior.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ENTITY_TYPE_COLOR, tokens } from "@/constants/design-tokens";
import { entityDataSchema } from "@/types/entity";

function read(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf8");
}

describe("design guards (6A)", () => {
  // ── 5.1A: single palette source ──

  it("the entity palette lives ONLY in design-tokens (skia + overlay consume it)", () => {
    const skia = read("src/canvas/skia/skia-engine.ts");
    const overlay = read("src/components/panels/entity-overlay-card.tsx");

    expect(skia).toContain('from "@/constants/design-tokens"');
    expect(overlay).toContain('from "@/constants/design-tokens"');
    // No local palette maps left behind
    expect(skia).not.toMatch(/ENTITY_TYPE_COLOR\s*:\s*Record/);
    expect(overlay).not.toMatch(/ENTITY_TYPE_COLORS\s*:\s*Record/);
  });

  it("the palette covers every entity type", () => {
    const unionTypes = entityDataSchema.def.options.map(
      (option) =>
        (option as { def: { shape: { type: { def: { values: unknown[] } } } } })
          .def.shape.type.def.values[0] as string,
    );
    for (const type of unionTypes) {
      expect(
        ENTITY_TYPE_COLOR[type as keyof typeof ENTITY_TYPE_COLOR],
        `missing palette entry for ${type}`,
      ).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  // ── 5.1A: CSS custom properties pinned to the tokens module ──

  it("styles.css surface/border/accent vars match the tokens module", () => {
    const css = read("src/styles.css").toLowerCase();
    expect(css).toContain(`--background: ${tokens.surface.base.toLowerCase()}`);
    expect(css).toContain(`--card: ${tokens.surface.panel.toLowerCase()}`);
    expect(css).toContain(
      `--secondary: ${tokens.surface.raised.toLowerCase()}`,
    );
    expect(css).toContain(`--border: ${tokens.border.subtle.toLowerCase()}`);
    expect(css).toContain(`--primary: ${tokens.accent.toLowerCase()}`);
    expect(css).toContain(`--ring: ${tokens.focusRing.color.toLowerCase()}`);
    expect(css).toContain(
      `--txt-primary: ${tokens.text.primary.toLowerCase()}`,
    );
    expect(css).toContain(
      `--txt-secondary: ${tokens.text.secondary.toLowerCase()}`,
    );
    expect(css).toContain(`--txt-label: ${tokens.text.label.toLowerCase()}`);
    expect(css).toContain(`--txt-header: ${tokens.text.header.toLowerCase()}`);
  });

  it("the canvas background comes from the tokens module", () => {
    const constants = read("src/canvas/canvas-constants.ts");
    expect(constants).toContain("tokens.surface.base");
    expect(constants).not.toContain('"#1a1a1a"');
  });

  // ── 1.1A: shell landmarks ──

  it("the canvas surface is a <main> landmark", () => {
    const layout = read("src/components/editor/editor-layout.tsx");
    expect(layout).toContain("<main");
    expect(layout).toContain("</main>");
  });

  it("the shell has a product mark and panel headings", () => {
    const topBar = read("src/components/editor/top-bar.tsx");
    const layout = read("src/components/editor/editor-layout.tsx");
    expect(topBar).toContain("Game Theory Analyzer");
    // Scannable panel headings render as h2 elements
    expect(layout).toMatch(/<h2[^>]*>/);
  });

  // ── Quick wins: focus ring + cursor ──

  it("a visible focus ring is applied globally with the token values", () => {
    const css = read("src/styles.css");
    expect(css).toMatch(/:focus-visible\s*\{[^}]*outline:\s*2px solid/);
    expect(css).toMatch(/outline-offset:\s*2px/);
  });

  it("buttons no longer suppress the focus outline", () => {
    const button = read("src/components/ui/button.tsx");
    expect(button).not.toContain("focus-visible:outline-none");
  });

  it("interactive elements get cursor: pointer", () => {
    const css = read("src/styles.css");
    expect(css).toMatch(/button:not\(:disabled\)[\s\S]*?cursor:\s*pointer/);
  });

  // ── 5.2A: fonts ──

  it("Geist is bundled and Satoshi is gone", () => {
    const css = read("src/styles.css");
    expect(css).toContain("@fontsource/geist-sans");
    expect(css).toContain("@fontsource/geist-mono");

    const overlay = read("src/components/panels/entity-overlay-card.tsx");
    expect(overlay).not.toContain("Satoshi");
  });

  it("no inline fontFamily styles outside the allowed files", () => {
    // font-picker renders font previews BY DESIGN — the one allowed use.
    const allowed = new Set(["src/components/shared/font-picker.tsx"]);

    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(join(process.cwd(), dir), {
        withFileTypes: true,
      })) {
        const rel = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          walk(rel);
        } else if (
          entry.name.endsWith(".tsx") &&
          !rel.includes("__tests__") &&
          !allowed.has(rel) &&
          read(rel).includes("fontFamily:")
        ) {
          offenders.push(rel);
        }
      }
    };
    walk("src/components");
    expect(offenders).toEqual([]);
  });

  // ── TT/E3A: hit areas ──

  it("the hit-area utility exists and buttons anchor it with position:relative", () => {
    const css = read("src/styles.css");
    expect(css).toContain("hit-area-44");
    expect(css).toMatch(/max\(100%,\s*44px\)/);

    const button = read("src/components/ui/button.tsx");
    expect(button).toMatch(/["']relative /);
  });
});
