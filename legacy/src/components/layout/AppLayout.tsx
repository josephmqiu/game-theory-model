import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { StatusBar } from './StatusBar'
import { ViewRouter } from './ViewRouter'

export function AppLayout(): ReactNode {
  return (
    <div className="flex h-screen bg-bg-page text-text-primary font-mono overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto">
          <ViewRouter />
        </main>
        <StatusBar />
      </div>
    </div>
  )
}
