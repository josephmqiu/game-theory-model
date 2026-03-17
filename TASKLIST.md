# Completion Task List

Status key:
- `[x]` complete
- `[~]` in progress
- `[ ]` pending

Current focus:
- `[x]` Persist the remaining completion checklist in the repo so progress survives session limits
- `[x]` Align chat dispatch with the renderer-authoritative command/result model
- `[x]` Complete connector-platform install/validate/status flows for MCP and local CLI integrations
- `[x]` Expand Settings so connector and MCP actions are real management flows, not just discovery/toggles
- `[x]` Strengthen MCP end-to-end behavior and verify no live no-op tool paths remain
- `[x]` Deepen Overview and phase-detail workflow/dashboard surfaces
- `[x]` Finish inspector wiring across major views
- `[x]` Expand manual-modeling coverage where the canonical schema supports it
- `[x]` Expand play-out UX around AI/manual control and session management
- `[x]` Prune remaining dead/orphan code
- `[x]` Add missing server/API tests
- `[x]` Add missing renderer/integration coverage
- `[x]` Run final acceptance audit against the original plan

Already completed in previous passes:
- `[x]` Stabilize desktop file contract across preload, IPC, renderer hooks, and menu flows
- `[x]` Remove duplicated shell navigation state and make router state authoritative
- `[x]` Replace placeholder AI aside with a real floating app-wide panel
- `[x]` Lift reusable connector types/settings state/provider discovery into the root app
- `[x]` Add provider-routed chat support for Anthropic, OpenAI/Codex, OpenCode, and Copilot
- `[x]` Replace fake-success phase execution with command-bus-backed execution
- `[x]` Rework MCP to dispatch real commands for analysis, proposals, and play-outs
- `[x]` Mount core analyst routes: Overview, Evidence, Scenarios, Game Map, Assumptions, Play-outs, phase detail, settings, and game drill-down
- `[x]` Reintroduce manual modeling for core entities through the canonical command spine
- `[x]` Persist play-out sessions through analysis save/load round-trips
- `[x]` Normalize the AI stream contract at the server/renderer boundary

Recently completed in this pass:
- `[x]` Add managed MCP config write/remove flows and transport-aware settings actions
- `[x]` Add connector status/validation UI for direct providers and MCP/CLI integrations
- `[x]` Add MCP command claiming so queued commands are owned by one renderer before execution
- `[x]` Hydrate pipeline/runtime/conversation snapshots from MCP sync events instead of analysis-state only
- `[x]` Replace remaining MCP proposal fallback mutation path with command-bus-only registration
- `[x]` Fill Nitro-backed MCP reads with live phase status, entities, persisted revision, and analysis metadata
- `[x]` Upgrade Overview into a stronger command dashboard with quick links, findings, phase progress, and workflow actions
- `[x]` Upgrade phase-detail routes with clearer workflow framing, review status, and revalidation actions
- `[x]` Expand test coverage for integration status/validate endpoints and AI panel minimized behavior
- `[x]` Expand test coverage for MCP command claim/config endpoints and ownership hardening
- `[x]` Remove unused store/UI scaffolding and the redundant `/api/ai/models` endpoint
- `[x]` Upgrade play-outs with AI/manual player control, branch trees, session lifecycle controls, and safer turn recording
- `[x]` Expand manual modeling with inference creation plus richer assumption/scenario evidence linkage
- `[x]` Align manual claim creation with canonical integrity rules (`based_on` observations only)
- `[x]` Add command-spine coverage for manual inference/scenario links and invalid claim-base rejection
- `[x]` Replace disabled route-level renderer tests with stable harness-backed Settings and Play-outs tests
- `[x]` Unskip and harden renderer coverage for the AI panel and MCP sync hook

Final acceptance audit:
- `[x]` No fake-success phase endpoints remain in the live app path
- `[x]` No no-op MCP tool paths remain in the live app path
- `[x]` No mounted placeholder AI panel remains; the floating panel is live
- `[x]` No duplicated sidebar navigation state remains
- `[x]` Disabled route-test copies were replaced by active stable tests and removed
- `[x]` Root app remains the only shipping target; `legacy/` and `openpencil-example/` remain donor/reference trees only

Notes:
- Root app remains the only shipping app.
- `legacy/` and `openpencil-example/` are donor/reference trees only.
- Current verification: `bun run typecheck`, `bun run test`, and `bun run build` all pass.
- Current test count: `35` files passed, `182` tests passed.
- Residual non-blocking warnings:
  `vitest` still reports React `act(...)` warnings in some renderer tests.
  `vitest` still reports the known shutdown warning: `close timed out after 1000ms`.
  `vite build` still reports large client chunk warnings for `main` and SSR router bundles.
- Acceptance bar remains: no fake-success phase endpoints, no no-op MCP tool paths, no mounted placeholder panels, no duplicated nav state, and no kept orphan components without a live role.
