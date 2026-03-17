# UX Journey Map v2 — Overview as Command Center

## The mental model

The app is an AI-powered analytical platform. The user asks a question. The AI conducts the full game theory workflow per the playbook. The user watches, steers, and gets results — ideally without ever leaving the Overview.

The methodology and UX are domain-general. The same phases, player types, and analytical structures apply to geopolitical conflicts, business competition, legal disputes, organizational dynamics, or textbook exercises. The app adapts its language and research focus to the domain — not its structure.

**Two consumers, one data model:**
1. **For the user**: Ask questions, watch the AI work, steer the analysis, get results, ask follow-ups
2. **For the AI**: Structured working memory — entity types force structural reasoning over prose

**The Overview is the command center.** Most users should never need to leave it. The phase detail views, model lenses, and exploration screens are optional drill-downs for users who want to inspect or edit the AI's working memory at a specific analytical stage.

---

## Navigation architecture

### Sidebar structure

```
STRATEGIC LENS (logo)

Overview          ← command center, where most users live
Timeline          ← chronological view across all phases
Scenarios         ← predictions, central thesis, tail risks
Play-outs         ← interactive simulation / war-gaming

MODELS            ← cross-cutting entity lenses
  Game Map
  Evidence
  Players
  Assumptions

PHASES            ← collapsible, drill-down detail views
  P1  Grounding        [status icon]
  P2  Players           [status icon]
  P3  Baseline Model    [status icon]
  P4  History           [status icon]
  P5  Revalidation      [status icon]
  P6  Formalization     [status icon]
  P7  Assumptions       [status icon]
  P8  Elimination       [status icon]
  P9  Scenarios         [status icon]
  P10 Meta-check        [status icon]

────────
  Settings
```

The nav puts the user's primary concerns first (what's happening, what are the predictions, what can I explore) and the AI's internal process second (phases are available but collapsed by default).

### Phase status icons

- `○` Pending (not started)
- `◉` Active (AI is working on this)
- `✓` Complete (AI finished, user accepted)
- `⚠` Needs rerun (recursive revalidation triggered)
- `◐` Partial (some proposals pending review)
- `●` User review needed (AI has unreviewed proposals)

---

## Interactive inspector sidebar (right panel)

Every screen (except Welcome and New Analysis) has a right-side inspector panel. When the user clicks a domain entity or analytical concept in the main content area, the inspector shows expanded detail.

### What is clickable (opens inspector)

| Element | Inspector shows |
|---------|----------------|
| **Player name** | Full profile: objectives (AND clauses), internal conflicts, priority ordering, non-standard utility, information asymmetries, games they participate in, trust levels |
| **Game name** | Structure, players, formalization type, canonical match, equilibrium results, cross-game links |
| **Evidence item** | Full source with timestamp, derivation chain (source → observation → claim → inference → assumption), which assumptions depend on it |
| **Assumption** | Sensitivity rating, type, "what if wrong?", correlated cluster, dependent scenarios, supporting evidence chain, game-theoretic vs empirical classification |
| **Pattern card** (e.g., "Dual-Track Deception") | Pattern definition, historical instances found, impact on trust assessment, which model conclusions depend on it, playbook reference |
| **Scenario card** | Full narrative, all key assumptions, invalidation conditions, model basis, cross-game interactions, equilibrium vs discretionary label |
| **Eliminated outcome** | Full reasoning chain with phase references, evidence supporting elimination, surprise factor |
| **Escalation rung** | Evidence, reversibility, player attribution, strategic implications, what triggers the next rung |
| **Trust gauge** | Evidence for the trust level, interaction history summary, which patterns drive it |
| **Cross-game link** | Trigger, effect type, magnitude, direction, cascade analysis |
| **Equilibrium result** | Selection reasoning (path dependence, focal points, commitment devices, institutional rules), what changes if assumptions shift |
| **Strategy in strategy table** | Feasibility analysis, which institutional constraints affect it, dominated/non-dominated status |

### What is NOT clickable (display only)

- Section headers and labels
- Status badges (COMPLETE, IN PROGRESS, CRITICAL, sensitivity badges)
- Probability bars, progress indicators
- UI chrome (dividers, spacers, backgrounds)
- AI status text, convergence indicators

### Inspector behavior

- Inspector panel is ~320px wide, right side of every screen
- Clicking a different entity replaces the inspector content
- Inspector shows a breadcrumb of what's being inspected: "Player > United States"
- Inspector has an "Open in Phase" link to jump to the phase detail where this entity lives
- Inspector content is read-only by default; "Edit" button enters edit mode and dispatches commands through the spine
- Same entity clicked from any screen shows the same inspector view (consistent across Overview, phase screens, model lenses)

---

## Screen inventory

### 1. Welcome Screen (Q6bCo)

