/**
 * App layout — main shell with top bar, sidebar, content area, inspector.
 */

import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { InspectorPanel } from "./inspector-panel";
import { StatusBar } from "@/components/shell/status-bar";
import { useUiStore } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { useMcpSync } from "@/hooks/use-mcp-sync";
import { setupFileEventListeners } from "@/hooks/file-operations";

export function AppLayout() {
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);

  useKeyboardShortcuts();
  useElectronMenu();
  useMcpSync();

  useEffect(() => {
    return setupFileEventListeners();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>

        {aiPanelOpen && (
          <aside className="w-80 border-l border-border shrink-0 overflow-y-auto flex flex-col">
            <div className="p-4 flex-1">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                AI Chat
              </h3>
              <p className="text-sm text-muted-foreground">
                AI chat panel — connect an AI provider to begin analysis.
              </p>
            </div>
          </aside>
        )}

        <InspectorPanel />
      </div>

      <StatusBar />
    </div>
  );
}
