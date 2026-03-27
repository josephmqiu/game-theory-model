# Design System — Game Theory Analysis Tool

## Product Context

- **What this is:** A locally-deployed desktop app (Electron + React + Skia) for AI-assisted game-theoretic analysis of real-world events. Users chat with AI; the AI produces structured entities that materialize as an entity graph on a canvas.
- **Who it's for:** Analysts, researchers, and strategists studying geopolitical, regulatory, and strategic situations.
- **Space/industry:** Intelligence analysis, strategic research, structured analytical techniques.
- **Project type:** Desktop app — Skia canvas (primary surface) + React UI chrome (sidebars, toolbar, chat).

## Aesthetic Direction

- **Direction:** Industrial/Utilitarian with refined execution
- **Decoration level:** Minimal — typography, color, and spacing do all the work. No gradients, glow effects, or decorative elements. The entities ARE the visual richness.
- **Mood:** A Bloomberg terminal designed by someone who studied at RISD. Function-first, data-dense, but every pixel is considered. Serious without being sterile.
- **Dark mode only.** No light theme. Dark canvas reduces eye strain for long analysis sessions.

## Typography

- **Display/Hero:** Geist 700 — used sparingly in toolbar/headers
- **Body:** Geist 400 — chat messages, descriptions, UI text
- **UI/Labels:** Geist 500 — buttons, form labels, sidebar items
- **Data/Tables:** Geist (tabular-nums) — numeric data, confidence scores, revision counts
- **Code:** Geist Mono 400 — metadata, technical identifiers
- **Loading:** Bundled via Vite (already integrated)
- **Scale:**
  - 11px — type badges, phase headers, tertiary labels (uppercase, 0.05-0.1em tracking)
  - 12px — meta lines, secondary information
  - 13px — UI labels, sidebar items, data values
  - 14px — body text, chat messages
  - 15px — entity names (semi-bold, primary canvas text)
  - 16px — section headers
  - 24px — page titles (rare)

## Color

### Approach: Restrained

Entity type colors are the primary palette. UI chrome is monochrome zinc. Color is meaningful, never decorative.

### Entity Type Colors

| Type                        | Hex     | Role                                                |
| --------------------------- | ------- | --------------------------------------------------- |
| player                      | #60A5FA | Primary actors — blue signals agency                |
| objective                   | #818CF8 | Goals/aims — indigo, distinct from player           |
| game                        | #FBBF24 | Strategic structures — amber, high visibility       |
| strategy                    | #F59E0B | Action plans — warm amber, distinct from game       |
| fact                        | #94A3B8 | Background information — slate, neutral             |
| payoff                      | #FCD34D | Outcomes/values — yellow                            |
| institutional-rule          | #A1A1AA | Structural constraints — gray                       |
| escalation-rung             | #4ADE80 | Escalation dynamics — green                         |
| interaction-history         | #60A5FA | Historical interactions — blue (shared with player) |
| repeated-game-pattern       | #94A3B8 | Recurring patterns — slate                          |
| trust-assessment            | #34D399 | Trust evaluations — emerald                         |
| dynamic-inconsistency       | #F472B6 | Commitment problems — pink                          |
| signaling-effect            | #F472B6 | Signal analysis — pink                              |
| payoff-matrix               | #FCD34D | Matrix structures — yellow                          |
| game-tree                   | #FBBF24 | Decision trees — amber                              |
| equilibrium-result          | #A78BFA | Equilibrium findings — purple                       |
| cross-game-constraint-table | #A1A1AA | Cross-game constraints — gray                       |
| cross-game-effect           | #A1A1AA | Spillover effects — gray                            |
| signal-classification       | #F472B6 | Signal categories — pink                            |
| bargaining-dynamics         | #F59E0B | Bargaining analysis — warm amber                    |
| option-value-assessment     | #FCD34D | Option value — yellow                               |
| behavioral-overlay          | #F97316 | Behavioral factors — orange                         |
| assumption                  | #CBD5E1 | Analytical assumptions — light slate                |
| eliminated-outcome          | #EF4444 | Removed options — red                               |
| scenario                    | #22D3EE | Hypothetical futures — cyan                         |
| central-thesis              | #A78BFA | Core synthesis — purple                             |
| meta-check                  | #F97316 | Validation checks — orange                          |
| analysis-report             | #A1A1AA | Synthesis report — neutral chrome, verdict badge provides color |

