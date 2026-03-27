# Architecture Maturity Plan

Date: 2026-03-25
Revision: 1
Status: Canonical maturity model for converging the Game Theory Analyzer toward the architecture contract

This document is a companion to `docs/architecture/architecture-contract.md`.
It does not replace the contract. It defines the maturity model between the
current repo shape and the target architecture.

It is intentionally product-specific. It borrows proven patterns from T3 Code
only where they strengthen the Game Theory Analyzer as a local-first analysis
workspace.

---

## Purpose

This document exists to answer five questions:

1. What architecture are we converging toward?
2. Which improvements are foundational versus optional?
3. How should the product model analysis work durably over time?
4. Which T3-inspired patterns should be adapted rather than copied directly?
5. What must not be transplanted, and why?

This document is not a migration checklist, a sprint plan, or a rewrite brief.
It is the bounded target maturity model.

---

## Relationship To Other Docs

- `docs/CURRENT-STATE.md` describes what is true in the repo today, but parts of
  it may become stale as the product moves from the current singleton analysis
  shape toward durable workspaces, threads, runs, and phase-turns.
- `docs/architecture/architecture-contract.md` defines the target architecture
  from first principles, but parts of it may also need revision if they still
  encode assumptions from the older stateless or single-run design.
- `docs/game-theory-analytical-methodology.md` remains the domain and phase
  methodology source of truth.
- This document defines the staged maturity model that gets the product from the
  current state toward the architecture contract without opening a second live
  architecture.

When these documents agree, the contract defines the target and this document
defines the intended convergence order.

When this document materially conflicts with older assumptions in
`docs/CURRENT-STATE.md` or `docs/architecture/architecture-contract.md`, treat
that as a signal that those documents need revision rather than a reason to
preserve the older shape by default.

---

## Core Direction

The Game Theory Analyzer should mature from a single-run, singleton-oriented,
prompt-stuffed application into a session-centric, provider-agnostic, durable
analysis workspace.

The major shift is:

- from `one active analysis run`
- to `workspace -> thread -> run -> phase-turn -> activity`

The product should preserve what is already differentiated:

- the canvas is the primary workspace
- the graph is the primary analytical representation
- the methodology remains explicit and phase-aware
- human override, challenge, and rerun remain first-class

The product should borrow from T3 where T3 is stronger:

- runtime boundaries
- provider/session modeling
- typed transport and events
- durable thread state
- projection-first UI
- shell reliability

The product should not become a coding-agent clone.

---

## Canonical Product Model

The following nouns are the durable model:

- `workspace`: the portable, local-first save/load unit
- `analysis-type`: the methodology family, such as `game-theory`
- `thread`: a durable conversation and decision lane inside a workspace
- `run`: one execution attempt in a thread with a concrete provider, model,
  effort, and prompt-pack version
- `phase-turn`: one durable analysis step within a run
- `message`: human or assistant utterance only
- `activity`: structured operational record such as tool use, web search,
  approval request, warning, or mutation proposal
- `prompt-pack`: versioned prompts, schemas, phase ordering, and tool policy
- `graph-entity`: canonical analytical knowledge node
- `relationship`: canonical analytical edge
- `pending-question`: unresolved user or analyst decision that blocks confidence
  or progression
- `artifact`: durable composed output such as a report, scenario package, or
  plan
- `provider-session-binding`: server-owned mapping from thread to provider-native
  session identifiers

The ownership model is:

- `workspace` owns `threads`, `graph-entities`, `relationships`,
  `pending-questions`, `artifacts`, and layout
- `thread` owns `messages` and `runs`
- `run` owns `phase-turns` and `activities`
- `provider-session-binding` is local runtime state, not portable workspace
  state

The language choice is deliberate:

- use `workspace`, not `project`
- use `artifact`, not `report` as the parent noun
- use `analysis` as an adjective, not the overloaded root aggregate

Reason:
T3's `project` language is coding-app language. This product is a local-first
analytical workspace, not a repo/worktree manager.

---

## Storage Split

Portable workspace state and local runtime state must be distinct.

Portable `.gta` state should contain:

