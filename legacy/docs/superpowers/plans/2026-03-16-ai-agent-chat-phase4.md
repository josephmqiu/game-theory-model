# AI Agent Chat — Phase 4: Polish + Prompt Tuning

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Iterate on prompts until the AI produces high-quality game theory analysis, test across multiple providers, tune operational parameters, and add finishing touches (compaction indicators, hot-reload for prompts).

**Architecture:** No new architecture — this phase refines what Phases 1-3 built. The work is primarily prompt engineering, testing, and configuration tuning.

**Tech Stack:** Same as Phases 1-3. Prompt files in `shared/game-theory/prompts/`.

**Spec:** `docs/superpowers/specs/2026-03-16-ai-agent-chat-design.md` — Sections 1 (System Prompt Strategy), 2 (Conversation State Management), 6 (Prompt File Structure)

**Depends on:** Phases 1-3 complete (the full pipeline must be working end-to-end before tuning)

---

## Scope

### What to build

1. **System prompt iteration** (`shared/game-theory/prompts/system.md`)
   - Run test analyses with different prompts: "US vs China trade war", "Apple vs Epic antitrust", "Ukraine peace negotiations"
   - Evaluate: Does the agent follow the methodology order? Does it use web search for grounding? Does it call `get_analysis_status` before advancing? Does it create proper evidence chains?
   - Common failure modes to watch for and fix in the prompt:
     - Agent skips Phase 1 grounding and jumps to player identification
     - Agent creates players without evidence (no sources/observations)
     - Agent doesn't call `check_disruption_triggers` after Phase 4
     - Agent uses update tools where it should use propose_revision
     - Agent creates games before identifying enough players
     - Agent doesn't use web search (relies only on parametric knowledge)
   - Target: ~1,500 words, clear enough that both Claude and GPT-4 follow the methodology

2. **Tool description iteration** (`shared/game-theory/prompts/tools/*.md`)
   - Each tool description is 2-4 sentences, included in every API call
   - Test: Does the AI use tools correctly? Does it pass valid inputs? Does it understand referential requirements (source_id must reference an existing source)?
   - Common failures to fix:
     - Agent calls `add_observation` without a valid `source_id`
     - Agent passes string where number expected (confidence values)
     - Agent doesn't include enough detail in entity fields
     - Agent creates entities with placeholder text instead of real analysis

3. **Multi-provider testing**
   - Test with Anthropic (Claude Sonnet 4.6) — primary provider
   - Test with OpenAI (GPT-4.1) — verify OpenAI adapter works end-to-end
   - Test with a provider that doesn't support tool use — verify degraded mode warning appears
   - Document provider-specific quirks in prompts if needed

4. **Compaction indicators in chat**
   - When a compaction event arrives in the SSE stream, show a subtle indicator in the chat: "Context compacted — the AI may call get_analysis_status to re-orient"
   - Style: muted text, small icon, not a full message — similar to "X is typing" indicators

5. **Hot-reload for prompt files in dev mode**
   - Watch `shared/game-theory/prompts/**/*.md` for changes
   - On change, reload the affected prompt text and update the tool registry's descriptions
   - This enables rapid iteration: edit a prompt file, save, and the next API call uses the new text without restarting the dev server
   - Implementation: use `chokidar` or Node's `fs.watch` in the Nitro dev server

6. **Operational parameter tuning**
   - `maxIterations`: Test with real analyses. A full 10-phase analysis might need 50-80 tool calls. Default 100 may be right, or may need adjustment.
   - `inactivityTimeoutMs`: 60 seconds may be too aggressive if the AI is doing a long web search. Test and adjust.
   - `enableWebSearch`: Verify web search works with both Anthropic and OpenAI. Check if search results are being properly incorporated into evidence chains.
   - Compaction thresholds: Test long sessions (30+ tool calls) to verify provider-side compaction works correctly with both Anthropic and OpenAI.

7. **Error handling polish**
   - Rate limit errors: show "Rate limited — waiting..." with countdown
   - Network errors: show retry option
   - Provider auth errors: show "API key not configured" with link to settings
   - Tool execution errors: show in collapsible detail (the agent sees the error and can retry with different input)

### Key files

- `shared/game-theory/prompts/system.md` — System prompt (main iteration target)
- `shared/game-theory/prompts/phases/*.md` — Phase methodology files
- `shared/game-theory/prompts/tools/*.md` — Tool descriptions
- `shared/game-theory/providers/anthropic-adapter.ts` — May need tweaks for compaction handling
- `shared/game-theory/providers/openai-adapter.ts` — May need tweaks for function calling edge cases
- `shared/game-theory/agent/loop.ts` — Timeout and iteration config
- `src/components/panels/agent-chat-message.tsx` — Compaction indicator rendering

### Eval approach

For each test scenario, evaluate:

| Dimension                 | What to check                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Methodology adherence** | Did the agent follow phases in roughly the right order? Did it use web search for grounding?   |
| **Evidence quality**      | Are sources real (from web search)? Are claims traced to observations?                         |
| **Entity completeness**   | Are players, games, and formalizations substantively filled in — not templates?                |
| **Revalidation**          | Did Phase 4 findings trigger backward revisions? Did the agent call check_disruption_triggers? |
| **Tool usage**            | Were tools called with valid inputs? Were referential constraints respected?                   |
| **User experience**       | Was the streaming output readable? Were tool call summaries useful?                            |

### Task outline (to be expanded into full TDD steps)

1. Run baseline analysis ("US vs China trade war") with current prompts, document failures
2. Iterate system prompt to fix identified failures
3. Iterate tool descriptions to fix input validation issues
4. Test with OpenAI provider, fix adapter issues
5. Test degraded mode (no tool use provider)
6. Add compaction indicator to chat message renderer
7. Implement prompt hot-reload in dev mode
8. Tune maxIterations and timeout based on real sessions
9. Polish error handling (rate limits, auth, network)
10. Run final eval across 3 test scenarios, document results
