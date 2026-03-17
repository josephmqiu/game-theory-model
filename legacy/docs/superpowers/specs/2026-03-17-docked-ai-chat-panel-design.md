# Docked AI Chat Panel

Replace the inspector panel with a permanently visible, resizable AI chat panel docked to the right side of the app shell.

## Context

The inspector panel occupies the right sidebar but sees little use. The AI chat panel is more valuable but currently floats as an absolute-positioned overlay that the user must toggle open. This redesign promotes the chat to a first-class docked panel and removes the inspector entirely.

## Layout Structure

The app shell becomes a three-column flex layout:

```
Sidebar | Main Content | Resize Handle | Chat Panel
```

- **Chat panel** is always rendered. No toggle, no minimized state.
- **Resize handle**: a 4px-wide `div` between main content and chat panel. `cursor-col-resize`, subtle hover/active highlight (`bg-primary/20`, `bg-primary/30`).
- **Resize logic**: custom `mousedown`/`mousemove`/`mouseup` handlers (~30 lines in `app-layout.tsx`). Clamps width between 240px and 50% of viewport width. Applies `user-select: none` to `document.body` during drag to prevent text selection jank, restored on `mouseup`.
- **Default width**: 320px, persisted to `ui-store` as `chatPanelWidth`.

TopBar and StatusBar remain unchanged in position (above and below the flex row respectively).

## Component Changes

### `app-layout.tsx`

Remove `<InspectorPanel />` import and usage. Add the resize handle and docked chat panel. Preserve the existing `p-6` padding on `<main>`:

```tsx
<div className="flex flex-1 overflow-hidden">
  <Sidebar />
  <main className="flex-1 min-w-0 overflow-auto p-6">
    <Outlet />
  </main>
  <div
    className="w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
    onMouseDown={startResize}
  />
  <div
    style={{ width: chatPanelWidth }}
    className="shrink-0 border-l border-border overflow-hidden"
  >
    <AiChatPanel />
  </div>
</div>
```

Resize callback pattern:

```ts
const startResize = useCallback(
  (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = chatPanelWidth;

    document.body.style.userSelect = "none";

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const maxWidth = window.innerWidth * 0.5;
      const newWidth = Math.min(maxWidth, Math.max(240, startWidth + delta));
      setChatPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  },
  [chatPanelWidth, setChatPanelWidth],
);
```

### `ai-chat-panel.tsx`

- Remove fixed dimensions (`w-96 h-[32rem]`) and absolute positioning. Panel fills parent via `h-full w-full`.
- Delete `AiChatMinimizedBar` component and its export.
- Remove close/minimize buttons from the header.
- Remove model selector dropdown, `PROVIDER_LABELS` constant, and `connectedModels` memo from this file (all move to top bar).
- Keep the auto-fallback `useEffect` that selects a valid model when the current one disappears — extract it into a shared hook (`useModelAutoFallback`) in `src/hooks/use-model-auto-fallback.ts` so both the chat panel and top bar can use it without duplication.
- Keep the "Connect a provider" warning that shows when no providers are connected (reads `currentProviderReady` from `ai-store`).
- Message list, input area, and streaming logic are unchanged.

### `top-bar.tsx`

- Remove the AI panel toggle button (calls `toggleAiPanel`).
- Add a compact model selector dropdown in its place, next to where the AI button currently sits.
- Move `PROVIDER_LABELS` and `connectedModels` derivation here (or import from the shared hook).
- Dropdown reads connected providers from `agent-settings-store` and their model lists.
- Selection calls `aiStore.getState().setProvider({ provider, modelId })`.
- Uses the shared `useModelAutoFallback` hook.

### `inspector-panel.tsx`

Deleted.

## State Changes

### `ui-store.ts`

Remove:

- `aiPanelOpen` / `setAiPanelOpen`
- `aiPanelMinimized` / `toggleAiPanelMinimized` / `toggleAiPanel`
- `inspectorOpen` / `toggleInspector`
- `inspectedTarget` / `setInspectedTarget`
- `InspectorTarget` type export

Add:

- `chatPanelWidth: number` (default `320`, persisted with shell prefs)
- `setChatPanelWidth: (width: number) => void`

Persisted shell prefs shape becomes `{ sidebarCollapsed, manualMode, chatPanelWidth }`.

**Hydration migration**: The `hydrate` action must pick only known keys from the persisted object rather than blindly spreading. Stale keys (`aiPanelOpen`, `aiPanelMinimized`, `inspectorOpen`) in existing localStorage/electron prefs will be silently ignored.

### `ai-store.ts`

No changes. `setProvider` already exists.

### `agent-settings-store.ts`

