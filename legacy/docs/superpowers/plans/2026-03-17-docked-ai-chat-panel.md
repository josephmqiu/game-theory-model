# Docked AI Chat Panel Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inspector panel with an always-visible, resizable AI chat panel docked to the right side of the app shell.

**Architecture:** Remove all inspector state/components, simplify AI panel state (no toggle/minimize), add `chatPanelWidth` to persisted shell prefs, extract model selector to top bar via a shared hook, and rewire the layout to a three-column flex with a CSS resize handle.

**Tech Stack:** React 19, Zustand 5, TanStack Router, Tailwind v4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-17-docked-ai-chat-panel-design.md`

---

## File Structure

| File                                      | Responsibility                                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/stores/ui-store.ts`                  | Shell prefs: sidebar, manual mode, chat panel width. Persistence.                            |
| `src/hooks/use-model-auto-fallback.ts`    | Shared hook: derives connected models, auto-selects valid model when current one disappears. |
| `src/components/panels/ai-chat-panel.tsx` | Always-visible chat UI filling its parent. No close/minimize/model-selector.                 |
| `src/components/shell/app-layout.tsx`     | Three-column flex: sidebar + main + resize handle + docked chat.                             |
| `src/components/shell/top-bar.tsx`        | App header with undo/redo/save + model selector dropdown.                                    |
| `src/routes/settings.tsx`                 | Settings page with only manual mode toggle in shell prefs.                                   |

---

### Task 1: Strip inspector and AI-toggle state from ui-store

**Files:**

- Modify: `src/stores/ui-store.ts`

- [ ] **Step 1: Remove inspector and AI panel fields from `PersistedShellPrefs`**

Change the interface from:

```ts
interface PersistedShellPrefs {
  aiPanelOpen: boolean;
  aiPanelMinimized: boolean;
  sidebarCollapsed: boolean;
  inspectorOpen: boolean;
  manualMode: boolean;
}
```

To:

```ts
interface PersistedShellPrefs {
  sidebarCollapsed: boolean;
  manualMode: boolean;
  chatPanelWidth: number;
}
```

- [ ] **Step 2: Remove `InspectorTarget` type and inspector/AI fields from `UiState`**

Remove the `InspectorTarget` interface export entirely (lines 18-21).

Remove from `UiState`:

- `inspectedTarget: InspectorTarget | null`
- `aiPanelOpen: boolean`
- `aiPanelMinimized: boolean`
- `inspectorOpen: boolean`

Add to `UiState`:

- `chatPanelWidth: number`

- [ ] **Step 3: Remove inspector/AI actions from `UiActions`**

Remove from `UiActions`:

- `setInspectedTarget`
- `toggleAiPanel`
- `setAiPanelOpen`
- `toggleAiPanelMinimized`
- `toggleInspector`

Add to `UiActions`:

- `setChatPanelWidth: (width: number) => void`

- [ ] **Step 4: Update `initialState`**

Remove: `inspectedTarget: null`, `aiPanelOpen: false`, `aiPanelMinimized: false`, `inspectorOpen: true`

Add: `chatPanelWidth: 320`

- [ ] **Step 5: Update `persistShellPrefs`**

Replace the function body to only persist the new shape:

```ts
function persistShellPrefs(
  state: Pick<UiState, "sidebarCollapsed" | "manualMode" | "chatPanelWidth">,
): void {
  if (typeof window === "undefined") return;

  const prefs: PersistedShellPrefs = {
    sidebarCollapsed: state.sidebarCollapsed,
    manualMode: state.manualMode,
    chatPanelWidth: state.chatPanelWidth,
  };

  if (isElectron()) {
    void window.electronAPI!.setPreference(
      SHELL_PREFS_KEY,
      JSON.stringify(prefs),
    );
    return;
  }

  try {
    window.localStorage.setItem(SHELL_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage failures.
  }
}
```

- [ ] **Step 6: Remove deleted actions from the store, add `setChatPanelWidth`**

Remove these action implementations from the `createStore` call:

- `setInspectedTarget`
- `toggleAiPanel`
- `setAiPanelOpen`
- `toggleAiPanelMinimized`
- `toggleInspector`

