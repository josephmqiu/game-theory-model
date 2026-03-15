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
  if (!store) {
    throw new Error('useAppStore must be used within StoreProvider')
  }
  return useStore(store, selector)
}
