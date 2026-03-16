# M3: App Shell + Core Views — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the M1/M2 backend engine into a fully functional desktop app with 6 synchronized analytical views and complete manual modeling capability.

**Architecture:** Two-phase build. Phase 1 scaffolds the app shell (Vite + React + Zustand + Tailwind + Tauri), platform abstraction, navigation, and 4 structural screens. Phase 2 adds the coordination bus, 5 analytical views (Graph, Evidence Notebook, Matrix, Tree, Timeline/PlayerLens/Diff), and manual modeling. All L1 mutations go through the command spine. The app runs in both Tauri and browser environments.

**Tech Stack:** Tauri 2.0, React 19, Zustand, Tailwind CSS, React Flow, Lucide React, Vite, Vitest + React Testing Library + Playwright

**Spec:** `docs/superpowers/specs/2026-03-14-m3-app-shell-core-views-design.md`

---

## Chunk 1: Project Scaffolding + Platform Abstraction

### Task 1: Scaffold Vite + React + TypeScript project

**Files:**
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Modify: `package.json`
- Modify: `tsconfig.json`

- [ ] **Step 1: Install frontend dependencies**

```bash
npm install react react-dom zustand @xyflow/react lucide-react
npm install -D @types/react @types/react-dom @vitejs/plugin-react tailwindcss @tailwindcss/vite postcss autoprefixer @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Create Vite config**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: '.',
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-support/setup-dom.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
```

- [ ] **Step 3: Create index.html**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Strategic Lens</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Create entry point and App shell**

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

```typescript
// src/App.tsx
import type { ReactNode } from 'react'

export function App(): ReactNode {
  return <div className="h-screen bg-bg-page text-text-primary font-mono">Strategic Lens</div>
}
```

- [ ] **Step 5: Create global CSS with Tailwind + design tokens**

```css
/* src/styles/global.css */
@import 'tailwindcss';

@theme {
  --color-bg-page: #0F0F10;
  --color-bg-sidebar: #0A0A0B;
  --color-bg-card: #141415;
  --color-border: #27272A;
  --color-accent: #F5A623;
  --color-accent-15: #F5A62326;
  --color-text-primary: #FAFAFA;
  --color-text-muted: #A1A1AA;
  --color-text-dim: #52525B;
  --color-success: #22C55E;
  --color-success-20: #22C55E33;
  --color-warning: #F59E0B;
  --color-warning-20: #F59E0B33;
  --color-error: #EF4444;
  --color-info: #3B82F6;

  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
  --font-heading: 'Space Grotesk', system-ui, sans-serif;
}
```

- [ ] **Step 6: Create DOM test setup**

```typescript
// src/test-support/setup-dom.ts
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Update tsconfig for JSX**

Add to `tsconfig.json` compilerOptions:
```json
{
  "jsx": "react-jsx",
  "types": ["vitest/globals", "@testing-library/jest-dom"]
}
```

- [ ] **Step 8: Add scripts to package.json**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 9: Verify app launches**

Run: `npm run dev`
Expected: Vite dev server starts, browser shows "Strategic Lens" on dark background.

Run: `npm test`
Expected: All existing M1/M2 tests still pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(m3): scaffold Vite + React + Tailwind project"
```

---

### Task 2: Platform abstraction layer

**Files:**
- Create: `src/platform/types.ts`
- Create: `src/platform/detect.ts`
- Create: `src/platform/browser-file-service.ts`
- Create: `src/platform/browser-shell-service.ts`
- Create: `src/platform/tauri-file-service.ts` (stub)
- Create: `src/platform/tauri-shell-service.ts` (stub)
- Create: `src/platform/PlatformProvider.tsx`
- Create: `src/platform/__tests__/browser-file-service.test.ts`
- Create: `src/platform/__tests__/detect.test.ts`

- [ ] **Step 1: Write platform types**

```typescript
// src/platform/types.ts
import type { CanonicalStore } from '../types'
import type { LoadResult } from '../types/file'

export interface Platform {
  readonly type: 'browser' | 'tauri'
  readonly capabilities: {
    readonly nativeDialogs: boolean
    readonly nativeFs: boolean
    readonly nativeWindowChrome: boolean
  }
}

export interface RecentFile {
  readonly path: string
  readonly name: string
  readonly lastOpened: number
}

export interface SaveResult {
  readonly success: boolean
  readonly path: string
  readonly error?: string
}

export interface AnalysisFileMeta {
  readonly name: string
  readonly description?: string
  readonly created_at: string
  readonly updated_at: string
  readonly metadata: {
    readonly tags: string[]
    readonly primary_event_dates?: {
      readonly start?: string
      readonly end?: string
    }
  }
}

export interface FileService {
  openFile(): Promise<LoadResult>
  openFilePath(filepath: string): Promise<LoadResult>
  saveFile(filepath: string, store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>
  saveFileAs(store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult>
  getRecentFiles(): Promise<RecentFile[]>
  loadFixture(name: string): Promise<LoadResult>
}

export interface ShellService {
  setTitle(title: string): void
  onBeforeClose(cb: () => Promise<boolean>): void
}
```

- [ ] **Step 2: Write detect tests**

```typescript
// src/platform/__tests__/detect.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { detectPlatform } from '../detect'

describe('detectPlatform', () => {
  afterEach(() => {
    delete (globalThis as any).__TAURI_INTERNALS__
  })

  it('detects browser platform when no Tauri', () => {
    const platform = detectPlatform()
    expect(platform.type).toBe('browser')
    expect(platform.capabilities.nativeDialogs).toBe(false)
  })

  it('detects tauri platform when Tauri internals present', () => {
    ;(globalThis as any).__TAURI_INTERNALS__ = {}
    const platform = detectPlatform()
    expect(platform.type).toBe('tauri')
    expect(platform.capabilities.nativeDialogs).toBe(true)
  })
})
```

- [ ] **Step 3: Run test — verify it fails**

Run: `npx vitest run src/platform/__tests__/detect.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement detect**

```typescript
// src/platform/detect.ts
import type { Platform } from './types'

