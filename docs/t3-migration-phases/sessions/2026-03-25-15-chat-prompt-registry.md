# 2026-03-25-15 Chat Prompt Registry Integration

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
- Phase 11 introduced a prompt-pack registry and externalized all 9 analysis
  phase prompts to on-disk templates with stable IDs, versions, and provenance.
- Chat and synthesis prompts were deferred and remain hardcoded.
- This session extends the prompt-pack registry to cover chat and synthesis
  prompts, completing the prompt architecture migration.

Read first:
- /Users/joe/Developer/game-theory-model/AGENTS.md
- /Users/joe/Developer/game-theory-model/docs/architecture/architecture-maturity-plan.md
- /Users/joe/Developer/game-theory-model/docs/t3-migration-phases/sessions/2026-03-25-11-prompt-pack-registry.md
- /Users/joe/Developer/game-theory-model/server/services/prompt-pack-registry.ts
- /Users/joe/Developer/game-theory-model/server/services/analysis-prompt-provenance.ts
- /Users/joe/Developer/game-theory-model/server/prompt-packs/game-theory/analysis-runtime/pack.json
- /Users/joe/Developer/game-theory-model/server/services/synthesis-service.ts (lines 30-46: SYNTHESIS_SYSTEM_PROMPT)
- /Users/joe/Developer/game-theory-model/src/services/ai/ai-prompts.ts (hardcoded chat/design prompts)
- /Users/joe/Developer/game-theory-model/server/services/ai/chat-service.ts

Problem:
- `SYNTHESIS_SYSTEM_PROMPT` is hardcoded at the top of synthesis-service.ts.
- Chat system prompts (CHAT_SYSTEM_PROMPT, design prompts like PEN_NODE_SCHEMA,
  DESIGN_EXAMPLES, ADAPTIVE_STYLE_POLICY) are hardcoded in
  src/services/ai/ai-prompts.ts (367 lines of prompt constants).
- chat-service.ts accepts an optional system prompt but has no registry
  integration for defaults.
- These prompts have no versioning, no provenance, and cannot be user-overridden.

Acceptance criteria:
- Synthesis and chat system prompts are loaded through the prompt-pack registry,
  not hardcoded module constants.
- On-disk template files exist for chat and synthesis prompts alongside the
  existing analysis prompt templates.
- The pack.json manifest is extended to include chat and synthesis template
  references.
- Chat and synthesis callers use the registry resolution API
  (resolvePromptPack / resolveAnalysisPromptTemplate or a new resolver for
  non-analysis modes).
- Prompt provenance is available for chat turns (which prompt pack, version,
  and template were used).
- The old hardcoded prompt constants in ai-prompts.ts and synthesis-service.ts
  are removed or reduced to the registry-loaded path.
- Filesystem override still works: user-editable prompts in
  ~/.gta/analysis-types/ take precedence over bundled defaults.

Scope:
- Extending pack.json and the prompt-pack directory structure.
- Creating on-disk template files for chat and synthesis prompts.
- Updating the prompt-pack registry resolver if needed for non-analysis modes.
- Updating synthesis-service.ts to load its prompt from the registry.
- Updating chat-service.ts or its callers to load chat system prompts from
  the registry.
- Reducing or removing hardcoded constants from ai-prompts.ts.

Constraints and best practices:
- Follow the exact same pattern that analysis prompts already use: pack.json
  manifest pointing to .md template files, resolved via resolvePromptPack().
- Do not change prompt content. The goal is to move existing text from module
  constants to template files, not to rewrite the prompts.
- Design system prompts (PEN_NODE_SCHEMA, DESIGN_EXAMPLES, etc.) are renderer-
  side prompts used by design-prompt.ts and design-generator.ts. If they serve
  the canvas design feature (not AI chat), they may stay where they are. Only
  migrate prompts that flow through the AI provider path.
- Keep the registry API simple. If chat mode needs a different resolution key,
  add a mode like "chat" alongside "analysis-runtime" rather than overloading.

Verification:
- Run `bun run typecheck`.
- Run `bun run test`.
- Run targeted tests for prompt resolution, synthesis-service, and chat-service.

Out of scope:
- SSE transport migration.
- Entity-graph-service refactoring.
- AskUserQuestion UX.
- Prompt content changes or methodology adjustments.

Handoff:
- Summarize the new template files and pack.json changes.
- Note which hardcoded prompts were migrated and which intentionally remain
  (e.g., design system prompts if they are renderer-only).
- Note any prompt-pack registry API changes.
- State exactly which checks were run.
```