**Purpose**: Entry point. Start new analysis or open existing.

**Content**:
- Logo + "AI-POWERED GAME THEORY ANALYSIS" tagline
- 3 cards: New Analysis, Open Analysis, Load Example
- Recent files list
- Status bar

### 2. New Analysis (EaOxi)

**Purpose**: User describes the event/question.

**Layout**: Centered, no sidebar (pre-analysis)

**Content**:
- Large text input: "Describe the event or strategic situation"
- Optional: attach reference documents
- AI provider status
- "Begin Analysis" → transitions to Overview
- "Manual Mode" → creates analysis without AI

### 3. Overview — The Command Center (CLOn7)

**Purpose**: The primary workspace. Users should be able to stay here for the entire analysis.

**Layout**: Sidebar + main content (conversation-first) + inspector panel

```
┌─────────┬──────────────────────────────────┬────────────┐
│ Sidebar │  Main Content                    │ Inspector  │
│         │                                  │            │
│ Overview│  ┌────────────────────────────┐  │ (shows     │
│ Timeline│  │ Conversation / Chat Area   │  │  detail    │
│ Scenari │  │                            │  │  when user │
│ Play-out│  │ User messages + AI updates │  │  clicks    │
│         │  │ Proposals inline           │  │  an entity │
│ MODELS  │  │ Results inline             │  │  in main   │
│  Game.. │  │                            │  │  content)  │
│  Evid.. │  └────────────────────────────┘  │            │
│  Play.. │  ┌────────────────────────────┐  │            │
│  Assu.. │  │ Phase Progress Bar         │  │            │
│         │  └────────────────────────────┘  │            │
│ PHASES  │  ┌────────────────────────────┐  │            │
│  P1-P10 │  │ Key Findings Cards         │  │            │
│         │  └────────────────────────────┘  │            │
│ Settings│                                  │            │
└─────────┴──────────────────────────────────┴────────────┘
```

**Main content — top section: Conversation area**

This is the core interaction pattern. It's a threaded conversation between the user and the AI:

- **User messages**: Questions, directions, follow-ups
  - "Analyze the US-Iran military confrontation following nuclear facility strikes"
  - "Focus more on China's role — they're exploiting this for yuan oil"
  - "I disagree that this is chicken. It's more like a war of attrition. Reframe."
  - "What if Iran's nuclear reconstitution is more damaged than we assessed?"
  - "Rerun scenarios with the assumption that Senate passes War Powers resolution"
- **AI responses**: Structured updates, proposals, results
  - Phase transitions: "Starting Phase 2: Player Identification..."
  - Findings: "Identified 6 players. 3 proposals for your review." [inline proposal cards]
  - Results: "Analysis complete. Central thesis: [thesis]. 4 scenarios generated." [inline scenario cards]
  - Revalidation: "Phase 4 findings triggered revalidation. Looping back to Phase 2 — new player (IRGC) discovered as separate actor."
- **Inline proposals**: Accept/reject/modify without leaving the conversation
- **Inline results**: Scenarios, eliminations, thesis displayed in the conversation flow
- **Steering controls**: The user can type directions at any time, and the AI adjusts

**Main content — middle section: Phase progress bar**

Horizontal visualization of all 10 phases with status colors. Compact — one line. Shows which pass (1st, 2nd, 3rd) if revalidation has fired. Clicking a phase in the bar navigates to the phase detail screen.

**Main content — bottom section: Key findings dashboard**

Summary cards for completed phases (collapsible/expandable):
- "12 evidence items" → click to see in Evidence lens
- "6 players identified" → click to see in Players lens
- "3 games formalized" → click to see in Game Map
- "4 outcomes eliminated" → click to see in Phase 8
- "Central thesis" → displayed prominently when analysis is complete
- "4 scenarios" → click to see in Scenarios screen

These cards are clickable — they open the inspector with the relevant detail.

**What makes this work**: The conversation pattern solves the steering gap. The user doesn't just accept/reject — they direct, redirect, disagree, ask "why", request alternatives, and ask follow-ups. The AI's structured output (proposals, findings, results) appears inline in the conversation. The phase progress bar and key findings dashboard provide at-a-glance status without needing to navigate.

### 4. Timeline

**Purpose**: Chronological cross-cutting view aggregating events from all phases.

**Layout**: Sidebar + main content + inspector

**Content**:
- Horizontal or vertical timeline showing events from:
  - Phase 1: Real-world facts with dates
  - Phase 4: Historical player interactions
  - Analysis events: When the AI made key findings, when revalidation fired
- Filter by: event type (real-world / historical / analysis), player, game
- Each event is clickable → inspector shows full detail
- Color-coded by type: facts (blue), player moves (amber), escalation events (red), analysis milestones (green)

