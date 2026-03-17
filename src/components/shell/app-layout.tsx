/**
 * App layout — main shell with top bar, sidebar, content area, docked chat panel.
 */

import { useCallback, useEffect, useState } from "react";
import { Outlet } from "@tanstack/react-router";
import { TopBar } from "./top-bar";
import { Sidebar } from "./sidebar";
import { StatusBar } from "@/components/shell/status-bar";
import { useUiStore, hydrateUiStore } from "@/stores/ui-store";
import { hydrateAgentSettingsStore } from "@/stores/agent-settings-store";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useElectronMenu } from "@/hooks/use-electron-menu";
import { useMcpSync } from "@/hooks/use-mcp-sync";
import { setupFileEventListeners } from "@/hooks/file-operations";
import { refreshIntegrationStatuses } from "@/services/integration-status";
import { AiChatPanel } from "@/components/panels/ai-chat-panel";
import { RecoveryView } from "@/components/shell/recovery-view";
import { useRecoveryStore } from "@/stores/recovery-store";

export function AppLayout() {
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let active = true;
    const cleanup = setupFileEventListeners();

    void (async () => {
      try {
        await Promise.all([hydrateUiStore(), hydrateAgentSettingsStore()]);
        await refreshIntegrationStatuses();
      } catch {
        // Boot continues even if local readiness refresh fails.
      } finally {
        if (active) {
          setBootstrapped(true);
        }
      }
    })();

    return () => {
      active = false;
      cleanup();
    };
  }, []);

  if (!bootstrapped) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading workspace...
      </div>
    );
  }

  return <BootstrappedAppLayout />;
}

function BootstrappedAppLayout() {
  const chatPanelWidth = useUiStore((s) => s.chatPanelWidth);
  const setChatPanelWidth = useUiStore((s) => s.setChatPanelWidth);
  const recoveryActive = useRecoveryStore((s) => s.active);

  useKeyboardShortcuts();
  useElectronMenu();
  useMcpSync(true);

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

  if (recoveryActive) {
    return (
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TopBar />
        <RecoveryView />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TopBar />

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

      <StatusBar />
    </div>
  );
}
