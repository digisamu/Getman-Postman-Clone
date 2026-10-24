import { Copy, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { prepareRequest, methodSendsBody } from "../lib/request";
import { SNIPPET_LANGUAGES, generateSnippet, type SnippetLanguage } from "../lib/snippets";
import { VARIABLE_PATTERN, type VariableMap } from "../lib/variables";
import { copyText } from "../store/ui";
import { useWorkspace } from "../store/workspace";
import type { ApiRequest, BodyType, RequestTab } from "../types/api";
import { CodeEditor, type EditorLanguage } from "./CodeEditor";
import { KeyValueTable } from "./KeyValueTable";
import { UrlBar } from "./UrlBar";

type Section = "params" | "auth" | "headers" | "body" | "code";

const COMMON_HEADERS = [
  "Accept",
  "Accept-Encoding",
  "Accept-Language",
  "Authorization",
  "Cache-Control",
  "Content-Type",
  "Cookie",
  "If-Match",
  "If-None-Match",
  "Origin",
  "Referer",
  "User-Agent",
  "X-API-Key",
  "X-Request-ID"
];

const BODY_TYPES: Array<{ id: BodyType; label: string }> = [
  { id: "none", label: "None" },
  { id: "json", label: "JSON" },
  { id: "raw", label: "Text" },
  { id: "form-data", label: "Form data" },
  { id: "urlencoded", label: "URL-encoded" }
];

const SNIPPET_EDITOR_LANGUAGE: Record<SnippetLanguage, EditorLanguage> = {
  curl: "shell",
  javascript: "javascript",
  python: "python",
  java: "java"
};

/** Validates JSON with {{variables}} replaced by a neutral value, so templated bodies are not flagged. */
function jsonError(content: string) {
  if (!content.trim()) return null;
  try {
    JSON.parse(content.replace(VARIABLE_PATTERN, "0"));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message.replace(/^JSON\.parse: /, "") : "Invalid JSON";
  }
}

export function RequestPane({ tab, variables, environmentKey }: { tab: RequestTab; variables: VariableMap; environmentKey: string }) {
  const [section, setSection] = useState<Section>("params");
  const { request } = tab;
  const update = (patch: Partial<ApiRequest> | ((request: ApiRequest) => ApiRequest)) => useWorkspace.getState().updateRequest(tab.id, patch);

  const counts: Partial<Record<Section, number>> = {
    params: request.queryParams.filter((row) => row.enabled && row.key).length,
    headers: request.headers.filter((row) => row.enabled && row.key).length,
    body: request.body.type !== "none" ? -1 : 0,
    auth: request.auth.type !== "none" ? -1 : 0
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <nav className="flex shrink-0 items-center gap-4 border-b border-line px-4" role="tablist">
        {(
          [
            ["params", "Params"],
            ["auth", "Auth"],
            ["headers", "Headers"],
            ["body", "Body"],
            ["code", "Code"]
          ] as Array<[Section, string]>
        ).map(([id, label]) => (
          <button key={id} role="tab" className="subtab" data-active={section === id} onClick={() => setSection(id)}>
            {label}
            {(counts[id] ?? 0) > 0 && <span className="count">{counts[id]}</span>}
            {counts[id] === -1 && <span className="h-1.5 w-1.5 rounded-full bg-success" />}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-auto">
        {section === "params" && (
          <div className="p-4">
            <KeyValueTable title="Query parameters" rows={request.queryParams} onChange={(rows) => useWorkspace.getState().setQueryParams(tab.id, rows)} keyPlaceholder="Add parameter" />
          </div>
        )}
        {section === "headers" && (
          <div className="p-4">
            <KeyValueTable title="Request headers" rows={request.headers} onChange={(headers) => update({ headers })} keyPlaceholder="Add header" keySuggestions={COMMON_HEADERS} />
          </div>
        )}
        {section === "auth" && <AuthSection request={request} update={update} />}
        {section === "body" && <BodySection request={request} update={update} variables={variables} environmentKey={environmentKey} />}
        {section === "code" && <CodeSection request={request} variables={variables} />}
      </div>
    </div>
  );
}

/** Request name and URL bar, spanning the full width above the request/response split. */
export function RequestHeader({ tab, variables }: { tab: RequestTab; variables: VariableMap }) {
  return (
    <div className="shrink-0 border-b border-line pb-3">
      <RequestTitle tab={tab} />
      <div className="px-4">
        <UrlBar tab={tab} variables={variables} />
      </div>
    </div>
  );
}

function RequestTitle({ tab }: { tab: RequestTab }) {
  const location = useWorkspace((state) => {
    if (!tab.source) return null;
    const collection = state.collections.find((item) => item.id === tab.source!.collectionId);
    const folder = collection?.folders.find((item) => item.id === tab.source!.folderId);
    return collection && folder ? `${collection.name} / ${folder.name}` : null;
  });
  return (
    <div className="flex h-11 shrink-0 items-center gap-1.5 px-4 text-sm">
      {location && <span className="max-w-[45%] shrink-0 truncate text-muted">{location} /</span>}
      <input
        className="h-7 min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 font-medium hover:border-line focus:border-accent"
        value={tab.request.name}
        spellCheck={false}
        aria-label="Request name"
        onChange={(event) => useWorkspace.getState().updateRequest(tab.id, { name: event.target.value })}
      />
      {!tab.source && <span className="shrink-0 text-xs text-faint">Not saved to a collection</span>}
      {tab.source && tab.dirty && <span className="shrink-0 text-xs text-faint">Unsaved changes</span>}
    </div>
  );
}

type SectionProps = { request: ApiRequest; update: (patch: Partial<ApiRequest>) => void };

function AuthSection({ request, update }: SectionProps) {
  const { auth } = request;
  const setAuth = (patch: Partial<ApiRequest["auth"]>) => update({ auth: { ...auth, ...patch } });
  return (
    <div className="max-w-xl space-y-4 p-4">
      <div className="seg">
        {(["none", "bearer", "basic"] as const).map((type) => (
          <button key={type} className="seg-item" data-active={auth.type === type} onClick={() => setAuth({ type })}>
            {type === "none" ? "No auth" : type === "bearer" ? "Bearer token" : "Basic auth"}
          </button>
        ))}
      </div>
      {auth.type === "none" && <p className="text-sm text-muted">This request does not send credentials. Pick a method above, or add an Authorization header yourself.</p>}
      {auth.type === "bearer" && (
        <label className="block">
          <span className="field-label">Token</span>
          <input className="input font-mono text-xs" value={auth.token} spellCheck={false} placeholder="{{TOKEN}}" onChange={(event) => setAuth({ token: event.target.value })} />
          <span className="mt-1.5 block text-xs text-faint">Sent as Authorization: Bearer &lt;token&gt;. Variables like {"{{TOKEN}}"} are resolved.</span>
        </label>
      )}
      {auth.type === "basic" && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="field-label">Username</span>
            <input className="input" value={auth.username} spellCheck={false} onChange={(event) => setAuth({ username: event.target.value })} />
          </label>
          <label className="block">
            <span className="field-label">Password</span>
            <input className="input" type="password" value={auth.password} onChange={(event) => setAuth({ password: event.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}

function BodySection({ request, update, variables, environmentKey }: SectionProps & { variables: VariableMap; environmentKey: string }) {
  const { body } = request;
  const error = useMemo(() => (body.type === "json" ? jsonError(body.content) : null), [body.type, body.content]);
  const setBody = (patch: Partial<ApiRequest["body"]>) => update({ body: { ...body, ...patch } });

  function beautify() {
    try {
      setBody({ content: JSON.stringify(JSON.parse(body.content), null, 2) });
    } catch {
      // Bodies with unquoted {{variables}} cannot be re-serialised; leave them as typed.
    }
  }

  return (
    <div className="flex h-full min-h-[240px] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="seg">
          {BODY_TYPES.map((type) => (
            <button key={type.id} className="seg-item" data-active={body.type === type.id} onClick={() => setBody({ type: type.id })}>
              {type.label}
            </button>
          ))}
        </div>
        {body.type === "json" && (
          <button className="btn-ghost text-xs" onClick={beautify} disabled={Boolean(error)} title="Format JSON">
            <Sparkles size={13} />
            Beautify
          </button>
        )}
      </div>

      {!methodSendsBody(request.method) && body.type !== "none" && (
        <div className="mx-4 mb-3 rounded border border-line bg-hover px-3 py-2 text-xs text-muted">{request.method} requests are sent without a body. Switch the method to send it.</div>
      )}

      {body.type === "none" && <div className="px-4 text-sm text-muted">This request has no body.</div>}

      {(body.type === "json" || body.type === "raw") && (
        <div className="mx-4 mb-4 flex min-h-[200px] flex-1 flex-col overflow-hidden rounded border border-line bg-field">
          <div className="min-h-0 flex-1">
            <CodeEditor
              key={environmentKey}
              value={body.content}
              language={body.type === "json" ? "json" : "text"}
              onChange={(content) => setBody({ content })}
              placeholder={body.type === "json" ? '{\n  "name": "value"\n}' : "Request body"}
              isVariableDefined={(name) => variables.has(name)}
            />
          </div>
          {error && <div className="shrink-0 border-t border-line bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] px-3 py-1.5 text-xs text-warning">{error}</div>}
        </div>
      )}

      {(body.type === "form-data" || body.type === "urlencoded") && (
        <div className="px-4 pb-4">
          <KeyValueTable
            title={body.type === "form-data" ? "Sent as multipart/form-data" : "Sent as application/x-www-form-urlencoded"}
            rows={body.fields}
            onChange={(fields) => setBody({ fields })}
            keyPlaceholder="Add field"
          />
        </div>
      )}
    </div>
  );
}

function CodeSection({ request, variables }: { request: ApiRequest; variables: VariableMap }) {
  const [language, setLanguage] = useState<SnippetLanguage>("curl");
  const snippet = useMemo(() => {
    try {
      return { code: generateSnippet(language, prepareRequest(request, variables)), error: null };
    } catch (error) {
      return { code: "", error: error instanceof Error ? error.message : "Could not generate code" };
    }
  }, [language, request, variables]);

  return (
    <div className="flex h-full min-h-[240px] flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="seg">
          {SNIPPET_LANGUAGES.map((item) => (
            <button key={item.id} className="seg-item" data-active={language === item.id} onClick={() => setLanguage(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <button className="btn-ghost text-xs" disabled={!snippet.code} onClick={() => copyText(snippet.code, "Code copied")}>
          <Copy size={13} />
          Copy
        </button>
      </div>
      {snippet.error ? (
        <p className="px-4 text-sm text-muted">{snippet.error}</p>
      ) : (
        <div className="mx-4 mb-4 min-h-[200px] flex-1 overflow-hidden rounded border border-line bg-field">
          <CodeEditor value={snippet.code} language={SNIPPET_EDITOR_LANGUAGE[language]} readOnly />
        </div>
      )}
    </div>
  );
}
