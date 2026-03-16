# Pencil.dev Prompt v2 — Overview as Command Center

## Context

This .pen file contains "Strategic Lens," an AI-powered game theory analysis platform. The screens and components are built but need structural updates:

1. **Overview redesigned** as a conversation-first command center
2. **Sidebar nav reordered** — Overview, Timeline, Scenarios, Play-outs, Models, Phases
3. **Timeline and Scenarios screens created** — they're top-level nav items now
4. **Inspector sidebar made interactive** on all phase screens — clicking entities shows detail
5. **NavContent component updated** to reflect new nav order

**Preserve**: The visual design system (dark theme, amber accent, JetBrains Mono, card styling). All existing components.

---

## Step 1: Update NavContent component (9VkzH)

The sidebar navigation order must change. Currently it's: Analysis (Overview, Timeline), Phases (P1-P10), Model (Game Map, Evidence, Players, Assumptions), Explore (Scenarios, Play-out), Settings.

**New order:**

```
STRATEGIC LENS (logo — keep existing header)

Overview          ← icon: layout-dashboard, first item, active by default
Timeline          ← icon: clock
Scenarios         ← icon: git-branch
Play-outs         ← icon: play

MODELS            ← section label
  Game Map        ← icon: map
  Evidence        ← icon: file-text
  Players         ← icon: users
  Assumptions     ← icon: shield-alert

PHASES            ← section label (collapsible in future)
  P1 Grounding    ← with status icons (keep existing phase items)
  P2 Players
  P3 Baseline
  P4 History
  P5 Revalidation
  P6 Formalization
  P7 Assumptions
  P8 Elimination
  P9 Scenarios
  P10 Meta-check

────────
  Settings        ← icon: settings, bottom
```