Add:

```ts
setChatPanelWidth: (width) =>
  set((s) => {
    const next = { chatPanelWidth: width };
    persistShellPrefs({ ...s, ...next });
    return next;
  }),
```

- [ ] **Step 7: Fix hydration to pick only known keys**

Replace the `hydrate` action:

```ts
hydrate: (prefs) =>
  set({
    sidebarCollapsed: prefs.sidebarCollapsed ?? false,
    manualMode: prefs.manualMode ?? true,
    chatPanelWidth: prefs.chatPanelWidth ?? 320,
    hydrated: true,
  }),
```

- [ ] **Step 8: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -40`

Expected: Errors only from consumer files that still reference removed fields (inspector, AI panel). The store itself should be clean.

- [ ] **Step 9: Commit**

```bash
git add src/stores/ui-store.ts
git commit -m "refactor: strip inspector and AI-toggle state from ui-store, add chatPanelWidth"
```

---

### Task 2: Create shared model auto-fallback hook

**Files:**

- Create: `src/hooks/use-model-auto-fallback.ts`

- [ ] **Step 1: Create the hook file**

```ts
/**
 * Shared hook — derives connected models from agent-settings-store and
 * auto-selects a valid model when the current selection disappears.
 */

import { useEffect, useMemo } from "react";
import { aiStore, useAiStore } from "@/stores/ai-store";
import { useAgentSettingsStore } from "@/stores/agent-settings-store";
import type { AIProviderType, GroupedModel } from "@/types/agent-settings";

export const PROVIDER_LABELS: Record<AIProviderType, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  opencode: "OpenCode",
  copilot: "Copilot",
};

export interface ConnectedModel extends GroupedModel {
  providerLabel: string;
}

export function useConnectedModels(): ConnectedModel[] {
  const connectedProviders = useAgentSettingsStore((s) => s.providers);

  return useMemo(
    () =>
      (Object.keys(connectedProviders) as AIProviderType[]).flatMap(
        (providerType) =>
          connectedProviders[providerType].models.map((model) => ({
            ...model,
            providerLabel: connectedProviders[providerType].displayName,
          })),
      ),
    [connectedProviders],
  );
}