### Verdict Badge Colors (analysis-report only)

| Verdict     | Hex     | Usage                          |
| ----------- | ------- | ------------------------------ |
| underpriced | #4ADE80 | Success green — bet opportunity |
| overpriced  | #EF4444 | Error red — market overpriced   |
| fair        | #FBBF24 | Warning amber — fairly priced   |

### Surface Hierarchy (dark mode)

| Surface  | Hex     | Usage                          |
| -------- | ------- | ------------------------------ |
| Canvas   | #0C0C0E | Main canvas background         |
| Chrome   | #111113 | Sidebars, toolbar, panels      |
| Surface  | #18181B | Cards, elevated containers     |
| Elevated | #1E1E22 | Hover states, popovers         |
| Border   | #27272A | Subtle dividers, card outlines |

### Text Hierarchy

| Role      | Hex     | Usage                                |
| --------- | ------- | ------------------------------------ |
| Primary   | #F4F4F5 | Entity names, headings, active items |
| Secondary | #A1A1AA | Body text, descriptions              |
| Tertiary  | #71717A | Meta lines, timestamps, placeholders |
| Muted     | #52525B | Phase headers, disabled items        |

### Semantic Colors

| State   | Hex     | Usage                                |
| ------- | ------- | ------------------------------------ |
| Success | #4ADE80 | Phase complete, valid state          |
| Warning | #FBBF24 | Stale entity badge, attention needed |
| Error   | #EF4444 | Phase failed, provider error         |
| Info    | #60A5FA | Active analysis, loading state       |

### Relationship Edge Styles

Edges are styled by **relationship category** (downstream, evidence, structural) — not individually per type. This creates three visually distinct layers that map to analytical meaning. Within each category, color distinguishes semantic role.

#### Rendering Layers (draw order: structural → evidence → downstream)

| Category     | Color   | Dash Pattern | Width | Opacity (unfocused) | Opacity (focused) | Z-Order |
| ------------ | ------- | ------------ | ----- | -------------------- | ------------------ | ------- |
| **Downstream** | #60A5FA | solid        | 2px   | 40%                  | 100%               | front   |
| **Evidence**   | varies  | dashed [6,4] | 1.5px | 25%                  | 100%               | middle  |
| **Structural** | #52525B | dotted [2,3] | 1px   | 15%                  | 80%                | back    |

#### Per-Type Color Overrides (within category)

| Relation         | Category   | Color   | Notes                                   |
| ---------------- | ---------- | ------- | --------------------------------------- |
| plays-in         | downstream | #60A5FA | Primary dependency — blue               |
| has-objective    | downstream | #818CF8 | Goal link — indigo                      |
| has-strategy     | downstream | #F59E0B | Strategy link — amber                   |
| produces         | downstream | #FBBF24 | Output link — warm amber                |
| depends-on       | downstream | #60A5FA | Generic dependency — blue               |
| derived-from     | downstream | #A78BFA | Derivation — purple                     |
| supports         | evidence   | #34D399 | Positive evidence — emerald             |
| contradicts      | evidence   | #F87171 | Negative evidence — red                 |
| informed-by      | evidence   | #94A3B8 | Neutral evidence — slate                |
| invalidated-by   | evidence   | #EF4444 | Invalidation — error red                |
| constrains       | structural | #52525B | Constraint — gray                       |
| escalates-to     | structural | #52525B | Escalation — gray                       |
| links            | structural | #52525B | Generic link — gray                     |
| precedes         | structural | #52525B | Temporal — gray                         |
| conflicts-with   | structural | #71717A | Conflict — slightly lighter gray        |

## Spacing

- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64)
- **Entity card padding:** 14px horizontal, 12px vertical
- **Entity card gap (same column):** 16px
- **Phase column gap:** Variable based on canvas zoom, minimum 60px visual space

## Layout

- **Approach:** Grid-disciplined — phase columns are structural scaffolding
- **Canvas entities:** Positioned in columns by methodology phase. Entities stack vertically within their column.
- **Max content width:** N/A (canvas is infinite, UI chrome is fixed-width sidebars)
- **Border radius:**
  - Entity cards: 6px
  - UI buttons: 6px
  - Input fields: 6px
  - Panels/modals: 8px
  - Badges/pills: 9999px (full round)

## Motion