Implementation:
1. Read the current NavContent (9VkzH) structure with `batch_get`
2. Reorganize children to match this order using Move operations
3. Remove the old "ANALYSIS" and "EXPLORE" section labels
4. Add a "MODELS" section label before Game Map
5. Keep the "PHASES" section label
6. Move Overview and Timeline to the top (before any section labels)
7. Move Scenarios and Play-out between Timeline and MODELS section
8. Remove duplicate Scenarios from EXPLORE section (it's now top-level)

---

## Step 2: Redesign Overview screen (CLOn7) as Command Center

The Overview (Analysis Dashboard, ID: `CLOn7`) needs a complete redesign of its main content area. The sidebar uses NavContent (already updated in Step 1). Add an inspector panel on the right.

**New layout:**

```
┌──────────┬──────────────────────────────────┬────────────┐
│ Sidebar  │  Main Content (vertical layout)  │ Inspector  │
│ (240px)  │                                  │ (320px)    │
│          │  ┌────────────────────────────┐  │            │
│          │  │ Conversation Area          │  │ (empty     │
│          │  │ (scrollable, flex-grow)    │  │  state:    │
│          │  │                            │  │  "Click    │
│          │  │ AI: Starting Phase 1...    │  │  any item  │
│          │  │ AI: Found 12 evidence...   │  │  to see    │
│          │  │ User: Focus on China...    │  │  details") │
│          │  │ AI: Adjusting research...  │  │            │
│          │  │ AI: 6 players identified   │  │            │
│          │  │ [Proposal cards inline]    │  │            │
│          │  │                            │  │            │
│          │  └────────────────────────────┘  │            │
│          │  ┌────────────────────────────┐  │            │
│          │  │ Chat Input                 │  │            │
│          │  │ [Type a message...]  [Send]│  │            │
│          │  └────────────────────────────┘  │            │
│          │  ┌────────────────────────────┐  │            │
│          │  │ Phase Progress Bar (1 line)│  │            │
│          │  └────────────────────────────┘  │            │
│          │  ┌────────────────────────────┐  │            │
│          │  │ Key Findings (compact)     │  │            │
│          │  └────────────────────────────┘  │            │
└──────────┴──────────────────────────────────┴────────────┘
```

**Main content implementation:**

1. **Conversation area** (takes most of the vertical space):
   - Vertical scrollable area with messages
   - Each message is a card-style bubble:
     - **AI messages** (left-aligned): fill #141415, border 1px #27272A, cornerRadius 8, padding 16
       - Contains structured content: text, inline proposal cards, scenario cards, findings
       - Phase transition messages: amber left border + phase badge
       - Result messages: green left border + completion badge
     - **User messages** (right-aligned): fill #F5A62315, border 1px #F5A62340, cornerRadius 8, padding 16
       - Plain text, right-aligned
   - Show 5-7 example messages to demonstrate the conversation flow:
     1. AI: "Starting analysis: US-Iran Military Confrontation 2026" [with phase badge P1]
     2. AI: "Phase 1 complete. 24 evidence items collected across 7 categories." [with completion badge, small summary cards]
     3. AI: "Phase 2: Identified 6 players. Review proposals:" [with 3 small inline proposal cards showing player names + type badges + accept/reject buttons]
     4. User: "Add IRGC as a separate actor from Iran — they have independent agency"
     5. AI: "Added IRGC as Intra-agent player. Revalidation triggered — re-running Phase 3." [with ⚠ revalidation badge]
     6. AI: "Analysis complete. Central thesis:" [with thesis card + 4 small scenario summary cards]
     7. User: "What if Iran's reconstitution is more damaged than assessed?"

2. **Chat input bar** (fixed at bottom of conversation):
   - Horizontal layout, aligned center
   - Text input: fill #141415, border 1px #27272A, cornerRadius 8, height 40, placeholder "Ask a question, give direction, or request follow-up..."
   - Send button: small, fill #F5A623, icon "send" (lucide), 32x32

3. **Phase progress bar** (compact, below conversation):
   - Horizontal layout showing 10 small circles connected by lines
   - P1-P4: green circles (complete)
   - P5: orange circle (revalidation)
   - P6: amber pulsing (active)
   - P7-P10: gray circles (pending)
   - Shows "Pass 2" indicator if revalidation has fired
   - Clickable — each phase circle navigates to that phase detail

4. **Key findings row** (compact cards below progress bar):
   - Horizontal scrollable row of small summary cards
   - "6 Players" | "3 Games" | "18 Assumptions" | "4 Eliminated" | "4 Scenarios"
   - Each clickable → navigates to the relevant screen

**Inspector panel** (right side, 320px):
- Default empty state: "Click any entity to see details" (centered, muted text)
- When an entity in the conversation is clicked (player name, game name, scenario card, etc.), inspector shows the full detail
- Inspector has header with breadcrumb: "Player > United States" and "Open in Phase 2" link
- Collapsible sections for different detail categories

---

## Step 3: Create Timeline screen (new)

**Position**: Find empty canvas space below the last row of existing screens.
**Size**: 1440x900, clip: true

**Layout**: Sidebar (NavContent ref with Timeline highlighted) + main content + inspector (320px)

**Main content**:
- **Top bar**: "Timeline" title, filter controls (horizontal: "All" | "Facts" | "Player Moves" | "Escalation" | "Analysis")
- **Timeline visualization** (vertical layout, scrollable):
  - Vertical line on the left (2px, #27272A)
  - Timeline events as cards connected to the line:
    - Each event card: fill #0F0F10, border 1px #27272A, cornerRadius 4, padding 12, gap 8
    - Left: colored dot on the timeline line (blue = fact, amber = player move, red = escalation, green = analysis)
    - Date text: JetBrains Mono, fontSize 10, fill #71717A
    - Event title: fontSize 13, fill #FAFAFA, fontWeight 600
    - Description: fontSize 12, fill #A1A1AA
    - Phase badge: which phase this came from (small badge)
    - Player badges: which players are involved
  - Example events (chronological):
    - 2015-07: "JCPOA Signed" — [P4] [COOPERATION] — US, Iran, EU
    - 2018-05: "US Withdraws from JCPOA" — [P4] [DEFECTION] — US
    - 2025-03: "Nuclear Facility Strikes Begin" — [P1] [ESCALATION] — US, Israel
    - 2025-03: "Strait of Hormuz Closed" — [P1] [ESCALATION] — Iran
    - 2026-01: "Phase 4 triggered revalidation" — [P5] [ANALYSIS] — System

**Inspector**: Clicking any event shows full detail — source, evidence references, impact on model

---

## Step 4: Create Scenarios screen (new)

**Position**: Find empty canvas space.
**Size**: 1440x900, clip: true

**Layout**: Sidebar (NavContent ref with Scenarios highlighted) + main content + inspector (320px)

**Main content**:
- **Central thesis card** (full width, fill #141415, border 1px #F5A62340, cornerRadius 4, padding 20):
  - "CENTRAL THESIS — FALSIFIABLE" badge
  - Thesis text: "The US won every battle and may lose the war — the strategy of winning individual games destroyed the cooperative infrastructure that underpinned the regional order."
  - Falsification condition: "If the US achieves stated objectives without predicted structural costs within 12 months"

- **Probability bar** (full width, horizontal segments, 40px tall):
  - 4 colored segments proportional to probabilities
  - Labels below each segment

- **Scenario cards** (horizontal row, 4 cards, gap 16):
  - Reuse existing ScenarioCard component (reebE)
  - Each card clickable → inspector shows full detail
  - Cards: "Prolonged Attrition" 40-45%, "Regional Escalation" 25-30%, "Coerced Settlement" 15-20%, "Strategic Reset" 5-10%

- **Tail Risks section** (below scenarios):
  - Title: "Tail Risks" with warning icon
  - 2 compact cards with red-tinted borders
  - Each shows: event, probability, trigger, consequences

- **Eliminated Outcomes section** (below tail risks):
  - Compact list of eliminated outcomes with phase references
  - Clickable → inspector shows full reasoning

- **Final Test section** (bottom):
  - Title: "Final Test — 6 Questions"
  - 6 cards, each showing a question from the playbook's final test with the analysis's answer
  - Questions:
    1. "What is the smallest game that captures the core strategic tension?"
    2. "What did the repeated interaction history do to today's incentives?"
    3. "Which strategies are feasible once constraints are added?"
    4. "What equilibrium behavior follows from that structure?"
    5. "Which parts come from the model vs analyst judgment?"
    6. "What evidence would change the central prediction?"

---

## Step 5: Add inspector panel to phase screens that lack it

Several phase screens were designed without a right-side inspector panel. Add a 320px inspector panel (fill #0F0F10, border-left 1px #27272A) to the right side of:

- Phase 1 (zlrJg) — currently full-width main content
- Phase 2 (MZLj1) — currently full-width main content
- Phase 3 (vs306) — has two-column layout but no dedicated inspector
- Phase 4 (R5Zmi) — has two-column layout but no dedicated inspector
- Phase 5 (tzbOm) — currently full-width
- Phase 7 (w66w6) — currently full-width
- Phase 8 (2N7FZ) — currently full-width
- Phase 9 (Sd0FW) — currently full-width
- Phase 10 (NGfqM) — currently full-width

Phase 6 (ID1Vg) already has an inspector panel — use it as the reference pattern.

For each screen:
1. Read the current structure with `batch_get`
2. Reduce the main content width to accommodate a 320px inspector
3. Add an inspector frame (vertical layout, fill #0F0F10, border-left 1px #27272A, width 320, padding 20)
4. Inspector default content:
   - "INSPECTOR" label (JetBrains Mono, fontSize 10, #71717A, letterSpacing 1.5)
   - "Click any highlighted item to see details" (fontSize 12, #52525B, centered)
   - Small icon (lucide "mouse-pointer-click", 24x24, #27272A)

---

## Step 6: Remove orphan nav items from old design

Check if there are any nav items in NavContent that don't have corresponding screens (e.g., "Assumptions" lens — there's no standalone Assumptions screen frame). If so, either:
- Create a simple placeholder screen for it, OR
- Remove it from the nav

The Assumptions lens is mentioned in the journey map but may not have a frame. If not, create a simple one following the same pattern as Players (k6ovj).

---

## Execution order

1. **Step 1**: Update NavContent sidebar order (fixes all screens via ref propagation)
2. **Step 2**: Redesign Overview as command center (most important change)
3. **Step 3**: Create Timeline screen
4. **Step 4**: Create Scenarios screen
5. **Step 5**: Add inspector panels to phase screens
6. **Step 6**: Handle orphan nav items
7. **Verify**: Screenshot Overview, Timeline, Scenarios, and 2-3 phase screens

---

## Canvas placement

New screens should follow the single-column layout convention:
- Timeline: place in a new row below Settings (y = 18700, x = 0)
- Scenarios: place in the same row as Timeline (y = 18700, x = 1540) — since they're both top-level nav peers
- Or use `find_empty_space_on_canvas` to find appropriate positions

All screens are 1440x900 with `clip: true`.

---

## Quality checklist

- [ ] NavContent sidebar shows new order: Overview, Timeline, Scenarios, Play-outs, then Models, then Phases
- [ ] Overview has conversation area with example messages, chat input, phase progress bar, key findings
- [ ] Overview has inspector panel on right side
- [ ] Timeline screen exists with chronological events and filter controls
- [ ] Scenarios screen exists with central thesis, probability bar, scenario cards, tail risks, final test
- [ ] All phase screens have inspector panels (320px right side)
- [ ] Inspector default state shows "Click any item to see details"
- [ ] No orphan nav items (every nav item has a screen)
- [ ] All screens are 1440x900 with clip: true
- [ ] Design system preserved (colors, fonts, card styling)
