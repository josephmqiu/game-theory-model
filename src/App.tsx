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