export function useModelAutoFallback(): void {
  const settingsHydrated = useAgentSettingsStore((s) => s.hydrated);
  const provider = useAiStore((s) => s.provider);
  const connectedModels = useConnectedModels();

  useEffect(() => {
    if (!settingsHydrated || connectedModels.length === 0) return;
    const currentModel = connectedModels.find(
      (model) =>
        model.value === provider.modelId &&
        model.provider === provider.provider,
    );
    if (!currentModel) {
      const firstModel = connectedModels[0];
      if (!firstModel) return;
      if (
        firstModel.provider !== provider.provider ||
        firstModel.value !== provider.modelId
      ) {
        aiStore.getState().setProvider({
          provider: firstModel.provider,
          modelId: firstModel.value,
        });
      }
    }
  }, [connectedModels, provider.modelId, provider.provider, settingsHydrated]);
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep use-model-auto-fallback`

Expected: No errors from this file.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-model-auto-fallback.ts
git commit -m "feat: extract useModelAutoFallback and useConnectedModels shared hooks"
```

---

### Task 3: Simplify ai-chat-panel (remove minimize, close, model selector)

**Files:**

- Modify: `src/components/panels/ai-chat-panel.tsx`

- [ ] **Step 1: Remove `AiChatMinimizedBar` component and its type**

Delete the `AiChatMinimizedBarProps` interface (lines 79-82) and the entire `AiChatMinimizedBar` export function (lines 84-114).

- [ ] **Step 2: Remove `PROVIDER_LABELS` constant**

Delete lines 67-72 (the `PROVIDER_LABELS` object). This now lives in `use-model-auto-fallback.ts`.

- [ ] **Step 3: Remove `onClose`/`onMinimize` props from `AiChatPanel`**

Change the `AiChatPanelProps` interface and function signature:

Remove the interface entirely (lines 74-77). Change the function signature from:

```ts
export function AiChatPanel({ onClose, onMinimize }: AiChatPanelProps) {
```

To:

```ts
export function AiChatPanel() {
```

- [ ] **Step 4: Replace inline `connectedModels` memo and auto-fallback `useEffect` with shared hooks**

Remove:

- The `connectedModels` useMemo (lines 148-158)
- The auto-fallback useEffect (lines 168-188)

Keep as-is (still needed by `selectedProviderState` and `currentProviderReady`):

- The `settingsHydrated` selector (line 121)
- The `connectedProviders` selector (line 122)

Add imports and hook calls:

```ts
import {
  PROVIDER_LABELS,
  useConnectedModels,
  useModelAutoFallback,
} from "@/hooks/use-model-auto-fallback";
```

Inside the component, after the existing hooks, add:

```ts
const connectedModels = useConnectedModels();
useModelAutoFallback();
```

- [ ] **Step 5: Remove model selector dropdown from the header JSX**

Replace the entire header `div` (lines 218-280) with a simpler version that has no model selector, no minimize button, no close button:

```tsx
<div className="flex items-center gap-3 border-b border-border px-4 py-3">
  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
    <Bot className="h-4 w-4" />
  </div>
  <p className="text-sm font-medium text-foreground">AI Analysis Copilot</p>
</div>
```

- [ ] **Step 6: Remove unused imports**

Remove from the import list: `ChevronUp`, `Minus`, `X`, `MessageSquare` (if no longer used after removing minimized bar).

Keep: `Bot`, `Send`, `Square`, `User`.

Remove the `useAgentSettingsStore` import only if no longer needed. But it IS still needed for `connectedProviders` (used by `selectedProviderState`). Keep it.

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep ai-chat-panel`

Expected: No errors from this file. Errors from `app-layout.tsx` (still passing removed props) are expected and will be fixed in Task 5.

- [ ] **Step 8: Commit**

```bash
git add src/components/panels/ai-chat-panel.tsx
git commit -m "refactor: simplify AiChatPanel — remove minimize, close, model selector"
```

> **Note:** Between Task 3 and Task 4, there is no model selector anywhere in the UI. This is an expected intermediate state — the model selector moves from the chat panel header (removed here) to the top bar (added in Task 4). Do not smoke-test until both tasks are complete.

---

### Task 4: Add model selector to top bar

**Files:**

- Modify: `src/components/shell/top-bar.tsx`

- [ ] **Step 1: Add imports for model hooks and stores**

Add:

```ts
import {
  PROVIDER_LABELS,
  useConnectedModels,
  useModelAutoFallback,
} from "@/hooks/use-model-auto-fallback";
import { aiStore, useAiStore } from "@/stores/ai-store";
import type { AIProviderType } from "@/types/agent-settings";
```

Remove the `MessageSquare` import from lucide-react (the AI toggle button is being removed).

- [ ] **Step 2: Remove AI panel toggle state from the component**

Remove these lines:

```ts
const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
const toggleAiPanel = useUiStore((s) => s.toggleAiPanel);
```

If `useUiStore` is no longer used after this, remove its import too. Check — it's imported but may not be used by anything else in this file. The `navigate` from TanStack Router and `useAnalysisStore` are separate. Remove the `useUiStore` import.

- [ ] **Step 3: Add model selector state**

Inside the component, add:

```ts
const provider = useAiStore((s) => s.provider);
const connectedModels = useConnectedModels();
useModelAutoFallback();
```

- [ ] **Step 4: Replace AI toggle button with model selector dropdown**

Replace lines 90-101 (the AI toggle button):

```tsx
<button
  type="button"
  onClick={toggleAiPanel}
  className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
    aiPanelOpen
      ? "bg-primary text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
  }`}
>
  <MessageSquare size={14} />
  AI
</button>
```

With:

```tsx
{
  connectedModels.length > 0 ? (
    <select
      value={`${provider.provider}:${provider.modelId}`}
      onChange={(e) => {
        const [nextProvider, ...rest] = e.target.value.split(":");
        const nextModelId = rest.join(":");
        aiStore.getState().setProvider({
          provider: nextProvider as AIProviderType,
          modelId: nextModelId,
        });
      }}
      className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground"
      aria-label="AI model"
    >
      {connectedModels.map((model) => (
        <option
          key={`${model.provider}:${model.value}`}
          value={`${model.provider}:${model.value}`}
        >
          {PROVIDER_LABELS[model.provider]} / {model.displayName}
        </option>
      ))}
    </select>
  ) : (
    <span className="text-xs text-muted-foreground">No AI connected</span>
  );
}
```

- [ ] **Step 5: Also remove `Target` from lucide imports if unused**

Check if `Target` is used. It is — line 49 renders a `<Target>` icon. Keep it.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep top-bar`

Expected: No errors from this file.

- [ ] **Step 7: Commit**

```bash
git add src/components/shell/top-bar.tsx
git commit -m "feat: replace AI toggle button with model selector dropdown in top bar"
```

---

### Task 5: Rewire app-layout — docked chat panel with resize handle

**Files:**

- Modify: `src/components/shell/app-layout.tsx`

- [ ] **Step 1: Update imports**

Remove:

- `InspectorPanel` import (line 9)
- `AiChatMinimizedBar` from the ai-chat-panel import (line 19)

Change the ai-chat-panel import to:

```ts
import { AiChatPanel } from "@/components/panels/ai-chat-panel";
```

Add `useCallback` to the React import (it's needed for the resize handler).

- [ ] **Step 2: Replace `BootstrappedAppLayout` state selectors**

Remove:

```ts
const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
const aiPanelMinimized = useUiStore((s) => s.aiPanelMinimized);
const setAiPanelOpen = useUiStore((s) => s.setAiPanelOpen);
const toggleAiPanelMinimized = useUiStore((s) => s.toggleAiPanelMinimized);
```

Add:

```ts
const chatPanelWidth = useUiStore((s) => s.chatPanelWidth);
const setChatPanelWidth = useUiStore((s) => s.setChatPanelWidth);
```

- [ ] **Step 3: Add resize handler**

After the hook calls (`useKeyboardShortcuts`, etc.), add:

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

- [ ] **Step 4: Replace the layout JSX**

Replace the content area (lines 86-116) — everything inside the `<div className="flex flex-1 overflow-hidden">`:

```tsx
<div className="flex flex-1 overflow-hidden">
  <Sidebar />

  <main className="flex-1 min-w-0 overflow-y-auto p-6">
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

This removes:

- The `relative` wrapper div around main content
- The absolute-positioned AI panel overlay
- The `<InspectorPanel />` component

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | head -40`

Expected: Errors only from settings.tsx and the 9 blast-radius files (still referencing removed store fields). app-layout.tsx itself should be clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/shell/app-layout.tsx
git commit -m "feat: dock AI chat panel with resizable handle, remove inspector"
```

---

### Task 6: Delete inspector-panel.tsx

**Files:**

- Delete: `src/components/shell/inspector-panel.tsx`

- [ ] **Step 1: Delete the file**

```bash
rm src/components/shell/inspector-panel.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "inspector-panel" src/`

Expected: No results (the import in app-layout was already removed in Task 5).

- [ ] **Step 3: Commit**

```bash
git add -u src/components/shell/inspector-panel.tsx
git commit -m "chore: delete inspector-panel.tsx"
```

---

### Task 7: Clean up settings page — remove inspector/AI panel controls

**Files:**

- Modify: `src/routes/settings.tsx`

- [ ] **Step 1: Remove unused ui-store selectors**

Remove these lines from `SettingsPage`:

```ts
const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
const aiPanelMinimized = useUiStore((s) => s.aiPanelMinimized);
const inspectorOpen = useUiStore((s) => s.inspectorOpen);
const setAiPanelOpen = useUiStore((s) => s.setAiPanelOpen);
const toggleInspector = useUiStore((s) => s.toggleInspector);
```

Keep: `manualMode` and `setManualMode`.

- [ ] **Step 2: Remove AI panel and inspector SettingRows and buttons**

In the Shell Preferences section, replace the `<dl>` grid and the button group.

Replace the `<dl>` (lines 184-201) with just the manual mode row:

```tsx
<dl className="mt-4 grid gap-3 sm:grid-cols-2">
  <SettingRow
    label="Manual modeling"
    value={manualMode ? "Enabled" : "Disabled"}
  />
</dl>
```

Replace the button group (lines 203-225) with just the manual mode toggle:

```tsx
<div className="mt-4 flex flex-wrap gap-2">
  <button
    type="button"
    onClick={() => setManualMode(!manualMode)}
    className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:bg-accent"
  >
    {manualMode ? "Disable manual mode" : "Enable manual mode"}
  </button>
</div>
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit 2>&1 | grep settings`

Expected: No errors from `settings.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings.tsx
git commit -m "refactor: remove inspector/AI panel controls from settings page"
```

---

### Task 8: Remove setInspectedTarget from 9 consumer files

**Files:**

- Modify: `src/components/phases/proposal-review.tsx`
- Modify: `src/routes/editor/phase/$phaseId.tsx`
- Modify: `src/components/scenarios/scenario-comparison.tsx`
- Modify: `src/components/game/game-map.tsx`
- Modify: `src/routes/editor/game/$gameId.tsx`
- Modify: `src/routes/editor/players.tsx`
- Modify: `src/components/game/tree-view.tsx`
- Modify: `src/components/evidence/evidence-notebook.tsx`
- Modify: `src/routes/editor/assumptions.tsx`

For each file, the pattern is the same:

- [ ] **Step 1: In each file, remove the `setInspectedTarget` selector line**

Find and remove:

```ts
const setInspectedTarget = useUiStore((s) => s.setInspectedTarget);
```

- [ ] **Step 2: Remove all `setInspectedTarget(...)` calls**

In click handlers, remove the `setInspectedTarget({ entityType: ..., entityId: ... })` call. If it's the entire `onClick` body, replace with `undefined` or remove the `onClick` prop. If it's inside an `onKeyDown` handler alongside `event.preventDefault()`, remove both the `setInspectedTarget` call and the `event.preventDefault()` (if the only purpose of the keydown handler was inspector navigation).

Detailed per-file guidance:

**`proposal-review.tsx`** (lines 84, 136, 149): Remove selector (line 84). Remove `setInspectedTarget` calls in the ternary onClick (line 136) and the onKeyDown (line 149). The onClick still has another branch — keep the handler structure but remove the inspector call.

**`phase/$phaseId.tsx`** (lines 105, 253, 266, 349, 362, 423): Remove selector (line 105). Remove all 5 `setInspectedTarget` calls in onClick/onKeyDown handlers.

**`scenario-comparison.tsx`** (lines 127, 178): Remove selector (line 127). Remove the `onInspect` prop call (line 178). Check if `onInspect` prop is only used for inspector — if so, remove the prop entirely from the child component's usage.

**`game-map.tsx`** (lines 15, 46, 53, 74, 85, 105, 116, 144, 154): Remove selector (line 15). Remove all 8 `setInspectedTarget` calls. Keep the onClick/onKeyDown handlers themselves but remove the inspector call from them. If the click handler's only purpose was to set the inspector target, replace with an empty function or remove the onClick entirely.

**`game/$gameId.tsx`** (lines 15, 60, 67, 95, 105): Remove selector (line 15). Remove all 4 `setInspectedTarget` calls.

**`players.tsx`** (lines 13, 82, 89): Remove selector (line 13). Remove 2 `setInspectedTarget` calls.

**`tree-view.tsx`** (lines 160, 217, 220): Remove selector (line 160). Remove 2 `setInspectedTarget` calls in `onNodeClick` and `onEdgeClick`.

**`evidence-notebook.tsx`** (lines 73, 127, 143): Remove selector (line 73). Remove 2 `setInspectedTarget` calls.

**`assumptions.tsx`** (lines 12, 98, 108): Remove selector (line 12). Remove 2 `setInspectedTarget` calls.

- [ ] **Step 3: Remove `useUiStore` import if no longer used**

In each file, check if `useUiStore` is still used for anything else (e.g., `manualMode`). If `setInspectedTarget` was the only selector, remove the import. Files that also use `manualMode`: `players.tsx` (line 12), `assumptions.tsx` (line 11). Those keep the import.

