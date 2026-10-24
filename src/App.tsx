import { useEffect, useMemo, useRef } from "react";
import { DialogHost } from "./components/Dialogs";
import { RequestHeader, RequestPane } from "./components/RequestPane";
import { ResponsePane } from "./components/ResponsePane";
import { Sidebar, importCollectionFromFile } from "./components/Sidebar";
import { TabBar, requestCloseTab } from "./components/TabBar";
import { TitleBar } from "./components/TitleBar";
import { ToolsPanel } from "./components/ToolsPanel";
import { saveActiveTab } from "./components/UrlBar";
import { Splitter } from "./components/ui/Splitter";
import { bridge, isDesktop } from "./lib/bridge";
import { variableMap } from "./lib/variables";
import { cancelTab, sendTab } from "./store/responses";
import { useUi } from "./store/ui";
import type { MenuCommand } from "./shared/ipc";
import { useActiveEnvironment, useActiveTab, useWorkspace } from "./store/workspace";

function runCommand(command: MenuCommand) {
  const { activeTabId, openNewTab } = useWorkspace.getState();
  const ui = useUi.getState();
  if (ui.dialog && command !== "settings") return;
  switch (command) {
    case "new-tab":
      return openNewTab();
    case "close-tab":
      return requestCloseTab(activeTabId);
    case "save":
      return saveActiveTab(activeTabId);
    case "save-as":
      return ui.openDialog({ kind: "save", tabId: activeTabId });
    case "import":
      return void importCollectionFromFile();
    case "settings":
      return ui.openDialog({ kind: "settings" });
  }
}

function useShortcuts() {
  useEffect(() => {
    const unsubscribe = bridge.onMenuCommand(runCommand);
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const { activeTabId, tabs, setActiveTab } = useWorkspace.getState();
      if (useUi.getState().dialog) return;

      if (mod && event.key === "Enter") {
        event.preventDefault();
        void sendTab(activeTabId);
      } else if (event.key === "Escape" && !document.querySelector(".menu")) {
        cancelTab(activeTabId);
      } else if (event.ctrlKey && event.key === "Tab") {
        event.preventDefault();
        const index = tabs.findIndex((tab) => tab.id === activeTabId);
        const next = (index + (event.shiftKey ? -1 : 1) + tabs.length) % tabs.length;
        setActiveTab(tabs[next].id);
      } else if (!isDesktop && mod) {
        // In Electron these come from the native menu; in a browser preview handle them here.
        const commands: Record<string, MenuCommand> = { s: event.shiftKey ? "save-as" : "save", o: "import", ",": "settings" };
        const command = commands[event.key.toLowerCase()];
        if (command) {
          event.preventDefault();
          runCommand(command);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unsubscribe();
      window.removeEventListener("keydown", onKey);
    };
  }, []);
}

function useThemeSync() {
  const theme = useWorkspace((state) => state.theme);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const styles = getComputedStyle(document.documentElement);
    bridge.setTitleBarColors(styles.getPropertyValue("--sidebar").trim(), styles.getPropertyValue("--text-muted").trim());
  }, [theme]);
}

function Workbench() {
  const tab = useActiveTab();
  const environment = useActiveEnvironment();
  const layout = useWorkspace((state) => state.settings.layout);
  const ratio = useWorkspace((state) => state.splitRatio);
  const container = useRef<HTMLDivElement>(null);
  const variables = useMemo(() => variableMap(environment), [environment]);
  const horizontal = layout === "horizontal";

  const onDrag = (position: number) => {
    const rect = container.current?.getBoundingClientRect();
    if (!rect) return;
    const value = horizontal ? (position - rect.left) / rect.width : (position - rect.top) / rect.height;
    useWorkspace.getState().setSplitRatio(value);
  };

  return (
    <>
      <RequestHeader tab={tab} variables={variables} />
      <div ref={container} className={`flex min-h-0 flex-1 ${horizontal ? "flex-row" : "flex-col"}`}>
        <section className="min-h-0 min-w-0 overflow-hidden" style={{ flexBasis: `${ratio * 100}%`, flexGrow: 0, flexShrink: 0 }}>
          <RequestPane key={tab.id} tab={tab} variables={variables} environmentKey={environment?.id ?? "none"} />
        </section>
        <Splitter direction={horizontal ? "horizontal" : "vertical"} onDrag={onDrag} onReset={() => useWorkspace.getState().setSplitRatio(0.5)} />
        <section className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ResponsePane tabId={tab.id} />
        </section>
      </div>
    </>
  );
}

function Toasts() {
  const toasts = useUi((state) => state.toasts);
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`pop-in rounded-lg border border-line bg-elevated px-3.5 py-2 text-sm shadow-pop ${toast.tone === "danger" ? "text-danger" : "text-fg"}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const sidebarWidth = useWorkspace((state) => state.sidebarWidth);
  const toolsOpen = useUi((state) => state.toolsOpen);
  useShortcuts();
  useThemeSync();

  return (
    <div className="flex h-full flex-col">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <div className="shrink-0 border-r border-line" style={{ width: sidebarWidth }}>
          <Sidebar />
        </div>
        <Splitter direction="horizontal" onDrag={(x) => useWorkspace.getState().setSidebarWidth(x)} onReset={() => useWorkspace.getState().setSidebarWidth(272)} />
        <main className="flex min-w-0 flex-1 flex-col bg-bg">
          <TabBar />
          <Workbench />
        </main>
        {toolsOpen && <ToolsPanel />}
      </div>
      <DialogHost />
      <Toasts />
    </div>
  );
}