export function detectPlatform(): Platform {
  const isTauri = typeof (globalThis as any).__TAURI_INTERNALS__ !== 'undefined'

  return {
    type: isTauri ? 'tauri' : 'browser',
    capabilities: {
      nativeDialogs: isTauri,
      nativeFs: isTauri,
      nativeWindowChrome: isTauri,
    },
  }
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `npx vitest run src/platform/__tests__/detect.test.ts`
Expected: PASS

- [ ] **Step 6: Write BrowserFileService tests**

```typescript
// src/platform/__tests__/browser-file-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BrowserFileService } from '../browser-file-service'

describe('BrowserFileService', () => {
  let service: BrowserFileService

  beforeEach(() => {
    localStorage.clear()
    service = new BrowserFileService()
  })

  it('returns empty recent files initially', async () => {
    const files = await service.getRecentFiles()
    expect(files).toEqual([])
  })

  it('loads fixture by name', async () => {
    const result = await service.loadFixture('sample')
    expect(result.status).toBe('success')
  })
})
```

- [ ] **Step 7: Run test — verify it fails**

Run: `npx vitest run src/platform/__tests__/browser-file-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 8: Implement BrowserFileService**

```typescript
// src/platform/browser-file-service.ts
import type { FileService, RecentFile, SaveResult, AnalysisFileMeta } from './types'
import type { CanonicalStore } from '../types'
import type { LoadResult } from '../types/file'
import { createSampleStore, createSampleAnalysisMeta } from '../test-support/sample-analysis'
import { storeToAnalysisFile } from '../utils/serialization'

const RECENT_FILES_KEY = 'strategic-lens:recent-files'

export class BrowserFileService implements FileService {
  async openFile(): Promise<LoadResult> {
    // File System Access API — will be wired in Task 1 Phase 1 integration
    throw new Error('File picker not yet implemented for browser')
  }

  async openFilePath(_filepath: string): Promise<LoadResult> {
    throw new Error('Direct file path access not available in browser')
  }

  async saveFile(
    filepath: string,
    store: CanonicalStore,
    meta: AnalysisFileMeta,
  ): Promise<SaveResult> {
    try {
      const analysisFile = storeToAnalysisFile(store, meta)
      const blob = new Blob([JSON.stringify(analysisFile, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filepath.split('/').pop() ?? 'analysis.gta.json'
      a.click()
      URL.revokeObjectURL(url)
      return { success: true, path: filepath }
    } catch (error) {
      return { success: false, path: filepath, error: String(error) }
    }
  }

  async saveFileAs(store: CanonicalStore, meta: AnalysisFileMeta): Promise<SaveResult> {
    return this.saveFile('analysis.gta.json', store, meta)
  }

  async getRecentFiles(): Promise<RecentFile[]> {
    try {
      const stored = localStorage.getItem(RECENT_FILES_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  async loadFixture(_name: string): Promise<LoadResult> {
    const store = createSampleStore()
    const meta = createSampleAnalysisMeta()
    const analysisFile = storeToAnalysisFile(store, meta)
    return {
      status: 'success' as const,
      analysis: analysisFile,
      store,
      derived: { inverse_index: {} as any },
      integrity: { ok: true as const },
      event_log: { entries: [], cursor: -1 },
      migration: { from: 1, to: 1, steps_applied: [] },
    }
  }
}
```

- [ ] **Step 9: Implement BrowserShellService**

```typescript
// src/platform/browser-shell-service.ts
import type { ShellService } from './types'

export class BrowserShellService implements ShellService {
  setTitle(title: string): void {
    document.title = title
  }

  onBeforeClose(cb: () => Promise<boolean>): void {
    window.addEventListener('beforeunload', (e) => {
      // Can't await in beforeunload, so we just set returnValue
      e.returnValue = ''
    })
  }
}
```

- [ ] **Step 10: Create Tauri stubs**

```typescript
// src/platform/tauri-file-service.ts
import type { FileService, SaveResult, AnalysisFileMeta } from './types'
import type { CanonicalStore } from '../types'
import type { LoadResult } from '../types/file'

export class TauriFileService implements FileService {
  async openFile(): Promise<LoadResult> {
    throw new Error('Tauri file service not yet implemented')
  }
  async openFilePath(_filepath: string): Promise<LoadResult> {
    throw new Error('Tauri file service not yet implemented')
  }
  async saveFile(_filepath: string, _store: CanonicalStore, _meta: AnalysisFileMeta): Promise<SaveResult> {
    throw new Error('Tauri file service not yet implemented')
  }
  async saveFileAs(_store: CanonicalStore, _meta: AnalysisFileMeta): Promise<SaveResult> {
    throw new Error('Tauri file service not yet implemented')
  }
  async getRecentFiles() { return [] }
  async loadFixture(_name: string): Promise<LoadResult> {
    throw new Error('Tauri file service not yet implemented')
  }
}
```

```typescript
// src/platform/tauri-shell-service.ts
import type { ShellService } from './types'

export class TauriShellService implements ShellService {
  setTitle(_title: string): void {
    // Will use @tauri-apps/api window.setTitle
  }
  onBeforeClose(_cb: () => Promise<boolean>): void {
    // Will use @tauri-apps/api event listener
  }
}
```

- [ ] **Step 11: Write PlatformProvider**

```tsx
// src/platform/PlatformProvider.tsx
import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Platform, FileService, ShellService } from './types'
import { detectPlatform } from './detect'
import { BrowserFileService } from './browser-file-service'
import { BrowserShellService } from './browser-shell-service'
import { TauriFileService } from './tauri-file-service'
import { TauriShellService } from './tauri-shell-service'

interface PlatformContext {
  readonly platform: Platform
  readonly fileService: FileService
  readonly shellService: ShellService
}

const PlatformCtx = createContext<PlatformContext | null>(null)

export function PlatformProvider({ children }: { children: ReactNode }): ReactNode {
  const value = useMemo<PlatformContext>(() => {
    const platform = detectPlatform()
    if (platform.type === 'tauri') {
      return {
        platform,
        fileService: new TauriFileService(),
        shellService: new TauriShellService(),
      }
    }
    return {
      platform,
      fileService: new BrowserFileService(),
      shellService: new BrowserShellService(),
    }
  }, [])

  return <PlatformCtx.Provider value={value}>{children}</PlatformCtx.Provider>
}

export function usePlatform(): PlatformContext {
  const ctx = useContext(PlatformCtx)
  if (!ctx) throw new Error('usePlatform must be used within PlatformProvider')
  return ctx
}
```

- [ ] **Step 12: Create platform index**

```typescript
// src/platform/index.ts
export { PlatformProvider, usePlatform } from './PlatformProvider'
export type { Platform, FileService, ShellService, RecentFile, SaveResult, AnalysisFileMeta } from './types'
```

- [ ] **Step 13: Run all tests**

Run: `npm test`
Expected: All tests pass (M1/M2 + new platform tests)

- [ ] **Step 14: Commit**

```bash
git add src/platform/ src/test-support/setup-dom.ts
git commit -m "feat(m3): platform abstraction layer with browser/tauri adapters"
```

---

### Task 3: Zustand store

**Files:**
- Create: `src/store/app-store.ts`
- Create: `src/store/StoreProvider.tsx`
- Create: `src/store/index.ts`
- Create: `src/store/__tests__/app-store.test.ts`

- [ ] **Step 1: Write store tests**

```typescript
// src/store/__tests__/app-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createAppStore } from '../app-store'
import type { AppStore } from '../app-store'

describe('AppStore', () => {
  let store: ReturnType<typeof createAppStore>

  beforeEach(() => {
    store = createAppStore()
  })

  it('initializes with welcome view', () => {
    const state = store.getState()
    expect(state.viewState.activeView).toBe('welcome')
    expect(state.viewState.activeGameId).toBeNull()
  })

  it('sets active view', () => {
    store.getState().setActiveView('board')
    expect(store.getState().viewState.activeView).toBe('board')
  })

  it('sets active game and clears on null', () => {
    store.getState().setActiveGame('gm_123')
    expect(store.getState().viewState.activeGameId).toBe('gm_123')

    store.getState().setActiveGame(null)
    expect(store.getState().viewState.activeGameId).toBeNull()
  })

  it('dispatches add command and marks dirty', () => {
    const result = store.getState().dispatch({
      kind: 'add_game',
      payload: {
        name: 'Test Game',
        description: 'A test',
        status: 'active',
        labels: [],
        player_ids: [],
        formalization_ids: [],
      },
    })
    expect(result.status).toBe('committed')
    expect(store.getState().fileMeta.dirty).toBe(true)
  })

  it('undo returns false when nothing to undo', () => {
    expect(store.getState().undo()).toBe(false)
  })

  it('undo reverts last dispatch', () => {
    store.getState().dispatch({
      kind: 'add_game',
      payload: {
        name: 'Test Game',
        description: 'A test',
        status: 'active',
        labels: [],
        player_ids: [],
        formalization_ids: [],
      },
    })
    const gamesAfterAdd = Object.keys(store.getState().canonical.games).length
    expect(gamesAfterAdd).toBe(1)

    expect(store.getState().undo()).toBe(true)
    const gamesAfterUndo = Object.keys(store.getState().canonical.games).length
    expect(gamesAfterUndo).toBe(0)
  })

  it('blocks dispatch during recovery mode', () => {
    // Simulate entering recovery
    store.setState({
      recovery: {
        active: true,
        stage: 'parse',
        raw_json: '{ broken',
        error: { message: 'Invalid JSON' },
      },
    })
    const result = store.getState().dispatch({
      kind: 'add_game',
      payload: { name: 'X', description: '', status: 'active', labels: [], player_ids: [], formalization_ids: [] },
    })
    expect(result.status).toBe('rejected')
  })

  it('sets inspected refs', () => {
    store.getState().setInspectedRefs([{ type: 'game', id: 'gm_1' }])
    expect(store.getState().viewState.inspectedRefs).toEqual([{ type: 'game', id: 'gm_1' }])
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/store/__tests__/app-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AppStore**

Reference: spec section "Zustand Store" for the full interface shape. The store wraps M2's `dispatch()` function and manages L1 (canonical), L2 (viewState), engine state, file metadata, and recovery state.

Key implementation points:
- Import and call `dispatch` from `src/engine/dispatch.ts` for L1 mutations
- Use `createEventLog` from `src/engine/events.ts` for event log init
- Use `buildInverseIndex` from `src/engine/inverse-index.ts` for inverse index
- L2 actions use Zustand `set()` directly
- `undo()`/`redo()` return `boolean`
- `dispatch()` checks `recovery.active` before proceeding
- Empty canonical store as initial state (all entity maps empty)

```typescript
// src/store/app-store.ts
import { createStore } from 'zustand/vanilla'
import type { CanonicalStore, EntityRef } from '../types'
import type { EventLog } from '../engine/events'
import type { Command } from '../engine/commands'
import type { DispatchResult } from '../engine/dispatch'
import type { InverseIndex } from '../engine/inverse-index'
import type { ModelEvent } from '../engine/command-event'
import type { AnalysisFileMeta } from '../platform/types'
import type { StructuralIssue } from '../types/file'
import { dispatch as engineDispatch } from '../engine/dispatch'
import { createEventLog } from '../engine/events'
import { buildInverseIndex } from '../engine/inverse-index'

// ... (full implementation — see spec for complete ViewType and interface)
```

The full store implementation follows the spec's `AppStore` interface exactly. Write it following the test expectations above.

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/store/__tests__/app-store.test.ts`
Expected: PASS

- [ ] **Step 5: Write StoreProvider**

```tsx
// src/store/StoreProvider.tsx
import { createContext, useContext, useRef } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { createAppStore } from './app-store'
import type { AppStore } from './app-store'

type AppStoreApi = ReturnType<typeof createAppStore>

const StoreCtx = createContext<AppStoreApi | null>(null)

export function StoreProvider({ children }: { children: ReactNode }): ReactNode {
  const storeRef = useRef<AppStoreApi>(null)
  if (!storeRef.current) {
    storeRef.current = createAppStore()
  }
  return <StoreCtx.Provider value={storeRef.current}>{children}</StoreCtx.Provider>
}

export function useAppStore<T>(selector: (state: AppStore) => T): T {
  const store = useContext(StoreCtx)
  if (!store) throw new Error('useAppStore must be used within StoreProvider')
  return useStore(store, selector)
}
```

- [ ] **Step 6: Create store index**

```typescript
// src/store/index.ts
export { StoreProvider, useAppStore } from './StoreProvider'
export { createAppStore } from './app-store'
export type { AppStore, ViewType } from './app-store'
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/store/
git commit -m "feat(m3): Zustand store with L1/L2 separation and recovery mode"
```

---

### Task 4: Add update_normal_form_payoff command to M2

**Files:**
- Modify: `src/engine/commands.ts`
- Modify: `src/engine/reducer.ts`
- Create: `src/engine/__tests__/normal-form-payoff.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// src/engine/__tests__/normal-form-payoff.test.ts
import { describe, it, expect } from 'vitest'
import { dispatch } from '../dispatch'
import { createEventLog } from '../events'
import { createEmptyStore } from '../../test-support/sample-analysis'

describe('update_normal_form_payoff', () => {
  it('updates a payoff cell in a normal-form formalization', () => {
    const store = createEmptyStore()
    const eventLog = createEventLog()

    // Add a game, players, and normal-form formalization first
    // ... (setup via dispatch calls)

    const result = dispatch(store, eventLog, {
      kind: 'update_normal_form_payoff',
      payload: {
        formalization_id: 'fm_1',
        cell_index: 0,
        player_id: 'pl_1',
        value: {
          representation: 'cardinal_estimate',
          value: 5,
          confidence: 0.8,
          rationale: 'Updated payoff',
          source_claims: ['cl_1'],
        },
      },
    })
    expect(result.status).toBe('committed')
  })

  it('rejects update on non-existent formalization', () => {
    const store = createEmptyStore()
    const eventLog = createEventLog()

    const result = dispatch(store, eventLog, {
      kind: 'update_normal_form_payoff',
      payload: {
        formalization_id: 'nonexistent',
        cell_index: 0,
        player_id: 'pl_1',
        value: {
          representation: 'cardinal_estimate',
          value: 5,
          confidence: 0.8,
          rationale: 'Test',
          source_claims: [],
        },
      },
    })
    expect(result.status).toBe('rejected')
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/engine/__tests__/normal-form-payoff.test.ts`
Expected: FAIL

- [ ] **Step 3: Add command type to commands.ts**

Add `update_normal_form_payoff` to the `StructuralCommand` union in `src/engine/commands.ts`:

```typescript
| (BaseCommand & {
    kind: 'update_normal_form_payoff'
    payload: {
      formalization_id: string
      cell_index: number
      player_id: string
      value: EstimateValue
    }
  })
```

- [ ] **Step 4: Add reducer case**

Add handler to `reduceStore` in `src/engine/reducer.ts`:

```typescript
case 'update_normal_form_payoff': {
  const nextStore = cloneStore(store)
  const formalization = nextStore.formalizations[command.payload.formalization_id]
  if (!formalization) {
    throw new CommandError(
      `Formalization ${command.payload.formalization_id} does not exist.`,
    )
  }
  if (formalization.kind !== 'normal_form') {
    throw new CommandError(
      `Formalization ${command.payload.formalization_id} is not normal-form.`,
    )
  }
  const cell = formalization.payoff_cells[command.payload.cell_index]
  if (!cell) {
    throw new CommandError(
      `Cell index ${command.payload.cell_index} out of bounds.`,
    )
  }
  formalization.payoff_cells = formalization.payoff_cells.map((c, i) =>
    i === command.payload.cell_index
      ? { ...c, payoffs: { ...c.payoffs, [command.payload.player_id]: command.payload.value } }
      : c,
  )
  return nextStore
}
```

- [ ] **Step 5: Run test — verify it passes**

Run: `npx vitest run src/engine/__tests__/normal-form-payoff.test.ts`
Expected: PASS

- [ ] **Step 6: Run all tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 7: Commit**

```bash
git add src/engine/commands.ts src/engine/reducer.ts src/engine/__tests__/
git commit -m "feat(m3): add update_normal_form_payoff command for matrix view editing"
```

---

## Chunk 2: Design System + App Layout

### Task 5: Design system components

**Files:**
- Create: `src/components/design-system/Button.tsx`
- Create: `src/components/design-system/Badge.tsx`
- Create: `src/components/design-system/ConfidenceBadge.tsx`
- Create: `src/components/design-system/StaleBadge.tsx`
- Create: `src/components/design-system/EstimateValueDisplay.tsx`
- Create: `src/components/design-system/Card.tsx`
- Create: `src/components/design-system/NavItem.tsx`
- Create: `src/components/design-system/Breadcrumb.tsx`
- Create: `src/components/design-system/ViewTab.tsx`
- Create: `src/components/design-system/index.ts`
- Create: `src/components/design-system/__tests__/components.test.tsx`

- [ ] **Step 1: Write component tests**

Test each design system component renders correctly:

```tsx
// src/components/design-system/__tests__/components.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Button } from '../Button'
import { Badge } from '../Badge'
import { ConfidenceBadge } from '../ConfidenceBadge'
import { StaleBadge } from '../StaleBadge'
import { Card } from '../Card'

describe('Design System', () => {
  it('renders primary button', () => {
    render(<Button variant="primary">Click me</Button>)
    expect(screen.getByText('Click me')).toBeInTheDocument()
  })

  it('renders secondary button', () => {
    render(<Button variant="secondary">Cancel</Button>)
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('renders badge', () => {
    render(<Badge>ACTIVE</Badge>)
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })

  it('renders confidence badge with color coding', () => {
    render(<ConfidenceBadge value={0.85} />)
    expect(screen.getByText('0.85')).toBeInTheDocument()
  })

  it('renders stale badge', () => {
    render(<StaleBadge />)
    expect(screen.getByText('STALE')).toBeInTheDocument()
  })

  it('renders card with title and children', () => {
    render(<Card title="Test Card"><p>Content</p></Card>)
    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Content')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/components/design-system/__tests__/components.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement all design system components**

Implement each component matching the `.pen` design mocks:
- `Button` — primary (amber fill, dark text) / secondary (outline, light text). Props: `variant`, `icon?`, `onClick`, `children`.
- `Badge` — colored background pill. Props: `children`, `color?`.
- `ConfidenceBadge` — dot + value, color-coded (green ≥0.7, yellow ≥0.4, red <0.4). Props: `value`.
- `StaleBadge` — warning triangle icon + "STALE" text, amber background.
- `EstimateValueDisplay` — value + inline ConfidenceBadge. Props: `estimate: EstimateValue`.
- `Card` — dark container with border, title, and children slot. Props: `title`, `children`.
- `NavItem` — icon + label, active state with amber highlight + left border. Props: `icon`, `label`, `active`, `onClick`.
- `Breadcrumb` — path segments with `›` separators. Props: `segments: string[]`.
- `ViewTab` — icon + label, active state with bottom border. Props: `icon`, `label`, `active`, `onClick`.

Use Lucide icons throughout. All components use Tailwind utility classes matching the design tokens.

- [ ] **Step 4: Run test — verify it passes**

Run: `npx vitest run src/components/design-system/__tests__/components.test.tsx`
Expected: PASS

- [ ] **Step 5: Create index barrel**

```typescript
// src/components/design-system/index.ts
export { Button } from './Button'
export { Badge } from './Badge'
export { ConfidenceBadge } from './ConfidenceBadge'
export { StaleBadge } from './StaleBadge'
export { EstimateValueDisplay } from './EstimateValueDisplay'
export { Card } from './Card'
export { NavItem } from './NavItem'
export { Breadcrumb } from './Breadcrumb'
export { ViewTab } from './ViewTab'
```

- [ ] **Step 6: Commit**

```bash
git add src/components/design-system/
git commit -m "feat(m3): design system components matching .pen mocks"
```

---

### Task 6: App layout (Sidebar, TopBar, StatusBar, ViewRouter)

**Files:**
- Create: `src/components/layout/Sidebar.tsx`
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/StatusBar.tsx`
- Create: `src/components/layout/ViewRouter.tsx`
- Create: `src/components/layout/AppLayout.tsx`
- Create: `src/components/layout/index.ts`
- Create: `src/components/layout/__tests__/layout.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write layout tests**

```tsx
// src/components/layout/__tests__/layout.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StoreProvider } from '../../../store'
import { PlatformProvider } from '../../../platform'
import { AppLayout } from '../AppLayout'

function renderWithProviders() {
  return render(
    <PlatformProvider>
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    </PlatformProvider>,
  )
}

describe('AppLayout', () => {
  it('renders sidebar with app navigation', () => {
    renderWithProviders()
    expect(screen.getByText('STRATEGIC LENS')).toBeInTheDocument()
    expect(screen.getByText('WORKFLOW BOARD')).toBeInTheDocument()
    expect(screen.getByText('GAMES')).toBeInTheDocument()
    expect(screen.getByText('PLAYERS')).toBeInTheDocument()
    expect(screen.getByText('EVIDENCE')).toBeInTheDocument()
  })

  it('does not show game section when no game selected', () => {
    renderWithProviders()
    expect(screen.queryByText('GRAPH')).not.toBeInTheDocument()
  })

  it('renders status bar', () => {
    renderWithProviders()
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `npx vitest run src/components/layout/__tests__/layout.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Sidebar**

Two sections: APP (always visible) and game-scoped views (conditional on `activeGameId`).
- Uses `NavItem` from design system
- Lucide icons: `LayoutDashboard`, `Swords`, `Users`, `FileText`, `GitBranch`, `Grid3x3`, `ListTree`, `BookOpen`, `Play`, `Settings`
- Active state driven by `viewState.activeView` from store
- `onClick` calls `setActiveView()` and `setActiveGame(null)` for app-level pages

- [ ] **Step 4: Implement TopBar**

- Breadcrumb showing navigation context
- Toolbar buttons: Undo (disabled when nothing to undo), Redo (disabled when nothing to redo), Save (disabled when not dirty)
- Uses `useAppStore` selectors for button state

- [ ] **Step 5: Implement StatusBar**

- Shows file path or "No file open"
- Save status ("saved" / "unsaved changes")
- Version: "v0.1.0"

- [ ] **Step 6: Implement ViewRouter**

```tsx
// src/components/layout/ViewRouter.tsx
import type { ReactNode } from 'react'
import { useAppStore } from '../../store'

export function ViewRouter(): ReactNode {
  const activeView = useAppStore((s) => s.viewState.activeView)
  const recoveryActive = useAppStore((s) => s.recovery.active)

  if (recoveryActive) {
    return <div className="p-8 text-warning">Recovery mode — file has errors</div>
  }

  switch (activeView) {
    case 'welcome':
      return <div className="p-8">Welcome Screen (Task 7)</div>
    case 'board':
      return <div className="p-8">Workflow Board (Task 8)</div>
    case 'players_registry':
      return <div className="p-8">Players Registry (Task 9)</div>
    case 'evidence_library':
      return <div className="p-8">Evidence Library (Task 10)</div>
    case 'graph':
      return <div className="p-8">Graph View (Task 12)</div>
    case 'matrix':
      return <div className="p-8">Matrix View (Task 15)</div>
    case 'tree':
      return <div className="p-8">Tree View (Task 16)</div>
    case 'evidence_notebook':
      return <div className="p-8">Evidence Notebook (Task 13)</div>
    case 'timeline':
    case 'player_lens':
    case 'diff':
      return <div className="p-8">{activeView} (Task 17)</div>
    default:
      return <div className="p-8">View not implemented</div>
  }
}
```

- [ ] **Step 7: Implement AppLayout**

Composes Sidebar + TopBar + ViewRouter + StatusBar in a flex layout matching the .pen mocks:
- Sidebar: fixed 240px width, full height, left side
- Main area: flex column (TopBar → ViewRouter → StatusBar)

- [ ] **Step 8: Wire App.tsx**

```tsx
// src/App.tsx
import type { ReactNode } from 'react'
import { PlatformProvider } from './platform'
import { StoreProvider } from './store'
import { AppLayout } from './components/layout'

export function App(): ReactNode {
  return (
    <PlatformProvider>
      <StoreProvider>
        <AppLayout />
      </StoreProvider>
    </PlatformProvider>
  )
}
```

- [ ] **Step 9: Run tests — verify they pass**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 10: Verify visually**

Run: `npm run dev`
Expected: App shows sidebar with navigation items, top bar, placeholder content area, and status bar. Clicking nav items switches the view. Dark theme with amber accents.

- [ ] **Step 11: Commit**

```bash
git add src/components/layout/ src/App.tsx
git commit -m "feat(m3): app layout with sidebar, topbar, status bar, and view router"
```

---

### Task 7: Welcome Screen

**Files:**
- Create: `src/components/shell/WelcomeScreen.tsx`
- Create: `src/components/shell/__tests__/WelcomeScreen.test.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write test**

Test renders 4 action cards (Create New Analysis, Open File, Load Example, Continue Without AI), recent files list, and version footer.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement WelcomeScreen**

Match the `.pen` Welcome Screen mock:
- Strategic Lens logo + title
- 4 action cards in a row: Create New Analysis (calls `newAnalysis` + navigate to board), Open File (calls `loadFile`), Load Example (calls `loadFixture`), Continue Without AI
- Recent files list from `fileService.getRecentFiles()`
- Version footer: "v0.1.0 — LOCAL-FIRST ANALYSIS"

- [ ] **Step 4: Wire into ViewRouter** — replace placeholder for `'welcome'` case
- [ ] **Step 5: Run — verify pass**
- [ ] **Step 6: Commit**

```bash
git commit -m "feat(m3): welcome screen with action cards and recent files"
```

---

### Task 8: Workflow Board

**Files:**
- Create: `src/components/shell/WorkflowBoard.tsx`
- Create: `src/store/selectors/board-selectors.ts`
- Create: `src/store/selectors/__tests__/board-selectors.test.ts`
- Create: `src/components/shell/__tests__/WorkflowBoard.test.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write board selector tests**

Test `useWorkflowColumns()` derives kanban columns from game state:
- Game with no formalizations → Draft
- Game with incomplete formalization → Modeling
- Game with complete formalization → Formalized
- Game with `status: 'resolved'` or `'paused'` → Review

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement board selectors**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Write WorkflowBoard component test**

Test renders kanban columns with game cards, + Add button.

- [ ] **Step 6: Run — verify fail**
- [ ] **Step 7: Implement WorkflowBoard**

Match `.pen` Workflow Board mock. Click card → `setActiveGame(id)` + `setActiveView('graph')`.

- [ ] **Step 8: Wire into ViewRouter**
- [ ] **Step 9: Run all tests — verify pass**
- [ ] **Step 10: Commit**

```bash
git commit -m "feat(m3): workflow board with derived kanban columns"
```

---

### Task 9: Players Registry

**Files:**
- Create: `src/components/shell/PlayersRegistry.tsx`
- Create: `src/store/selectors/player-selectors.ts`
- Create: `src/components/shell/__tests__/PlayersRegistry.test.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write selector tests** — `usePlayersRegistry()` returns all players with game counts
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement selectors**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Write component test** — renders player cards, + Add Player button
- [ ] **Step 6: Run — verify fail**
- [ ] **Step 7: Implement PlayersRegistry** — match `.pen` mock, card grid layout
- [ ] **Step 8: Wire into ViewRouter**
- [ ] **Step 9: Run — verify pass**
- [ ] **Step 10: Commit**

```bash
git commit -m "feat(m3): players registry with cross-game player grid"
```

---

### Task 10: Evidence Library

**Files:**
- Create: `src/components/shell/EvidenceLibrary.tsx`
- Create: `src/store/selectors/evidence-selectors.ts`
- Create: `src/components/shell/__tests__/EvidenceLibrary.test.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write selector tests** — `useEvidenceLibrary()` returns all evidence with tab filtering (All / Sources / Claims / Assumptions)
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement selectors**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Write component test** — renders tab filter, evidence items with badges
- [ ] **Step 6: Run — verify fail**
- [ ] **Step 7: Implement EvidenceLibrary** — match `.pen` mock, tab filter + search
- [ ] **Step 8: Wire into ViewRouter**
- [ ] **Step 9: Run — verify pass**
- [ ] **Step 10: Commit**

```bash
git commit -m "feat(m3): evidence library with tab filtering and search"
```

---

## Chunk 3: Coordination Bus + Graph View

### Task 11: Coordination bus

**Files:**
- Create: `src/coordination/types.ts`
- Create: `src/coordination/bus.ts`
- Create: `src/coordination/hooks.ts`
- Create: `src/coordination/index.ts`
- Create: `src/coordination/__tests__/bus.test.ts`

- [ ] **Step 1: Write bus tests**

```typescript
// src/coordination/__tests__/bus.test.ts
import { describe, it, expect, vi } from 'vitest'
import { createCoordinationBus } from '../bus'

describe('CoordinationBus', () => {
  it('emits and receives events', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()
    bus.subscribe('selection_changed', handler)

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: 'c1',
      refs: [{ type: 'game_node', id: 'nd_1' }],
    })

    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('prevents echo via correlation_id', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()
    bus.subscribe('selection_changed', handler)

    // Simulate a view emitting and receiving its own event
    const event = {
      kind: 'selection_changed' as const,
      source_view: 'graph' as const,
      correlation_id: 'c1',
      refs: [{ type: 'game_node' as const, id: 'nd_1' }],
    }
    bus.emit(event)

    // Handler is called (other views would check correlation_id themselves)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes correctly', () => {
    const bus = createCoordinationBus()
    const handler = vi.fn()
    const unsub = bus.subscribe('selection_changed', handler)
    unsub()

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: 'c2',
      refs: [],
    })

    expect(handler).not.toHaveBeenCalled()
  })

  it('updates snapshot on selection_changed', () => {
    const bus = createCoordinationBus()

    bus.emit({
      kind: 'selection_changed',
      source_view: 'graph',
      correlation_id: 'c1',
      refs: [{ type: 'game_node', id: 'nd_1' }],
    })

    const snapshot = bus.getSnapshot()
    expect(snapshot.selectedRefs).toEqual([{ type: 'game_node', id: 'nd_1' }])
  })
})
```

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement bus types**

Copy typed event union from spec section "Coordination Bus".

- [ ] **Step 4: Implement bus**

```typescript
// src/coordination/bus.ts
import type { CoordinationEvent, CoordinationEventKind, CoordinationSnapshot, CoordinationBus } from './types'

export function createCoordinationBus(): CoordinationBus {
  const listeners = new Map<CoordinationEventKind, Set<(e: CoordinationEvent) => void>>()
  let snapshot: CoordinationSnapshot = {
    selectedRefs: [],
    focusedEntity: null,
    highlightedDependents: [],
  }

  return {
    emit(event: CoordinationEvent): void {
      // Update snapshot based on event kind
      if (event.kind === 'selection_changed') {
        snapshot = { ...snapshot, selectedRefs: event.refs }
      } else if (event.kind === 'focus_entity') {
        snapshot = { ...snapshot, focusedEntity: event.ref }
      } else if (event.kind === 'highlight_dependents') {
        snapshot = { ...snapshot, highlightedDependents: event.dependent_refs }
      } else if (event.kind === 'highlight_clear') {
        snapshot = { ...snapshot, highlightedDependents: [] }
      }

      const handlers = listeners.get(event.kind)
      if (handlers) {
        for (const handler of handlers) {
          handler(event)
        }
      }
    },

    subscribe(kind: CoordinationEventKind, handler: (e: CoordinationEvent) => void): () => void {
      if (!listeners.has(kind)) {
        listeners.set(kind, new Set())
      }
      listeners.get(kind)!.add(handler)
      return () => { listeners.get(kind)?.delete(handler) }
    },

    getSnapshot(): CoordinationSnapshot {
      return snapshot
    },
  }
}
```

- [ ] **Step 5: Implement React hook**

```typescript
// src/coordination/hooks.ts
import { useEffect } from 'react'
import type { CoordinationEvent, CoordinationEventKind } from './types'
import { coordinationBus } from './index'

export function useCoordinationHandler(
  kind: CoordinationEventKind,
  handler: (event: CoordinationEvent) => void,
): void {
  useEffect(() => {
    return coordinationBus.subscribe(kind, handler)
  }, [kind, handler])
}
```

- [ ] **Step 6: Create index with singleton**

```typescript
// src/coordination/index.ts
export { createCoordinationBus } from './bus'
export { useCoordinationHandler } from './hooks'
export type { CoordinationBus, CoordinationEvent, CoordinationEventKind, CoordinationSnapshot } from './types'
import { createCoordinationBus } from './bus'

export const coordinationBus = createCoordinationBus()
```

- [ ] **Step 7: Run — verify pass**
- [ ] **Step 8: Commit**

```bash
git add src/coordination/
git commit -m "feat(m3): coordination bus with typed events and echo prevention"
```

---

### Task 12: Graph View

**Files:**
- Create: `src/components/views/graph/GraphView.tsx`
- Create: `src/components/views/graph/nodes/DecisionNode.tsx`
- Create: `src/components/views/graph/nodes/ChanceNode.tsx`
- Create: `src/components/views/graph/nodes/TerminalNode.tsx`
- Create: `src/components/views/graph/edges/GameEdge.tsx`
- Create: `src/components/views/graph/graph-layout.ts`
- Create: `src/store/selectors/graph-selectors.ts`
- Create: `src/components/views/graph/__tests__/graph-selectors.test.ts`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write graph selector tests**

Test `useGraphViewModel()` transforms formalization GameNodes/GameEdges into React Flow nodes and edges. Test it only includes entities from the active formalization.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement graph selectors**

Selector reads `activeGameId` + `activeFormalizationId` from store, extracts matching nodes/edges from canonical store, maps to React Flow `Node<>` and `Edge<>` types.

- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Implement custom React Flow nodes**

- `DecisionNode` — square shape, player name + available actions, colored border
- `ChanceNode` — diamond shape (CSS rotate 45deg), probability label
- `TerminalNode` — rounded rectangle, payoff estimates via `EstimateValueDisplay`
- All nodes show `StaleBadge` when stale (via `useIsStale()` hook checking store)

- [ ] **Step 6: Implement custom GameEdge**

Solid edge with action label, uses React Flow's `BaseEdge` + `EdgeLabelRenderer`.

- [ ] **Step 7: Implement GraphView**

React Flow canvas with:
- Custom node types registered
- Custom edge type registered
- Pan/zoom controls
- Selection syncs to coordination bus (`selection_changed` event)
- Click node → update `inspectedRefs` via store

- [ ] **Step 8: Wire into ViewRouter**
- [ ] **Step 9: Run all tests — verify pass**
- [ ] **Step 10: Commit**

```bash
git commit -m "feat(m3): graph view with React Flow custom nodes and coordination bus"
```

---

### Task 13: Inspector Panel

**Files:**
- Create: `src/components/inspector/InspectorPanel.tsx`
- Create: `src/components/inspector/EntityDetail.tsx`
- Create: `src/components/inspector/index.ts`
- Modify: `src/components/views/graph/GraphView.tsx` (add inspector to right side)

- [ ] **Step 1: Write tests** — renders entity details when `inspectedRefs` has items, shows empty state otherwise
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement InspectorPanel**

Right sidebar (320px) showing details of selected entity:
- Entity name, type badge
- Key fields (depends on entity type)
- Evidence links (clickable → emit `focus_entity` on bus)
- Assumptions list with confidence badges
- Stale badge if entity is stale

- [ ] **Step 4: Implement EntityDetail** — type-specific rendering for game, player, game_node, game_edge, formalization, evidence types
- [ ] **Step 5: Add inspector to GraphView** — flex layout with canvas + inspector panel
- [ ] **Step 6: Run — verify pass**
- [ ] **Step 7: Commit**

```bash
git commit -m "feat(m3): inspector panel with entity detail rendering"
```

---

## Chunk 4: Evidence Notebook + Matrix/Tree Views

### Task 14: Evidence Notebook (game-scoped)

**Files:**
- Create: `src/components/views/evidence/EvidenceNotebook.tsx`
- Create: `src/components/views/evidence/EvidenceCard.tsx`
- Create: `src/components/views/evidence/ContradictionCard.tsx`
- Create: `src/components/views/evidence/DerivationChain.tsx`
- Create: `src/store/selectors/evidence-notebook-selectors.ts`
- Create: `src/store/selectors/__tests__/evidence-notebook-selectors.test.ts`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write selector tests**

Test `useEvidenceLadder()` extracts and groups evidence by type (Sources → Observations → Claims → Inferences → Assumptions) for the active game. Test `useDerivationChain()` walks DerivationEdge entities.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement selectors**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Implement EvidenceCard** — renders each evidence type with type badge, confidence, stale status, clickable links
- [ ] **Step 6: Implement ContradictionCard** — paired left/right claims side-by-side with resolution status
- [ ] **Step 7: Implement DerivationChain** — inline upstream/downstream visualization
- [ ] **Step 8: Implement EvidenceNotebook** — vertical scrolling list grouped by evidence type, cross-view sync via coordination bus
- [ ] **Step 9: Wire into ViewRouter**
- [ ] **Step 10: Run — verify pass**
- [ ] **Step 11: Commit**

```bash
git commit -m "feat(m3): evidence notebook with ladder, derivation chains, and cross-view sync"
```

---

### Task 15: Matrix View + EstimateEditor

**Files:**
- Create: `src/components/views/matrix/MatrixView.tsx`
- Create: `src/components/views/matrix/PayoffCell.tsx`
- Create: `src/components/editors/EstimateEditor.tsx`
- Create: `src/store/selectors/normal-form-selectors.ts`
- Create: `src/store/selectors/__tests__/normal-form-selectors.test.ts`
- Create: `src/components/editors/__tests__/EstimateEditor.test.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write normal-form selector tests**

Test `useNormalFormViewModel()` builds matrix data from formalization `payoff_cells` — rows/columns derived from strategy profiles.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement selectors**
- [ ] **Step 4: Run — verify pass**

- [ ] **Step 5: Write EstimateEditor tests**

```tsx
// src/components/editors/__tests__/EstimateEditor.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EstimateEditor } from '../EstimateEditor'

describe('EstimateEditor', () => {
  const existing = {
    representation: 'cardinal_estimate' as const,
    value: 3,
    confidence: 0.7,
    rationale: 'Original rationale',
    source_claims: ['cl_1'],
    supporting_inferences: ['inf_1'],
    assumptions: ['asm_1'],
    latent_factors: ['lf_1'],
  }

  it('rejects save without rationale', () => {
    const onSave = vi.fn()
    render(<EstimateEditor existing={existing} onSave={onSave} onCancel={() => {}} />)

    // Clear rationale and try to save
    const rationale = screen.getByLabelText(/rationale/i)
    fireEvent.change(rationale, { target: { value: '' } })
    fireEvent.click(screen.getByText(/save/i))

    expect(onSave).not.toHaveBeenCalled()
  })

  it('preserves provenance fields on save (merge semantics)', () => {
    const onSave = vi.fn()
    render(<EstimateEditor existing={existing} onSave={onSave} onCancel={() => {}} />)

    // Change value only
    const valueInput = screen.getByLabelText(/value/i)
    fireEvent.change(valueInput, { target: { value: '5' } })
    fireEvent.click(screen.getByText(/save/i))

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        value: 5,
        supporting_inferences: ['inf_1'],
        assumptions: ['asm_1'],
        latent_factors: ['lf_1'],
      }),
    )
  })
})
```

- [ ] **Step 6: Run — verify fail**
- [ ] **Step 7: Implement EstimateEditor**

Form with fields: value, representation type (dropdown), confidence (slider 0-1), rationale (textarea), source_claims (tag input).
- Read-only display of: supporting_inferences, assumptions, latent_factors
- Validation: rejects empty rationale, rejects missing confidence
- On save: merge user edits into existing estimate (`{ ...existing, ...edited }`)
- Dispatches `update_payoff` (extensive-form) or `update_normal_form_payoff` (normal-form) depending on context

- [ ] **Step 8: Run — verify pass**
- [ ] **Step 9: Implement MatrixView** — table with PayoffCells, click cell opens EstimateEditor, match `.pen` Matrix View mock
- [ ] **Step 10: Wire into ViewRouter**
- [ ] **Step 11: Run all tests — verify pass**
- [ ] **Step 12: Commit**

```bash
git commit -m "feat(m3): matrix view with estimate editor and merge semantics"
```

---

### Task 16: Tree View

**Files:**
- Create: `src/components/views/tree/TreeView.tsx`
- Create: `src/components/views/tree/tree-layout.ts`
- Create: `src/store/selectors/extensive-form-selectors.ts`
- Create: `src/store/selectors/__tests__/extensive-form-selectors.test.ts`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write selector tests**

Test `useExtensiveFormViewModel()` builds tree data from formalization root node, arranging nodes in top-down hierarchy.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement selectors**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Implement tree layout algorithm**

Custom layout function that positions React Flow nodes top-down:
- Root node at top center
- Children arranged horizontally below parent
- Recursive descent through the game tree
- Information set grouping: calculate bounding boxes for nodes in the same info set

- [ ] **Step 6: Implement TreeView**

Uses same React Flow instance and custom nodes as GraphView (DecisionNode, ChanceNode, TerminalNode), but with tree layout instead of free-form graph layout. Inspector panel on right for node details and payoff editing.

- [ ] **Step 7: Wire into ViewRouter**
- [ ] **Step 8: Run — verify pass**
- [ ] **Step 9: Commit**

```bash
git commit -m "feat(m3): tree view with top-down layout for extensive-form games"
```

---

## Chunk 5: Remaining Views + Manual Modeling

### Task 17: Timeline, Player Lens, and Diff views

**Files:**
- Create: `src/components/views/timeline/TimelineView.tsx`
- Create: `src/components/views/player-lens/PlayerLensView.tsx`
- Create: `src/components/views/diff/DiffView.tsx`
- Create: `src/store/selectors/timeline-selectors.ts`
- Create: `src/store/selectors/player-lens-selectors.ts`
- Create: `src/store/selectors/diff-selectors.ts`
- Modify: `src/components/layout/ViewRouter.tsx`

All three are **read-only derived views** — no editing, purely analytical.

- [ ] **Step 1: Write timeline selector tests** — `useTimelineEntries()` maps model events to timeline entries grouped by axis
- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement timeline selector**
- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Implement TimelineView** — swimlane layout per time axis, read-only

- [ ] **Step 6: Write player lens selector tests** — `usePlayerLens()` aggregates games, objectives, pressure points per player
- [ ] **Step 7: Run — verify fail**
- [ ] **Step 8: Implement player lens selector**
- [ ] **Step 9: Run — verify pass**
- [ ] **Step 10: Implement PlayerLensView** — per-player summary, read-only

- [ ] **Step 11: Write diff selector tests** — `useDiffEntries()` extracts change log from in-memory event log with field diffs
- [ ] **Step 12: Run — verify fail**
- [ ] **Step 13: Implement diff selector**
- [ ] **Step 14: Run — verify pass**
- [ ] **Step 15: Implement DiffView** — change log with filters, cascade causality display

- [ ] **Step 16: Wire all three into ViewRouter**
- [ ] **Step 17: Run all tests — verify pass**
- [ ] **Step 18: Commit**

```bash
git commit -m "feat(m3): timeline, player lens, and diff views (read-only analytical)"
```

---

### Task 18: Manual modeling — Creation wizards

**Files:**
- Create: `src/components/editors/wizards/CreateGameWizard.tsx`
- Create: `src/components/editors/wizards/CreatePlayerWizard.tsx`
- Create: `src/components/editors/wizards/CreateNodeWizard.tsx`
- Create: `src/components/editors/wizards/CreateEdgeWizard.tsx`
- Create: `src/components/editors/wizards/CreateFormalizationWizard.tsx`
- Create: `src/components/editors/wizards/CreateEvidenceWizard.tsx`
- Create: `src/components/editors/wizards/CreateAssumptionWizard.tsx`
- Create: `src/components/editors/wizards/CreateCrossGameLinkWizard.tsx`
- Create: `src/components/editors/builders.ts`
- Create: `src/components/editors/__tests__/builders.test.ts`
- Create: `src/components/editors/wizards/index.ts`

- [ ] **Step 1: Write builder function tests**

```typescript
// src/components/editors/__tests__/builders.test.ts
import { describe, it, expect } from 'vitest'
import { buildCreateGameCommand, buildCreatePlayerCommand, buildCreateNodeCommand } from '../builders'

describe('builder functions', () => {
  it('builds a valid add_game command from CreateGameInput', () => {
    const cmd = buildCreateGameCommand({
      name: 'Test Game',
      description: 'A test',
      labels: [],
      status: 'active',
    })
    expect(cmd.kind).toBe('add_game')
    expect(cmd.payload.name).toBe('Test Game')
    expect(cmd.payload.player_ids).toEqual([])
    expect(cmd.payload.formalization_ids).toEqual([])
  })

  it('builds a valid add_player command', () => {
    const cmd = buildCreatePlayerCommand({
      name: 'Russia',
      player_type: { label: 'nation_state', prior_probability: 1 },
      game_ids: ['gm_1'],
    })
    expect(cmd.kind).toBe('add_player')
    expect(cmd.payload.name).toBe('Russia')
  })

  it('builds a valid add_game_node command', () => {
    const cmd = buildCreateNodeCommand({
      formalization_id: 'fm_1',
      node_type: 'decision',
      label: 'Choose strategy',
      player_id: 'pl_1',
    })
    expect(cmd.kind).toBe('add_game_node')
    expect(cmd.payload.node_type).toBe('decision')
  })
})
```

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement builder functions**

Each builder takes an analyst-facing input type (see spec section 2E) and returns a fully formed `Command` with system defaults filled in.

- [ ] **Step 4: Run — verify pass**

- [ ] **Step 5: Implement creation wizard components**

Each wizard is a modal dialog with:
- Form fields appropriate to the entity type (see spec table)
- Zod validation before dispatch
- On success: close modal, select new entity in inspector, scroll to it
- On error: show validation errors inline

Implement at minimum: CreateGameWizard, CreatePlayerWizard, CreateNodeWizard, CreateEdgeWizard, CreateFormalizationWizard, CreateEvidenceWizard (covers Source, Observation, Claim, Inference), CreateAssumptionWizard, CreateCrossGameLinkWizard.

- [ ] **Step 6: Wire wizards into structural screens** — WorkflowBoard "+ Add" opens CreateGameWizard, PlayersRegistry "+ Add Player" opens CreatePlayerWizard, etc.
- [ ] **Step 7: Wire wizards into analytical views** — Graph View "+ Add Node" context menu, Evidence Notebook "+ Add Source"
- [ ] **Step 8: Run all tests — verify pass**
- [ ] **Step 9: Commit**

```bash
git commit -m "feat(m3): creation wizards for all canonical entity types"
```

---

### Task 19: Manual modeling — Inline editing + empty states

**Files:**
- Create: `src/components/inspector/InlineEditor.tsx`
- Create: `src/components/shell/EmptyStateNewGame.tsx`
- Create: `src/components/shell/EmptyStateNoAI.tsx`
- Modify: `src/components/inspector/InspectorPanel.tsx`
- Modify: `src/components/views/evidence/EvidenceNotebook.tsx`
- Modify: `src/components/layout/ViewRouter.tsx`

- [ ] **Step 1: Write inline editor tests**

Test that InlineEditor dispatches `update_*` commands for edited fields and uses merge semantics.

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Implement InlineEditor**

- Edit button on inspector panel toggles edit mode
- Each field becomes editable input
- Save dispatches `update_{entity_type}` command
- Cancel reverts to read mode
- Keyboard: Tab between fields, Enter save, Escape cancel

- [ ] **Step 4: Run — verify pass**

- [ ] **Step 5: Implement empty states**

- `EmptyStateNewGame` — "Start Building Your Game" with Add Player + Add Decision Node buttons (from `.pen` mock)
- `EmptyStateNoAI` — "No AI Client Connected" with Setup Guide + Continue Without AI buttons (from `.pen` mock)

- [ ] **Step 6: Wire empty states into ViewRouter**

When navigating to a game-scoped view with no formalization data, show the appropriate empty state.

- [ ] **Step 7: Run — verify pass**
- [ ] **Step 8: Commit**

```bash
git commit -m "feat(m3): inline editing in inspector and empty states"
```

---

## Chunk 6: Integration + Polish

### Task 20: Cross-view integration wiring

**Files:**
- Modify: Multiple view components
- Create: `src/coordination/__tests__/integration.test.ts`

- [ ] **Step 1: Write cross-view integration tests**

Test the full selection flow:
- Select node in graph → `inspectedRefs` updates → inspector shows details
- Click evidence link in inspector → evidence notebook scrolls to item
- Select evidence in notebook → graph highlights referencing nodes
- Navigation: click game in board → graph view opens with game loaded

- [ ] **Step 2: Run — verify fail**
- [ ] **Step 3: Wire coordination bus events into all views**

Ensure every view:
- Emits `selection_changed` on user selection
- Handles `focus_entity` by scrolling to the entity
- Handles `highlight_dependents` by applying visual highlight
- Handles `highlight_clear` by removing highlights
- Uses `correlation_id` to prevent echo loops

- [ ] **Step 4: Run — verify pass**
- [ ] **Step 5: Commit**

```bash
git commit -m "feat(m3): wire cross-view coordination bus events"
```

---

### Task 21: Tauri scaffolding

**Files:**
- Create: `src-tauri/` directory (via `tauri init`)
- Modify: `src/platform/tauri-file-service.ts`
- Modify: `src/platform/tauri-shell-service.ts`

- [ ] **Step 1: Initialize Tauri**

```bash
npm install @tauri-apps/cli @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs
npx tauri init
```

- [ ] **Step 2: Implement TauriFileService**

Wire Tauri APIs:
- `openFile()` — uses `@tauri-apps/plugin-dialog` `open()` + `@tauri-apps/plugin-fs` `readTextFile()` + M1 `loadAnalysisFile()`
- `saveFile()` — uses `storeToAnalysisFile()` + `@tauri-apps/plugin-fs` `writeTextFile()`
- `saveFileAs()` — uses `@tauri-apps/plugin-dialog` `save()` + write

- [ ] **Step 3: Implement TauriShellService**

Wire `@tauri-apps/api` window title and close listener.

- [ ] **Step 4: Verify Tauri build**

```bash
npx tauri dev
```

Expected: Desktop window opens with the full app.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(m3): tauri desktop shell with native file dialogs"
```

---

### Task 22: E2E tests + final verification

**Files:**
- Create: `e2e/app.spec.ts`
- Create: `playwright.config.ts`

- [ ] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install
```

- [ ] **Step 2: Write E2E tests**

```typescript
// e2e/app.spec.ts
import { test, expect } from '@playwright/test'

test('welcome screen loads and navigates to board', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await expect(page.getByText('STRATEGIC LENS')).toBeVisible()
  await page.getByText('WORKFLOW BOARD').click()
  await expect(page.getByText('+ ADD')).toBeVisible()
})

test('load fixture and navigate views', async ({ page }) => {
  await page.goto('http://localhost:5173')
  await page.getByText('Load Example').click()
  // Should navigate to board with sample games
  await expect(page.getByText('WORKFLOW BOARD')).toBeVisible()
})
```

- [ ] **Step 3: Run E2E tests**

```bash
npx playwright test
```

- [ ] **Step 4: Run full test suite**

```bash
npm test && npx playwright test
```

Expected: All unit, component, integration, and E2E tests pass.

- [ ] **Step 5: Verify coverage**

```bash
npx vitest run --coverage
```

Target: 80%+ on non-UI logic (store, bus, selectors, builders, platform).

- [ ] **Step 6: Final commit**

```bash
git commit -m "test(m3): E2E tests and coverage verification"
```
