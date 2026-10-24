import { Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cancelTab, useResponses } from "../store/responses";
import { confirmAction } from "../store/ui";
import { useWorkspace } from "../store/workspace";

export function requestCloseTab(tabId: string) {
  const tab = useWorkspace.getState().tabs.find((item) => item.id === tabId);
  if (!tab) return;
  const close = () => {
    cancelTab(tabId);
    useResponses.getState().setState(tabId, undefined);
    useWorkspace.getState().closeTab(tabId);
  };
  // Untouched scratch tabs close silently; anything with unsaved work asks first.
  const hasWork = tab.dirty && (tab.source !== null || tab.request.url.trim() !== "");
  if (!hasWork) return close();
  confirmAction({
    title: "Unsaved changes",
    message: `“${tab.request.name}” has changes that are not saved to a collection. Close it anyway?`,
    confirmLabel: "Close without saving",
    danger: true,
    onConfirm: close
  });
}

export function TabBar() {
  const tabs = useWorkspace((state) => state.tabs);
  const activeTabId = useWorkspace((state) => state.activeTabId);
  const loading = useResponses((state) => state.byTab);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    strip.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeTabId]);

  return (
    <div className="flex h-9 shrink-0 items-stretch border-b border-line bg-sidebar">
      <div
        ref={strip}
        className="flex min-w-0 items-stretch overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onWheel={(event) => {
          if (strip.current && Math.abs(event.deltaY) > Math.abs(event.deltaX)) strip.current.scrollLeft += event.deltaY;
        }}
        role="tablist"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const isLoading = loading[tab.id]?.status === "loading";
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-active={active}
              className={`group relative flex w-[180px] min-w-[120px] shrink-0 items-center gap-2 border-r border-line pl-3 pr-1.5 text-sm ${
                active ? "bg-bg text-fg" : "text-muted hover:bg-hover hover:text-fg"
              }`}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  requestCloseTab(tab.id);
                }
              }}
              onClick={() => useWorkspace.getState().setActiveTab(tab.id)}
              title={tab.request.url || tab.request.name}
            >
              {active && <span className="absolute inset-x-0 top-0 h-0.5 bg-accent" />}
              {active && <span className="absolute inset-x-0 -bottom-px h-px bg-bg" />}
              <span className={`method method-${tab.request.method} shrink-0 text-[10px]`}>{tab.request.method === "DELETE" ? "DEL" : tab.request.method === "OPTIONS" ? "OPT" : tab.request.method}</span>
              <span className={`min-w-0 flex-1 truncate ${tab.source ? "" : "italic"}`}>{tab.request.name}</span>
              <span className="relative grid h-5 w-5 shrink-0 place-items-center">
                {isLoading ? (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                ) : (
                  tab.dirty && tab.source && <span className="h-2 w-2 rounded-full bg-muted group-hover:hidden" />
                )}
                <button
                  className={`icon-btn absolute inset-0 h-5 w-5 ${active ? "" : "opacity-0"} ${tab.dirty && tab.source && !isLoading ? "opacity-0" : ""} group-hover:opacity-100`}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestCloseTab(tab.id);
                  }}
                  aria-label={`Close ${tab.request.name}`}
                >
                  <X size={13} />
                </button>
              </span>
            </div>
          );
        })}
      </div>
      <button className="grid w-9 shrink-0 place-items-center text-muted hover:bg-hover hover:text-fg" onClick={() => useWorkspace.getState().openNewTab()} title="New request">
        <Plus size={15} />
      </button>
      <div className="flex-1" onDoubleClick={() => useWorkspace.getState().openNewTab()} />
    </div>
  );
}

