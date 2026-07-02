// generate-design-md.ts — regenerate DESIGN.md from the tokens module (4A).
// Usage: bun run gen:design
// DESIGN.md is a build artifact of src/constants/design-tokens.ts — never
// edit it by hand; edit the tokens module and regenerate.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ENTITY_TYPE_COLOR,
  ENTITY_TYPE_FALLBACK_COLOR,
  tokens,
} from "../src/constants/design-tokens";

function table(rows: string[][], header: [string, string]): string {
  return [
    `| ${header[0]} | ${header[1]} |`,
    "| --- | --- |",
    ...rows.map(([k, v]) => `| ${k} | \`${v}\` |`),
  ].join("\n");
}

const entityRows = Object.entries(ENTITY_TYPE_COLOR).map(([type, color]) => [
  type,
  color,
]);

const doc = `<!-- GENERATED FILE — do not edit. -->
<!-- Source: src/constants/design-tokens.ts · Regenerate: bun run gen:design -->

# Game Theory Analyzer — Design System

The app is a dark, layout-first desktop workspace. The entity-graph canvas is
the primary surface; panels and chat support it. Cards appear ONLY as canvas
entity nodes, the overlay form container, and transcript messages — never as
shell or section structure (decision 4.1A).

## Surfaces

${table(
  [
    ["surface.base (canvas)", tokens.surface.base],
    ["surface.panel (panels/cards)", tokens.surface.panel],
    ["surface.raised (raised/hover)", tokens.surface.raised],
    ["border.subtle", tokens.border.subtle],
  ],
  ["Token", "Value"],
)}

## Text roles

Contrast comes from semantic roles, not ad-hoc zinc shades (decision 11A).

${table(
  [
    ["text.primary", tokens.text.primary],
    ["text.secondary", tokens.text.secondary],
    ["text.label", tokens.text.label],
    ["text.header", tokens.text.header],
  ],
  ["Token", "Value"],
)}

## Accent & state

${table(
  [
    ["accent (amber-500)", tokens.accent],
    ["state.stale", tokens.state.stale],
    ["state.error", tokens.state.error],
    ["state.success", tokens.state.success],
  ],
  ["Token", "Value"],
)}

## Focus ring

\`${tokens.focusRing.color}\`, ${tokens.focusRing.widthPx}px, offset ${tokens.focusRing.offsetPx}px — applied globally via \`:focus-visible\`.

## Geometry & type

- Radius: ${tokens.radius.cardPx}px cards / ${tokens.radius.panelPx}px panels
- Spacing base: ${tokens.spacingBasePx}px
- Type scale: ${tokens.typeScale.join(" / ")} px
- Fonts: Geist Sans (all UI), Geist Mono (code) — bundled woff2, zero inline \`fontFamily\` (decision 5.2A)

## Entity type palette

Single source: \`ENTITY_TYPE_COLOR\` in the tokens module — consumed by BOTH
the Skia canvas renderer and the DOM overlay card (decision 5.1A). Fallback
for unknown types: \`${ENTITY_TYPE_FALLBACK_COLOR}\`.

${table(entityRows, ["Entity type", "Color"])}

## Guardrails

- The three-panel workspace is layout-first; do not introduce stacked-card
  shells (decision 4.1A).
- 44px hit areas are applied SELECTIVELY (\`hit-area-44\` utility) to isolated
  controls with ≥8px clearance — never dense rows or Electron drag regions
  (decisions TT + E3A).
- CSS custom properties in \`src/styles.css\` are pinned to these values; the
  design-guard tests fail when they drift.
`;

const outPath = join(import.meta.dirname, "..", "DESIGN.md");
writeFileSync(outPath, doc, "utf-8");
console.log(`Wrote ${outPath}`);