**Why this earns its own screen**: No single phase provides a unified chronological view. The Timeline aggregates events from Phases 1 and 4, plus analysis milestones, into one temporal lens. Useful for seeing patterns across time that aren't visible in any single phase.

### 5. Scenarios

**Purpose**: Results workspace — predictions, probabilities, central thesis.

**Layout**: Sidebar + main content + inspector

**Content**:
- **Central thesis** prominently displayed at top (falsifiable claim)
- **Probability bar**: All scenarios summing to ~100%
- **Scenario cards** (2-4 scenarios side by side):
  - Narrative summary
  - Probability with confidence range
  - Key assumptions (clickable → inspector)
  - Invalidation conditions
  - Model basis (which game drives it, clickable → inspector)
  - Cross-game interactions essential to the scenario
  - Equilibrium vs Discretionary label (prominent, not a small badge)
- **Tail risks section**: Low-probability, high-consequence events
- **Eliminated outcomes summary**: What can't happen (clickable → inspector shows full reasoning)
- **Final test**: The 6 questions from the playbook's "Final test" section, with the analysis's answers

**Why this earns its own screen**: Phase 9 shows scenarios in the context of the AI's phase work (proposals, process). This screen is the clean **results view** — just the predictions, thesis, and evidence. The Overview shows a summary; this screen lets you work with scenarios in depth, compare them, track invalidation conditions.

**User actions**: Adjust probabilities, modify narratives, add scenarios, edit tail risks, export results

### 6. Play-out (9BFsL)

**Purpose**: Turn-by-turn interactive simulation.

**Content**: (largely unchanged)
- Branch management, turn history
- AI-controlled vs human-controlled players
- Shock injection
- Cascade inspector
- Integrates with Phase 6 formalizations

### 7. Model lenses (under MODELS in nav)

#### Game Map (BRXbm)
- All games as nodes, cross-game links as edges
- Player nodes connected to their games
- Click any entity → inspector shows detail
- "Open in Phase 6" link for each game

#### Evidence Library (cbQgB)
- Evidence ladder: Sources → Observations → Claims → Inferences → Assumptions
- Filter by phase, sensitivity, type
- Click any evidence item → inspector shows derivation chain
- Phase attribution badges on each item

#### Evidence Detail (pmKCV)
- Detailed view of a single evidence item's full derivation chain
- May be merged into Evidence Library as a drill-down rather than a separate screen

#### Players (k6ovj)
- Player cards with: type tag, objectives, games, trust levels
- Click any player → inspector shows full profile
- Trust assessments from Phase 4 integrated

#### Assumptions
- Assumption cards with sensitivity, type, "if wrong", classification
- Filter by sensitivity, type, correlated cluster
- Click any assumption → inspector shows dependencies

### 8. Phase detail views (under PHASES in nav, collapsible)

These are drill-down views for users who want to inspect or edit the AI's working memory at a specific phase. Each has the same layout: sidebar + main content + inspector.

**All phase screens support the inspector pattern.** Every domain entity displayed is clickable.

Phase detail content specifications are unchanged from the previous version, with these additions to address playbook gaps:

#### Phase 1 additions
- All 7 evidence categories from the playbook: Capabilities & Resources, Economic & Financial, Stakeholder Positions, Impact on Affected Parties, Timeline, Actions vs Statements, Rules & Constraints
- "Actions vs Words" section explicitly distinguishing what players have done from what they've said

