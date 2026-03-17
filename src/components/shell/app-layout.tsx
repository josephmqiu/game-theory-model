/**
 * App layout — main shell with top bar, sidebar, content area, inspector.
 */

import { useEffect } from "react";
import { Outlet } from "@tanstack/react-router";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { InspectorPanel } from "./inspector-panel";
import { StatusBar } from "@/components/shell/status-bar";
import { useUiStore, hydrateUiStore } from "@/stores/ui-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { useMcpSync } from "@/hooks/use-mcp-sync";
import { setupFileEventListeners } from "@/hooks/file-operations";
import {
  AiChatMinimizedBar,
  AiChatPanel,
} from "@/components/panels/ai-chat-panel";

export function AppLayout() {
  const aiPanelOpen = useUiStore((s) => s.aiPanelOpen);
  const aiPanelMinimized = useUiStore((s) => s.aiPanelMinimized);
  const setAiPanelOpen = useUiStore((s) => s.setAiPanelOpen);
  const toggleAiPanelMinimized = useUiStore((s) => s.toggleAiPanelMinimized);

  useKeyboardShortcuts();
  useElectronMenu();
  useMcpSync();

  useEffect(() => {
    void hydrateUiStore();
    return setupFileEventListeners();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="relative flex-1 overflow-hidden">
          <main className="h-full overflow-y-auto p-6">
            <Outlet />
          </main>

          {aiPanelOpen && (
            <div className="pointer-events-none absolute inset-0 z-20">
              <div className="pointer-events-auto absolute bottom-4 right-4 flex max-h-[calc(100%-2rem)] flex-col items-end gap-3">
                {aiPanelMinimized ? (
                  <AiChatMinimizedBar
                    onExpand={toggleAiPanelMinimized}
                    onClose={() => setAiPanelOpen(false)}
                  />
                ) : (
                  <div className="h-[32rem] w-[24rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
                    <AiChatPanel
                      onClose={() => setAiPanelOpen(false)}
                      onMinimize={toggleAiPanelMinimized}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <InspectorPanel />
      </div>

      <StatusBar />
    </div>
  );
}