- **Approach:** Minimal-functional — transitions that aid comprehension, nothing decorative
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150-250ms) medium(250-400ms) long(400-700ms)
- **Canvas transitions:** Entity appear/disappear, phase transitions, zoom/pan. No bounce, no spring.

## Entity Card Spec (Canvas Rendering)

This is the primary visual deliverable. Entities render on a Skia/CanvasKit canvas, not as DOM elements.

### Card Structure

```
+--+-------------------------------+
|  | TYPE BADGE          11px/500  |  ← uppercase, entity color at 70%
|  | Entity Name Here    15px/600  |  ← primary text, wraps to 2 lines
|  | meta / details      12px/400  |  ← tertiary color
+--+-------------------------------+
 ↑
 3px left accent bar (entity type color at 80%)
```

### Card Sizing

Content-aware sizing. Remove the 27-character name truncation — let names wrap to 2 lines max.

| Category | Types                                                                                                                                                                                               | Min Width | Min Height |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------- |
| Large    | player, game, interaction-history, payoff-matrix, game-tree, equilibrium-result, cross-game-constraint-table, scenario, central-thesis, meta-check, bargaining-dynamics                             | 260px     | 100px      |
| Medium   | fact, institutional-rule, repeated-game-pattern, trust-assessment, dynamic-inconsistency, cross-game-effect, signal-classification, option-value-assessment, behavioral-overlay, eliminated-outcome | 240px     | 85px       |
| Small    | objective, strategy, payoff, escalation-rung, signaling-effect, assumption                                                                                                                          | 220px     | 75px       |

Heights should expand to fit 2-line names. Maximum card height: 130px.

### Background Treatment