- workspace metadata
- graph entities and relationships
- threads, messages, runs, and phase-turn summaries
- pending questions
- artifacts
- canvas layout and user view state that belongs to the workspace

Local non-portable runtime state should contain:

- provider-session bindings
- live process metadata
- transient reconnect metadata
- cached health check results
- temporary streaming buffers

Reason:
Provider-native session ids are integration state. Putting them into the
portable workspace would make saved workspaces misleading and less portable.

---

## Maturity Levels

## Level 1: Canonical Runtime Backbone

Goal:
Create one provider-neutral runtime model that the rest of the product talks to.

This level includes:

- provider-agnostic orchestration
- a canonical provider adapter contract
- Claude and Codex integrations behind one server-owned boundary
- typed runtime events and tagged errors
- provider health checks
- model and effort capability management
- WebSocket transport with reconnect and latest-push caching
- a serialized command queue with command receipts
- shell hardening that directly improves reliability

Exit criteria:

- the renderer no longer needs provider-specific branching to drive chat or
  analysis
- provider failures are distinguishable as typed runtime errors instead of raw
  strings
- the transport layer supports reconnect with exponential backoff and
  latest-push replay per channel
- write operations are serialized through a canonical server command path
- provider health is visible before a run begins
- model and effort selection are capability-driven rather than template-driven

## Level 2: Durable Threads And Prompt Packs

Goal:
Replace ephemeral chat and stateless phase execution with durable threads and
phase-turns.

This level includes:

- SQLite persistence for threads, messages, activities, runs, phase-turns, and
  provider-session bindings
- session resume for Claude and Codex
- external prompt packs for analysis types
- turning methodology phases into durable phase-turns inside a thread
- prompt-pack version capture on each run and phase-turn
- message attachments
- event store and projection tables

Exit criteria:

- chat survives app restart
- analysis runs survive app restart or fail back into a resumable state
- phases are no longer isolated single-shot requests
- prompt definitions are no longer hardcoded module constants
- runs reference the exact prompt-pack version they executed with
- graph-query tools replace most prompt stuffing

## Level 3: Guided Analysis Interaction

Goal:
Make the persisted runtime visible and usable as a serious analytical tool.

This level includes:

- streaming chat UX with text deltas, tool state, and activity views
- selective tool approval UX
- pending-question flows with multi-question handling
- analysis plan mode and plan artifacts
- per-thread model selection
- better settings UI
- analysis-aware plan follow-up and scenario branching surfaces

Exit criteria:

- the transcript is readable because messages and activities are distinct
- unresolved assumptions and user choices have first-class UI
- plans can be proposed, saved, and used to create follow-up threads
- settings are managed through a validated page rather than fragmented modal
  behavior

## Level 4: Reversibility, Audit, And Operational Hardening

Goal:
Make the product durable, inspectable, and safe under failure and rerun.

This level includes:

- thread CRUD and soft delete
- thread rollback
- workspace checkpoints and analysis snapshots
- event-sourced audit trail with causality metadata
- replay for domain events
- stronger crash recovery and shell lifecycle behavior

Exit criteria:

- the user can recover prior analytical states without losing trust in the
  workspace
- auditability exists at the command and domain-event level
- shell failures are bounded, observable, and recoverable

---

## Adoption Inventory

Each requested item is explicitly placed below.

### Borrow Now

- `Claude Agent SDK integration`:
  rebuild around a provider-neutral adapter boundary
  Reason: current provider semantics leak through the app and fight future
  session persistence.

- `Codex integration`:
  rebuild around the same adapter boundary
  Reason: current turn handling is too provider-specific and too ephemeral for
  durable threads.

- `provider routing / provider-agnostic orchestration`:
  foundational Level 1 work
  Reason: every other maturity gain depends on this boundary.

- `WebSocket transport with outbound queue, exponential backoff reconnection, latest-push caching per channel`:
  adopt in Level 1
  Reason: long-lived thread state and multi-channel runtime projection fit
  WebSocket better than the current SSE split.

- `tagged error classes and typed discriminated unions`:
  adopt in Level 1
  Reason: provider, transport, validation, session, and command failures must
  stay distinguishable.

