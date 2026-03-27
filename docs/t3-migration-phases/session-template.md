# Session Template

Paste the prompt below into a fresh Codex session and then customize the
session-specific sections.

```text
You are working in /Users/joe/Developer/game-theory-model.

Subagent instruction:
- Use subagents aggressively to conserve main-session context.
- Delegate repo exploration, architecture comparison, and other bounded
  read-heavy tasks whenever they can run in parallel.
- Keep the main session focused on synthesis, integration, decisions, and the
  critical-path implementation work.
- Do not delegate a task if the very next step is blocked on its result and it
  is faster to do locally.

Broader vision:
- We are maturing Game Theory Analyzer from a single-run, singleton-oriented,
  prompt-stuffed app into a session-centric, provider-agnostic, durable
  analysis workspace.
- The target product model is `workspace -> thread -> run -> phase-turn -> activity`.
- The canvas and entity graph remain the primary analytical surface.
- We are borrowing runtime and persistence discipline from T3 Code, but this is
  not a coding-agent app and must not accumulate coding-specific complexity.
- Follow AGENTS.md strictly: one live product, no parallel systems without a
  removal plan, no broad rewrites, smallest useful slice first.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-contract.md
- /Users/joe/Developer/game-theory-model/docs/CURRENT-STATE.md
- [add session-specific files here]

Important grounding note:
- `architecture-maturity-plan.md` is the newest convergence document.
- `CURRENT-STATE.md` and `architecture-contract.md` are still useful grounding,
  but parts may be stale where they reflect the older single-run design.
- If you find a real conflict, note it clearly in your final handoff instead of
  forcing the code to preserve the older shape by default.

Problem:
- [describe this session’s exact slice]

Acceptance criteria:
- [list the concrete outcomes required to call the session done]

Scope:
- [list what this session is allowed to change]

Constraints and best practices:
- Make the smallest useful change that leaves the repo in a truthful state.
- Preserve existing product behavior unless this session explicitly replaces it.
- Do not leave a second implementation alive without a clear removal path.
- Keep server authority for product state and renderer as projection wherever possible.
- If the session introduces a new runtime boundary, write path, transport path,
  or recovery path, include the minimum observability needed to explain
  failures in that slice.
- Update or add tests that protect the new behavior.
- If the session uncovers drift beyond scope, document it, do not silently absorb it.

Verification:
- [list the checks to run]

Out of scope:
- [list nearby work that must not be pulled into this session]

Handoff:
- Summarize what changed.
- Note any new logs, diagnostics, or audit trails introduced.
- Call out any follow-up work or drift discovered.
- State exactly which checks were run.
```