Each card background = entity type color at **8% opacity** over the surface color (#18181B).
This creates a subtle tinted field that makes entity types scannable without reading labels.

Implementation: blend `rgba(typeColor, 0.08)` with `#18181B` base, or pre-compute the blended hex.

### Left Accent Bar

- Width: 3px (high confidence), 2px (medium/low confidence)
- Color: entity type color at 80% opacity
- Style: solid (high/medium confidence), dashed (low confidence)
- Position: left edge of card, full height, inside the 6px border radius

### Confidence Encoding

| Level  | Accent Width | Accent Style | Accent Opacity | Card Opacity |
| ------ | ------------ | ------------ | -------------- | ------------ |
| High   | 3px          | solid        | 80%            | 100%         |
| Medium | 2px          | solid        | 60%            | 90%          |
| Low    | 2px          | dashed [6,4] | 50%            | 80%          |

### Stale Entity State

- Entire card at 40% opacity
- Yellow warning badge (#FBBF24) at top-right corner: 16px circle, "!" glyph in #18181B
- Applied on top of confidence encoding

### Selected State

- 2px outline in entity type color at 100%
- Subtle scale: 1.02x
- Transition: 150ms ease-out

### Text Content

- **Name:** `entityDisplayName()` output, NO truncation below the rendering level. Text wraps within card width minus padding. 2-line max with ellipsis on overflow.
- **Type badge:** Entity type label, uppercase, entity color at 70%
- **Meta line:** `entityMetaLine()` output, tertiary text color

## Connection Routing & Interaction Spec

This is the second primary visual deliverable (after entity cards). Connections render on the Skia canvas as routed edges between entity cards. The goal is a **subway map, not spaghetti** — every connection should be individually traceable.

### Problem Statement

With 20-40+ entities and 30-80+ relationships across 9 phase columns, naive center-to-center Bézier curves produce an unreadable mess. The solution is four reinforcing layers: port-based routing, interactive focus, edge bundling, and layered rendering.

### Layer 1: Port-Based Edge Routing

Edges connect to **ports** on card edges, not card centers.

#### Port Positions

```
            ┌─────────────────────────────┐
            │ TYPE BADGE                   │
  left ●────│ Entity Name                  │────● right
  ports     │ meta / details               │    ports
            └─────────────────────────────┘
```

- **Outgoing edges** exit from the **right edge** of the source card
- **Incoming edges** enter from the **left edge** of the target card
- Port y-offset: vertically distributed along the card's right/left edge, spaced evenly to avoid overlap
- If a card has 3 outgoing edges, ports are at 25%, 50%, 75% of card height
- If a card has 1 edge, port is at 50% (vertical center of card)
- **Same-phase connections** (rare): use top/bottom ports instead

#### Routing Algorithm

Use **Manhattan-style orthogonal routing** with rounded corners:

```
Source ●──────┐
              │         ← horizontal exit segment (16px min)
              └────────────● Target
                        ↑
              vertical channel segment
```

1. **Exit segment:** Horizontal line from right port, extending 16px right into the inter-column gap
2. **Channel segment:** Vertical line connecting to the target's y-level. Routes through the inter-column gap (the space between phase columns)
3. **Entry segment:** Horizontal line from channel into left port of target card
4. **Corner radius:** 6px rounded corners at each bend (matches card corner radius)
5. **Channel assignment:** When multiple edges share the same inter-column gap, assign distinct x-offsets within the gap to prevent overlap. Minimum 8px between parallel vertical channel segments.

#### Inter-Column Gap

Current fixed column spacing is 400px with cards 220-260px wide, leaving ~140-180px gaps. The routing channel lives in this gap.

- **Channel zone:** Center 60% of the gap (inner ~84-108px)
- **Edge spacing within channel:** 8px between parallel vertical segments
- **Max edges per channel:** `floor(channelWidth / 8)` — if exceeded, allow minor overlap with reduced opacity on extras

#### Long-Distance Edges (spanning 2+ columns)

For edges that cross multiple phase columns:

1. Route through intermediate column gaps as a series of horizontal + vertical segments
2. Prefer the **shortest vertical path** — hug close to the source/target y-levels
3. When multiple long edges share an intermediate column, bundle them (see Layer 3)

### Layer 2: Interactive Focus

The single most impactful UX improvement. Let users isolate connections for any entity.

#### Hover Behavior

- **Hover entity card** → highlight all edges connected to that entity
  - Connected edges: render at **100% opacity** in their category color
  - Unconnected edges: dim to **8% opacity** (nearly invisible)
  - Connected entity cards: maintain full opacity
  - Unconnected entity cards: dim to **40% opacity**
  - Transition: 150ms ease-out for both dim and restore

#### Click Behavior

- **Click entity card** → **lock** focus mode (persists until click elsewhere)
  - Same visual behavior as hover, but stable
  - Clicking canvas background clears focus
  - Clicking a different entity switches focus to that entity
  - Locked focus shows a subtle "focused" indicator on the entity (2px outline per Selected State spec)

#### Edge Hover

- **Hover an edge directly** → highlight just that edge and its two connected entities
  - The hovered edge: render at 100% opacity, 3px width (bump from default)
  - Its two connected cards: full opacity with selected state outline
  - Everything else: dim as in entity hover
  - Show a tooltip near cursor: "Player 1 → plays-in → RPS Core Game" (source → type → target)

#### Keyboard Support

- **Tab** through entities in phase order (left-to-right, top-to-bottom)
- **Enter** on focused entity locks focus mode
- **Escape** clears focus

### Layer 3: Edge Bundling

When multiple edges share the same source-phase → target-phase pair, merge their routing segments into a **trunk line** that splits at the destination column.

#### Bundling Algorithm

```
Phase 2 (Player ID)          Phase 4 (Historical Game)
┌──────────┐
│ Player 1  │──┐
└──────────┘  ├── trunk ──────────┬──● Game A
┌──────────┐  │                   ├──● Game B
│ Player 2  │──┘                   └──● Game C
└──────────┘
```

1. **Group edges** by (source-phase, target-phase) pair
2. **Within each group**, if 3+ edges share the pair, create a trunk line:
   - Source ends merge into a single vertical collector in the source column's exit channel
   - Trunk runs horizontally through intermediate gaps
   - Target ends split from trunk into individual entry segments at the target column
3. **Trunk rendering:** 3px width, category color at 60% opacity. The trunk visually communicates "there are N relationships between these phases"
4. **Split points:** Small 4px circles at trunk-to-branch junctions (matching trunk color at 40%)
5. **Hover on trunk:** expands to show individual edges with their specific types/colors
6. **Groups of 2:** Don't bundle — just route as parallel edges with 8px offset

#### Bundle Label (optional, on zoom)

When zoom level > 1.5x, show a small count badge on the trunk: "×5" in Geist Mono 10px, rendered at trunk midpoint.

### Layer 4: Visual Hierarchy (Rendering Order)

Draw edges in strict z-order so the most meaningful connections are always on top.

#### Draw Order (back to front)

1. **Structural edges** (constrains, escalates-to, links, precedes, conflicts-with)
   - 1px, dotted [2,3], gray (#52525B), 15% opacity
   - These are ambient — visible only if you look for them
   - Purpose: show structural context without competing with analytical edges

2. **Evidence edges** (supports, contradicts, informed-by, invalidated-by)
   - 1.5px, dashed [6,4], category-specific color, 25% opacity
   - These are secondary — visible but not dominant
   - Purpose: show analytical support/contradiction relationships

3. **Downstream edges** (plays-in, has-objective, has-strategy, produces, depends-on, derived-from)
   - 2px, solid, category-specific color, 40% opacity
   - These are primary — the backbone of the entity graph
   - Purpose: show the analytical dependency chain

4. **Focused edges** (any category, when entity is hovered/selected)
   - Full category width + 1px, full color, 100% opacity
   - These override all other rendering — always on top
   - Purpose: isolate what the user is looking at right now

#### Arrowheads

- **Downstream edges:** Small filled arrowhead (6px) at target end, pointing into left port
- **Evidence edges:** No arrowhead (bidirectional by nature)
- **Structural edges:** No arrowhead
- Arrowhead inherits edge color and opacity

### Implementation Notes

- All edge routing is computed in `layoutEntities()` as a post-pass after entity positions are assigned
- Edge routing state is cached and invalidated when entities move or relationships change
- The Skia renderer draws edges in three passes (structural → evidence → downstream), then focused edges on top
- Interactive focus state lives in the canvas store (`focusedEntityId: string | null`)
- Hit testing for edges: inflate each edge path by 4px for click/hover detection

### Performance Considerations

- **Edge bundling computation:** O(E log E) for grouping + O(E) for routing — fast enough for 100+ edges
- **Channel assignment:** Greedy left-to-right sweep, O(E) per column gap
- **Rendering budget:** With 80 edges at 3 z-layers, expect ~240 draw calls — well within Skia's frame budget
- **Cache invalidation:** Only recompute routing when entity positions or relationships change, not on pan/zoom

## Decisions Log

| Date       | Decision                                | Rationale                                                                                            |
| ---------- | --------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 2026-03-21 | Initial design system created           | Created by /design-consultation to fix unreadable entity cards on canvas                             |
| 2026-03-21 | Tinted card backgrounds per entity type | Enables instant type scanning with 26+ entity types — thin borders alone can't carry differentiation |
| 2026-03-21 | Left accent bar replaces full border    | Cleaner visual with two type signals (accent + tint) vs. one (border)                                |
| 2026-03-21 | Content-driven card sizing              | Fixed 120-180px cards caused universal name truncation. New minimums 220-260px with text wrapping    |
| 2026-03-21 | Objective gets #818CF8 (indigo)         | Was inheriting player blue — objectives need distinct identity                                       |
| 2026-03-21 | Geist confirmed as sole type family     | Already integrated, excellent readability at small sizes, tabular-nums for data                      |
| 2026-03-23 | Port-based edge routing replaces center-to-center | Center-to-center Bézier curves created unreadable spaghetti with 20+ entities. Port-based Manhattan routing with orthogonal segments is individually traceable |
| 2026-03-23 | Interactive focus (hover/click to isolate) | With 30-80 edges, static rendering is insufficient. Focus mode dims unrelated edges to 8%, making any single entity's connections instantly traceable |
| 2026-03-23 | Edge bundling for shared phase-pairs | Multiple edges between same phase columns merge into trunk lines. Reduces visual edge count by ~60% while preserving all data on hover |
| 2026-03-23 | Three-layer edge rendering by relationship category | downstream (primary, 2px, 40%) → evidence (secondary, 1.5px, 25%) → structural (ambient, 1px, 15%). Maps z-order to analytical importance |
| 2026-03-23 | Per-type edge colors within categories | Previous: only 4 types styled, 11 fell through to gray. Now all 15 relationship types have distinct colors within their category |
| 2026-03-23 | Arrowheads on downstream edges only | Downstream edges are directional (dependency chain). Evidence and structural edges are bidirectional — no arrowheads |
| 2026-03-23 | Analysis-report uses neutral chrome #A1A1AA | Report is a synthesis/presentation layer, not an entity type. Neutral chrome distinguishes it from all 27 entity types. Verdict badge provides the color pop (green/red/amber) |
| 2026-03-23 | Report renders as canvas card + overlay detail | Canvas card follows existing drawEntityNode() pattern. Overlay card (React/HTML) handles rich content: expandable sections, verdict, entity reference chips |