#### Phase 2 additions
- Priority ordering on player cards (which objectives are absolute vs tradable)
- Stability indicator (is the objective function shifting?)
- Non-standard utility section (ideological commitments, honor-based reasoning)
- Information asymmetries panel (what each player knows/doesn't know about others)

#### Phase 3 additions
- "What does this model fail to explain?" prompt — explicit callout
- Move order and time structure section with three time notions (event time, model time, simulation time)
- Adjacent games test: "Add only if it changes the answer" decision cards
- Cross-game constraint table (strategies × games matrix with ✓/✗/? annotations)

#### Phase 4 additions
- Dynamic inconsistency risks section (treaty ratification vs executive discretion, electoral cycles)
- Global signaling effects section (what lessons has the broader system drawn?)
- Full 6-question re-check from playbook section 4f

#### Phase 5 change
- Phase 5 is now a **log/dashboard of all revalidation events**, not a place where revalidation "happens"
- Revalidation can fire from any phase — the Phase 5 screen shows the history
- The recursive loop is a persistent mechanism visible in the Overview's phase progress bar

#### Phase 6 additions (the most underdesigned phase)
- 6d: Equilibrium selection panel — 6 mechanisms (path dependence, focal points, relative cost, commitment devices, institutional rules, salient narratives)
- 6e: Bargaining dynamics section — outside options, patience, deadlines, commitment problems, dynamic inconsistency, issue linkage
- 6f: Communication analysis — cheap talk vs costly signals vs audience costs classification table
- 6g: Option value analysis — "doing nothing may be rational" assessment
- 6h: Behavioral overlays — prospect theory, biases, labeled explicitly as "ADJACENT — NOT CORE GAME THEORY"
- 6i: Cross-game effects — trigger/effect/magnitude/cascade for each link

#### Phase 10 additions
- All 10 meta-check questions from the playbook (not just 5)
- "Final test" section: the 6 questions every analysis must answer

### 9. Settings (LHpjA)
- AI provider configuration
- App preferences

### 10. No AI Provider (GPNco)
- Manual modeling mode
- Same phase structure, user does everything
- Prompt to configure AI provider

---

## User journeys

### Journey 1: AI-driven analysis — staying on Overview (primary)

```
Welcome Screen
  → "New Analysis"
  → New Analysis screen: "Analyze the US-Iran military confrontation"
  → "Begin Analysis"
  → Overview (command center):
    → User sees: "Starting Phase 1: Situational Grounding..."
    → AI streams findings as they arrive
    → User types: "Focus on institutional constraints — what does IAEA say?"
    → AI adjusts research focus, reports back
    → Phase progress bar updates: P1 ✓, P2 active...
    → AI proposes 6 players — inline proposal cards appear
    → User accepts 5, rejects 1, types "Add IRGC as separate actor"
    → AI continues through phases, updating inline
    → Revalidation fires: "Phase 4 broke the baseline model. Looping back."
    → Phase progress bar shows ⚠ on P2, P3
    → AI re-runs, converges
    → Results appear inline: "Central thesis: [thesis]. 4 scenarios."
    → User types: "What if Iran's reconstitution is more damaged?"
    → AI re-runs sensitivity analysis, updates scenarios
    → User satisfied — clicks Scenarios for deep comparison
    → Or clicks Play-out to simulate
```

### Journey 2: Drilling into phases (power user)

```
  [On Overview, analysis running]
  → User clicks P3 in sidebar → Phase 3 detail
  → Sees baseline model, escalation ladder, strategy table
  → Clicks "Prisoner's Dilemma" game name → inspector shows game detail
  → Clicks "Iran" in strategy table → inspector shows Iran's full player profile
  → Edits escalation ladder (adds a rung)
  → Returns to Overview via sidebar
  → AI acknowledges change, adjusts downstream
```

### Journey 3: Following up after analysis

```
  [Analysis complete, user on Overview]
  → User types: "New events: Iran tested a nuclear device"
  → AI recognizes this as a Phase 1 evidence update
  → Revalidation triggers: critical empirical assumption invalidated
  → AI re-runs affected phases
  → Updated scenarios appear inline
```

### Journey 4: Using the inspector

```
  [On Phase 4 screen]
  → User sees "Dual-Track Deception" pattern card
  → Clicks it → inspector shows:
    - Pattern definition from game theory
    - Historical instances found (2 events in 2019, 1 in 2023)
    - Impact: "All future diplomatic signals from Iran lose credibility"
    - Dependent conclusions: Trust assessment = ZERO, P8 elimination of negotiated settlement
    - Playbook reference: Phase 4b
  → User clicks "Trust assessment = ZERO" in inspector → inspector pivots to trust detail
  → User clicks "Open in Phase 4" → stays on Phase 4, scrolls to trust section
```

---

## Components needed (additions to existing set)

| Component | Purpose |
|-----------|---------|
| ConversationMessage/User | User message bubble in Overview conversation |
| ConversationMessage/AI | AI response with structured content (findings, proposals, results) |
| ConversationInput | Text input at bottom of conversation area |
| InlineProposalGroup | Group of proposals shown inline in conversation |
| InlineResultCard | Scenario/thesis/finding shown inline in conversation |
| TimelineEvent | Single event on the Timeline view |
| TimelineFilter | Filter controls for Timeline |
| InspectorHeader | Breadcrumb + entity type + "Open in Phase" link |
| InspectorSection | Collapsible section within inspector |
| FinalTestCard | One of the 6 "final test" questions with answer |

All previously created components are kept (PhaseStepperItem variants, ProposalCard, SensitivityBadge, PlayerTypeTag, TrustGauge, EscalationRung, ScenarioCard, EliminatedCard, etc.)

---

## Design system notes

Unchanged from v1:
- Dark theme, amber accent (#F5A623), JetBrains Mono, Space Grotesk for titles
- Card style: fill #0F0F10, border 1px #27272A, padding 16-20
- All existing color conventions preserved

New addition:
- Conversation bubbles: User messages right-aligned with subtle accent tint, AI messages left-aligned with card styling
- Inspector panel: Same dark card styling, 320px wide, subtle left border separator