No changes. Connected providers and model lists are already exposed.

## Inspector Removal — Blast Radius

Removing `setInspectedTarget` from the store affects 9 component files that call it on click handlers. Each file needs the `setInspectedTarget(...)` call removed from its click handler (the click handler itself stays, only the inspector call is removed):

| File                                               | Change                           |
| -------------------------------------------------- | -------------------------------- |
| `src/components/phases/proposal-review.tsx`        | Remove `setInspectedTarget` call |
| `src/routes/editor/phase/$phaseId.tsx`             | Remove `setInspectedTarget` call |
| `src/components/scenarios/scenario-comparison.tsx` | Remove `setInspectedTarget` call |
| `src/components/game/game-map.tsx`                 | Remove `setInspectedTarget` call |
| `src/routes/editor/game/$gameId.tsx`               | Remove `setInspectedTarget` call |
| `src/routes/editor/players.tsx`                    | Remove `setInspectedTarget` call |
| `src/components/game/tree-view.tsx`                | Remove `setInspectedTarget` call |
| `src/components/evidence/evidence-notebook.tsx`    | Remove `setInspectedTarget` call |
| `src/routes/editor/assumptions.tsx`                | Remove `setInspectedTarget` call |

In each file, also remove the `useUiStore` import if `setInspectedTarget` was the only selector used from it.

## Settings Page Cleanup

In `settings.tsx`, remove from the Shell Preferences section:

- "Open/Close AI panel" toggle button
- AI panel `SettingRow`
- AI panel mode `SettingRow`
- "Show/Hide inspector" toggle button
- Inspector `SettingRow`

Keep only the Manual Mode toggle.

## Test Updates

| File                                           | Change                                                                                                                                                                        |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/route-tests/settings-page.test.tsx`       | Remove mocks for `setAiPanelOpen`, `toggleInspector`, `aiPanelOpen`, `aiPanelMinimized`, `inspectorOpen`. Remove assertions for "Open AI panel" and "Hide inspector" buttons. |
| `src/components/panels/ai-chat-panel.test.tsx` | Remove `AiChatMinimizedBar` import and tests. Update remaining tests for the new always-visible, full-height layout.                                                          |

## New Files

| File                                   | Purpose                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `src/hooks/use-model-auto-fallback.ts` | Shared hook for model auto-fallback logic (extracted from `ai-chat-panel.tsx`) |

## Files Affected (complete)

| File                                               | Action                                                    |
| -------------------------------------------------- | --------------------------------------------------------- |
| `src/components/shell/app-layout.tsx`              | Modify: remove inspector, add resize handle + docked chat |
| `src/components/panels/ai-chat-panel.tsx`          | Modify: fill parent, remove minimize/close/model-selector |
| `src/components/shell/top-bar.tsx`                 | Modify: remove AI toggle, add model selector dropdown     |
| `src/components/shell/inspector-panel.tsx`         | Delete                                                    |
| `src/stores/ui-store.ts`                           | Modify: remove 6 fields + type, add `chatPanelWidth`      |
| `src/routes/settings.tsx`                          | Modify: remove inspector/AI panel toggles and displays    |
| `src/hooks/use-model-auto-fallback.ts`             | Create: shared model fallback hook                        |
| `src/components/phases/proposal-review.tsx`        | Modify: remove `setInspectedTarget` call                  |
| `src/routes/editor/phase/$phaseId.tsx`             | Modify: remove `setInspectedTarget` call                  |
| `src/components/scenarios/scenario-comparison.tsx` | Modify: remove `setInspectedTarget` call                  |
| `src/components/game/game-map.tsx`                 | Modify: remove `setInspectedTarget` call                  |
| `src/routes/editor/game/$gameId.tsx`               | Modify: remove `setInspectedTarget` call                  |
| `src/routes/editor/players.tsx`                    | Modify: remove `setInspectedTarget` call                  |
| `src/components/game/tree-view.tsx`                | Modify: remove `setInspectedTarget` call                  |
| `src/components/evidence/evidence-notebook.tsx`    | Modify: remove `setInspectedTarget` call                  |
| `src/routes/editor/assumptions.tsx`                | Modify: remove `setInspectedTarget` call                  |
| `src/route-tests/settings-page.test.tsx`           | Modify: remove inspector/AI panel mocks and assertions    |
| `src/components/panels/ai-chat-panel.test.tsx`     | Modify: remove minimized bar tests, update layout tests   |

## Boundaries

- Domain layer (`shared/game-theory/`) is untouched.
- Server/API layer (`server/api/`) is untouched.
- Agent settings store and types are untouched.
- No new dependencies introduced.