- `chat streaming with text deltas, tool call display, activity logging`:
  adopt in Levels 1-3
  Reason: this is part of the runtime model and part of the interaction model.

- `better Electron shell`:
  adopt in Levels 1 and 4
  Includes: crash recovery with backoff restart, log rotation, auto-update,
  Windows process cleanup
  Reason: these improve operational truth directly and do not create product
  complexity.

- `command queue serializes all operations, command deduplication via receipts`:
  adopt in Level 1
  Reason: this is the cleanest way to keep one source of truth for writes.

- `chat persistence`:
  adopt in Level 2
  Reason: without durable threads, the app remains a restart-fragile demo path.

- `session resume`:
  adopt in Level 2
  Reason: thread durability is incomplete if provider sessions die at restart.

- `model management`:
  adopt in Levels 1 and 3
  Includes: custom models, per-thread model selection, availability filtering
  Reason: model choice is runtime state and user-facing workflow state.

- `reasoning effort levels`:
  adopt in Level 1
  Canonical levels should be `low`, `medium`, `high`, `max`
  Provider-specific aliases such as `ultrathink` may exist behind capability
  mapping
  Reason: provider-agnostic orchestration needs canonical effort levels.

- `provider health checks`:
  adopt in Level 1
  Reason: users should know before a run whether Codex or Claude can actually
  execute.

- `event sourcing / audit trail`:
  adopt in Level 2 and deepen in Level 4
  Reason: commands and domain events should be durable and replayable.

- `better Settings UI`:
  adopt in Level 3
  Includes: schema-validated preferences, binary paths, streaming toggle,
  timestamp format, custom models, renderer persistence plus server broadcast
  Reason: this is product usability, not optional polish.

- `prompt architecture`:
  adopt in Level 2
  Includes: prompt packs on disk, phase and chat prompts outside source code,
  schemas and tool policies beside prompts
  Reason: current prompt architecture is too hardcoded and too stateless to
  support durable analysis threads.

### Adapt Later

- `thread management`:
  adapt in Levels 2 and 4
  Includes: CRUD, soft delete, multiple threads
  Adaptation: multiple threads per `workspace`, not per `project`
  Reason: `project` is a coding-app noun; `workspace` is the correct durable
  root for this product.

- `tool approval UX`:
  adapt in Level 3
  Includes: approve/deny prompts, keyboard shortcuts, request queue
  Adaptation: approvals should apply to high-impact analysis actions, not every
  graph mutation
  Reason: blanket approval on every entity write would destroy flow in a
  multi-phase analysis run.

- `plan mode`:
  adapt in Level 3
  Includes: structured plans, markdown card, create follow-up thread from plan
  Adaptation: the created thread should be an analysis follow-up thread, scenario
  thread, or challenge thread, not an implementation thread
  Reason: this product produces analysis, not coding handoff.

- `askuserquestion handling`:
  adapt in Level 3
  Includes: multi-question flow, numeric shortcuts, auto-advance, custom answers
  Adaptation: connect it to `pending-question` as a first-class domain object
  Reason: user-input requests should be analysis-native, not provider callback
  glue.

- `thread rollback`:
  adapt in Level 4
  Includes: undo N turns, remove later turns, roll back provider state
  Reason: this only becomes safe once messages, activities, phase-turns, and
  provider-session bindings are durable.

- `message attachments`:
  adapt in Level 2
  Includes: image support and media validation
  Adaptation: base64 is acceptable on the wire, but it should not be the
  canonical at-rest format
  Reason: base64 storage inflates size and makes SQLite persistence less
  efficient than blob or attachment-record storage.

### Do Not Transplant Directly

- `checkpoints tied to git refs`:
  do not transplant directly
  Replace with workspace checkpoints or analysis snapshots
  Reason: this app is not repo-centric, and tying checkpoints to Git would add
  coding-agent complexity without strengthening the analytical product.

- `multiple threads per project`:
  do not transplant directly
  Replace with multiple threads per workspace
  Reason: `project` is the wrong root noun for a portable analytical document.