- [ ] **Step 4: Verify all 9 files compile**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No remaining errors. All references to removed store fields should be gone.

- [ ] **Step 5: Commit**

```bash
git add \
  src/components/phases/proposal-review.tsx \
  src/routes/editor/phase/\$phaseId.tsx \
  src/components/scenarios/scenario-comparison.tsx \
  src/components/game/game-map.tsx \
  src/routes/editor/game/\$gameId.tsx \
  src/routes/editor/players.tsx \
  src/components/game/tree-view.tsx \
  src/components/evidence/evidence-notebook.tsx \
  src/routes/editor/assumptions.tsx
git commit -m "refactor: remove setInspectedTarget calls from 9 consumer files"
```

---

### Task 9: Update tests

**Files:**

- Modify: `src/route-tests/settings-page.test.tsx`
- Modify: `src/components/panels/ai-chat-panel.test.tsx`

- [ ] **Step 1: Update settings page test — remove inspector/AI panel mocks and assertions**

In `src/route-tests/settings-page.test.tsx`:

Remove from `callbacks`:

- `setAiPanelOpen`
- `toggleInspector`

Remove from `initialUiState`:

- `aiPanelOpen: false`
- `aiPanelMinimized: false`
- `inspectorOpen: true`

Update `MockUiState` type — remove `setAiPanelOpen` and `toggleInspector`. Keep `setManualMode`.

In the `useUiStore` mock, remove the `setAiPanelOpen` and `toggleInspector` functions from the selector object.

In `resetTestState`, remove `.mockReset()` calls for `setAiPanelOpen` and `toggleInspector`.

In the first test ("refreshes statuses and applies shell preference toggles"):

- Remove the "Open AI panel" button click and assertion (lines 436-437)
- Remove the "Hide inspector" button click and assertion (lines 439-440)
- Keep the "Disable manual mode" button test
- Keep the "Refresh status" test

In the second test ("validates integration, writes MCP config, and removes MCP config") — this test references MCP integration UI that was already removed from the page. The test will fail because the `integrationSection` helper won't find the heading. **Delete this entire test** `it(...)` block.

**Delete** the `integrationSection` helper function (lines 247-254) — it is only used by the deleted test.

**Keep** all other helpers and shared state — `getIntegration`, `createIntegrationSnapshot`, `getJsonBody`, `initialIntegrationStates`, and `integrations` are used by the `beforeEach` fetch mock (lines 335-411), which serves the first test's `refreshStatuses` call. Deleting them would break the remaining test.

- [ ] **Step 2: Update ai-chat-panel test — remove minimized bar tests**

In `src/components/panels/ai-chat-panel.test.tsx`:

Remove the `AiChatMinimizedBar` import (line 12).

Delete these tests:

- "forwards expand and close actions from minimized mode" (lines 109-120)
- "shows provider and model in the compact title" (lines 122-130)

Keep:

- "reports no ready provider when all connectors are disconnected"
- "tracks conversation messages through the store"
- "shows Stop button when streaming"
- "shows Send button when not streaming"
- "renders agent messages including tool call entries"

- [ ] **Step 3: Run all tests**

Run: `npx vitest run src/route-tests/settings-page.test.tsx src/components/panels/ai-chat-panel.test.tsx`

Expected: All remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/route-tests/settings-page.test.tsx src/components/panels/ai-chat-panel.test.tsx
git commit -m "test: update settings and AI chat panel tests for docked panel layout"
```

---

### Task 10: Full verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`

Expected: Clean — no errors.

- [ ] **Step 2: Run all tests**

Run: `npx vitest run`

Expected: All tests pass.

- [ ] **Step 3: Dev server smoke test**

Run: `bun --bun vite dev --port 3000`

Open `http://localhost:3000` and verify:

1. Chat panel is docked on the right, always visible
2. Resize handle works (drag to widen/narrow)
3. Width persists across page refresh
4. Model selector in top bar shows connected models
5. Settings page shows only Manual Mode toggle
6. No inspector panel anywhere

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix: address issues found during verification"
```
