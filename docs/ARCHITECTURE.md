# Architecture

Getman is an Electron app with a React renderer. The renderer never touches the network or the file system directly; it asks the main process through a small, typed bridge.

```text
┌──────────────── Renderer (React, sandboxed) ────────────────┐
│ components/  UI                                             │
│ store/       zustand stores: workspace, responses, ui       │
│ lib/         pure logic: url, variables, request, snippets, │
│              curl, postman, migrate, format, tools          │
│ lib/bridge   window.getman, or a browser fallback           │
└────────────────────────────┬────────────────────────────────┘
                             │ contextBridge + IPC (src/shared/ipc.ts)
┌────────────────────────────┴────────────────────────────────┐
│ electron/preload.ts   exposes window.getman                 │
│ electron/main.ts      window, menu, workspace file, dialogs │
│ electron/http.ts      undici HTTP engine                    │
└─────────────────────────────────────────────────────────────┘
```

## Processes

- **Main** (`electron/main.ts`) creates a single hardened window (`contextIsolation`, `sandbox`, no Node integration, external links opened in the system browser), builds the native menu, and handles IPC: loading and saving the workspace, sending and cancelling requests, and file dialogs.
- **Preload** (`electron/preload.ts`) exposes the `GetmanBridge` defined in `src/shared/ipc.ts`.
- **Renderer** (`src/`) is a Vite + React 18 app. In production it is loaded from `dist/index.html` with a strict Content Security Policy.

Main and preload are bundled with esbuild (`scripts/build-electron.mjs`), so the packaged app ships no `node_modules`.

## HTTP

`electron/http.ts` sends requests with undici using two pooled keep-alive agents (one that verifies TLS certificates, one that does not). It supports cancellation, timeouts, redirect control and multipart bodies, and returns:

- status, status text, final URL, headers, `Set-Cookie` values
- total time and body size in bytes
- the body as text, or as base64 for binary content (used for image preview and saving)

Network errors are translated into plain explanations (DNS failure, connection refused, certificate problems, timeouts).

`src/lib/request.ts` turns an editable request into exactly what is sent: variables resolved, the scheme added when missing, auth headers applied, and a `Content-Type` added only when the user has not set one.

## State

- `store/workspace.ts` holds everything that is persisted: tabs, collections, environments, history, settings and layout.
- `store/responses.ts` keeps the last response per tab in memory only.
- `store/ui.ts` holds dialogs, toasts and panel visibility.

Components subscribe to the smallest slice they need, so typing in one field does not re-render the rest of the app.

The URL is the single source of truth for enabled query parameters; `lib/url.ts` keeps the params table in sync with it while keeping row ids stable and disabled rows in place.

## Persistence

`store/persistence.ts` loads the workspace once before the first render and then saves it 400 ms after the last change, only when persisted data changed. Pending changes are flushed synchronously when the window closes. The main process writes to a temporary file and renames it, so a crash never leaves a half-written workspace.

`lib/migrate.ts` normalises whatever is on disk, including the 0.1 Tauri format (single active request, params outside the URL, default `{}` JSON bodies) and partially corrupted files.

## Theming

All colours come from CSS variables defined per theme in `src/styles.css` and mapped into Tailwind (`tailwind.config.js`). Fonts are bundled locally with Fontsource: IBM Plex Sans for the interface, JetBrains Mono for code, and Bodoni Moda for the Sydney theme's display type.
