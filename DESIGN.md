<!-- GENERATED FILE — do not edit. -->
<!-- Source: src/constants/design-tokens.ts · Regenerate: bun run gen:design -->

# Game Theory Analyzer — Design System

The app is a dark, layout-first desktop workspace. The entity-graph canvas is
the primary surface; panels and chat support it. Cards appear ONLY as canvas
entity nodes, the overlay form container, and transcript messages — never as
shell or section structure (decision 4.1A).

## Surfaces

| Token | Value |
| --- | --- |
| surface.base (canvas) | `#0C0C0E` |
| surface.panel (panels/cards) | `#18181B` |
| surface.raised (raised/hover) | `#27272A` |
| border.subtle | `#3F3F46` |

## Text roles

Contrast comes from semantic roles, not ad-hoc zinc shades (decision 11A).

| Token | Value |
| --- | --- |
| text.primary | `#E4E4E7` |
| text.secondary | `#D4D4D8` |
| text.label | `#A1A1AA` |
| text.header | `#71717A` |

## Accent & state

| Token | Value |
| --- | --- |
| accent (amber-500) | `#F59E0B` |
| state.stale | `#F59E0B` |
| state.error | `#F87171` |
| state.success | `#34D399` |

## Focus ring

`#F59E0B`, 2px, offset 2px — applied globally via `:focus-visible`.

## Geometry & type

- Radius: 6px cards / 8px panels
- Spacing base: 4px
- Type scale: 11 / 12 / 13 / 14 / 16 px
- Fonts: Geist Sans (all UI), Geist Mono (code) — bundled woff2, zero inline `fontFamily` (decision 5.2A)

## Entity type palette

Single source: `ENTITY_TYPE_COLOR` in the tokens module — consumed by BOTH
the Skia canvas renderer and the DOM overlay card (decision 5.1A). Fallback
for unknown types: `#A1A1AA`.

| Entity type | Color |
| --- | --- |
| player | `#60A5FA` |
| objective | `#818CF8` |
| game | `#FBBF24` |
| strategy | `#F59E0B` |
| fact | `#94A3B8` |
| payoff | `#FCD34D` |
| institutional-rule | `#A1A1AA` |
| escalation-rung | `#4ADE80` |
| interaction-history | `#60A5FA` |
| repeated-game-pattern | `#94A3B8` |
| trust-assessment | `#34D399` |
| dynamic-inconsistency | `#F472B6` |
| signaling-effect | `#F472B6` |
| payoff-matrix | `#FCD34D` |
| game-tree | `#FBBF24` |
| equilibrium-result | `#A78BFA` |
| cross-game-constraint-table | `#A1A1AA` |
| cross-game-effect | `#A1A1AA` |
| signal-classification | `#F472B6` |
| bargaining-dynamics | `#F59E0B` |
| option-value-assessment | `#FCD34D` |
| behavioral-overlay | `#F97316` |
| assumption | `#CBD5E1` |
| eliminated-outcome | `#EF4444` |
| scenario | `#22D3EE` |
| central-thesis | `#A78BFA` |
| meta-check | `#F97316` |
| analysis-report | `#A1A1AA` |

## Guardrails

- The three-panel workspace is layout-first; do not introduce stacked-card
  shells (decision 4.1A).
- 44px hit areas are applied SELECTIVELY (`hit-area-44` utility) to isolated
  controls with ≥8px clearance — never dense rows or Electron drag regions
  (decisions TT + E3A).
- CSS custom properties in `src/styles.css` are pinned to these values; the
  design-guard tests fail when they drift.