- `account-type awareness (free/plus/pro)`:
  do not make account tier the first-class selector
  Replace with capability and availability awareness
  Reason: providers do not expose tiers consistently, while model capability and
  actual availability are what matter to execution.

- `ultrathink` as a universal level:
  do not transplant directly
  Replace with canonical effort levels plus provider-specific aliases
  Reason: provider-neutral orchestration needs one canonical effort vocabulary.

---

## Prompt Architecture Decision

The current prompt architecture is not sufficient for durable threaded analysis.

The target prompt architecture is:

1. `prompt-pack` on disk
2. durable thread history in SQLite
3. server-owned phase-turn execution
4. graph-query tools for on-demand context
5. compact phase briefs instead of giant prompt stuffing

Recommended prompt-pack shape:

```text
~/.gta/analysis-types/game-theory/
  phases.yaml
  prompts/
    phase-1.md
    phase-2.md
    ...
    chat.md
  schemas/
    entities.yaml
    relationships.yaml
  tools.yaml
```

Each run and phase-turn should persist:

- analysis type
- prompt-pack id and version
- phase id
- provider
- model
- effort
- tool policy
- resulting status and summaries

The analysis flow should change from:

- stateless phase request with prior entity JSON stuffing

to:

- thread-backed phase-turn with graph-query tools, durable history, and compact
  phase briefing

Important constraint:

Prompt stuffing should be reduced, not assumed to vanish completely.

Reason:
Even with graph-query tools, the model still needs a compact execution brief:

- what phase it is in
- what the goal of that phase is
- what counts as done
- what unresolved questions are active
- what tool policy applies

Without that brief, durable threads become conversationally rich but
methodologically blurry.

Also rejected:

- `send the full thread every turn and let the provider handle context`

Reason:
That is expensive, opaque, and too dependent on provider internals. Durable
history should exist, but the server should decide what context to compile for
each phase-turn.

---

## Rejected Shortcuts

The following shortcuts should not be taken.

- Do not keep the current singleton analysis store as the long-term authority.
  Reason: one active global run is fundamentally at odds with durable threads
  and resumable phase-turns.

- Do not build a second orchestration system beside the current one and leave
  both alive.
  Reason: the repo rules explicitly reject parallel systems without a removal
  plan.

- Do not persist provider-native runtime state inside the portable workspace.
  Reason: portability would become misleading and brittle.

- Do not store tool activity as fake assistant messages forever.
  Reason: that pollutes conversation history and weakens replay semantics.

- Do not event-source every token delta as a first-class durable event.
  Reason: token-level durability is high-volume noise. Persist commands, domain
  events, messages, and coarse activities instead.

- Do not copy T3's coding-specific terminal, worktree, PR, and Git checkpoint
  surface.
  Reason: those solve coding-agent problems, not analytical workspace problems.

- Do not make blanket tool approval the default for every graph mutation.
  Reason: the core path would become slow, interrupt-heavy, and hostile to
  multi-phase analysis.

---

## Exit Criteria By Capability

The maturity plan is complete when all of the following are true:

- the app can hold multiple durable threads inside one workspace
- analysis phases execute as durable phase-turns inside a thread
- Claude and Codex are hidden behind one provider-neutral runtime boundary
- chat and analysis survive app restart without losing history
- prompt packs are externalized and versioned
- the graph is queried through tools instead of repeatedly stuffed into prompts
- messages and activities are distinct and auditable
- command writes are serialized and idempotent
- provider health, model capabilities, and effort controls are visible to the
  user
- selective approvals and pending questions are supported where they improve
  trust and control
- the Electron shell is operationally reliable enough that crashes and child
  failures do not feel catastrophic

---

## Update Rules

This document must be updated when any of the following change materially:

- the canonical workspace/thread/run model
- the storage split between portable workspace state and local runtime state
- the decision to externalize prompt packs
- the live provider set
- the approval model
- the checkpoint and rollback model
- the scope of which T3-inspired features are considered transferable

This document should remain stable across implementation slices. If a change is
too tactical or date-bound to belong here, it belongs in a task or plan
document instead.
