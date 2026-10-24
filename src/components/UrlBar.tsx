import { ChevronDown, Save, Send, X } from "lucide-react";
import { useMemo, useRef, type ReactNode } from "react";
import { isMac } from "../lib/bridge";
import { looksLikeCurl, parseCurl } from "../lib/curl";
import { METHODS } from "../lib/factory";
import { VARIABLE_PATTERN, type VariableMap } from "../lib/variables";
import { cancelTab, sendTab, useTabResponse } from "../store/responses";
import { useUi } from "../store/ui";
import { useWorkspace } from "../store/workspace";
import type { RequestTab } from "../types/api";
import { MenuList, Popover, usePopover } from "./ui/Popover";

function highlightVariables(url: string, variables: VariableMap) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of url.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push(url.slice(last, index));
    parts.push(
      <span key={index} className={variables.has(match[1]) ? "var-ok" : "var-missing"}>
        {match[0]}
      </span>
    );
    last = index + match[0].length;
  }
  parts.push(url.slice(last) + " ");
  return parts;
}

export function saveActiveTab(tabId: string, closeAfter = false) {
  const saved = useWorkspace.getState().saveTab(tabId);
  if (saved) {
    useUi.getState().toast("Request saved");
    if (closeAfter) useWorkspace.getState().closeTab(tabId);
  } else {
    useUi.getState().openDialog({ kind: "save", tabId, closeAfter });
  }
}

export function UrlBar({ tab, variables }: { tab: RequestTab; variables: VariableMap }) {
  const { request } = tab;
  const response = useTabResponse(tab.id);
  const loading = response?.status === "loading";
  const methodMenu = usePopover();
  const saveMenu = usePopover();
  const mirror = useRef<HTMLDivElement>(null);
  const highlighted = useMemo(() => highlightVariables(request.url, variables), [request.url, variables]);
  const mod = isMac ? "⌘" : "Ctrl+";

  function onPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!looksLikeCurl(text)) return;
    event.preventDefault();
    try {
      const imported = parseCurl(text);
      useWorkspace.getState().updateRequest(tab.id, (current) => ({ ...imported, id: current.id, name: current.url ? current.name : imported.name }));
      useUi.getState().toast("Imported cURL command");
    } catch {
      useUi.getState().toast("Could not read that cURL command", "danger");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex h-9 min-w-0 flex-1 items-stretch rounded border border-line bg-field transition-colors focus-within:border-accent hover:border-line-strong">
        <button
          className="flex w-[104px] shrink-0 items-center justify-between rounded-l border-r border-line pl-3 pr-2 hover:bg-hover"
          onClick={(event) => methodMenu.toggle(event.currentTarget)}
          aria-label="HTTP method"
        >
          <span className={`method method-${request.method} text-xs`}>{request.method}</span>
          <ChevronDown size={14} className="text-faint" />
        </button>
        <Popover anchor={methodMenu.anchor} open={methodMenu.open} onClose={methodMenu.close} className="menu min-w-[150px]">
          {METHODS.map((method) => (
            <button
              key={method}
              className="menu-item"
              onClick={() => {
                methodMenu.close();
                useWorkspace.getState().updateRequest(tab.id, { method });
              }}
            >
              <span className={`method method-${method} text-xs`}>{method}</span>
            </button>
          ))}
        </Popover>

        <div className="relative min-w-0 flex-1">
          <div ref={mirror} aria-hidden className="url-mirror pointer-events-none absolute inset-0 overflow-hidden whitespace-pre px-3 font-mono text-[12.5px] leading-[34px] text-fg">
            {highlighted}
          </div>
          <input
            className="url-input absolute inset-0 w-full bg-transparent px-3 font-mono text-[12.5px] outline-none"
            value={request.url}
            spellCheck={false}
            placeholder="Enter a URL or paste a cURL command"
            onChange={(event) => useWorkspace.getState().setUrl(tab.id, event.target.value)}
            onPaste={onPaste}
            onScroll={(event) => mirror.current && (mirror.current.scrollLeft = event.currentTarget.scrollLeft)}
            onSelect={(event) => mirror.current && (mirror.current.scrollLeft = event.currentTarget.scrollLeft)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void sendTab(tab.id);
            }}
            aria-label="Request URL"
          />
        </div>
      </div>

      {loading ? (
        <button className="btn h-9 w-[92px]" onClick={() => cancelTab(tab.id)} title="Cancel request (Esc)">
          <X size={15} />
          Cancel
        </button>
      ) : (
        <button className="send-button btn-primary h-9 w-[92px]" onClick={() => void sendTab(tab.id)} title={`Send (${mod}Enter)`}>
          <Send size={14} />
          Send
        </button>
      )}

      <div className="flex h-9 items-stretch">
        <button className="btn h-9 rounded-r-none border-r-0" onClick={() => saveActiveTab(tab.id)} title={`Save (${mod}S)`}>
          <Save size={14} />
          Save
        </button>
        <button className="btn h-9 w-7 rounded-l-none px-0" onClick={(event) => saveMenu.toggle(event.currentTarget)} aria-label="More save options">
          <ChevronDown size={14} />
        </button>
        <Popover anchor={saveMenu.anchor} open={saveMenu.open} onClose={saveMenu.close} align="end">
          <MenuList
            onClose={saveMenu.close}
            items={[{ label: "Save as…", onSelect: () => useUi.getState().openDialog({ kind: "save", tabId: tab.id }) }]}
          />
        </Popover>
      </div>
    </div>
  );
}
