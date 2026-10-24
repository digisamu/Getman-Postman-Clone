# Getman

<<<<<<< HEAD
![User Guide](public/icon.png)
Getman is an offline-first desktop API testing tool inspired by Postman and Insomnia. It is built for backend developers, students, QA engineers, and DevOps engineers who want a fast local client without accounts, sync, telemetry, subscriptions, analytics, or a database.
=======
![Getman](build/icon.png)
>>>>>>> 71bdbb26 (just kill me)

Getman is an offline-first desktop API client in the spirit of Postman and Insomnia, without accounts, sync, telemetry or subscriptions. Everything you create stays in one JSON file on your machine.

## Download

Get the latest installer from the **[Releases page](https://github.com/digisamu/Getman-Postman-Clone/releases/latest)**.

| System | File |
| --- | --- |
| macOS (Apple Silicon: M1 and later) | `Getman-<version>-mac-arm64.dmg` |
| macOS (Intel) | `Getman-<version>-mac-x64.dmg` |
| Windows 10/11 | `Getman-<version>-windows-setup.exe` (or the `.msi`) |
| Linux | `Getman-<version>-linux-x86_64.AppImage`, or the `.deb` for Debian/Ubuntu |

The builds are not signed with a paid developer certificate, so the first launch needs one extra step:

- **macOS**: drag Getman into Applications and open it. When macOS blocks it, go to **System Settings → Privacy & Security** and click **Open Anyway**.
- **Windows**: on the SmartScreen prompt click **More info → Run anyway**.
- **Linux**: make the AppImage executable (`chmod +x Getman-*.AppImage`) and run it.

## Features

- Request tabs with unsaved-change tracking; `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`
- URL bar with `{{variable}}` highlighting (green when defined, red when missing) and two-way sync with the query params table
- Paste a cURL command into the URL bar to import it
- Auth: Bearer token and Basic auth
- Bodies: JSON (with live validation that understands `{{variables}}`), text, multipart form data, `x-www-form-urlencoded`
- Code editor with syntax highlighting, folding, bracket matching and search (CodeMirror 6)
- Response viewer: colour-coded status, time, size, Pretty / Raw / Preview (HTML and images), headers, parsed cookies, copy, save to file
- Collections → folders → requests, with rename, duplicate, delete, search, and Postman v2.1 import/export
- Environments manager, history grouped by day, settings for timeout, SSL verification, redirects and layout
- Developer tools: JWT decoder, Base64, JSON formatter, UUID v4, timestamp converter
- Themes: Postman, Dark, Light and Sydney

Requests are sent from the Electron main process with a pooled keep-alive HTTP client, so they are not limited by browser CORS rules and repeat calls skip the TLS handshake.

## Keyboard shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Send request | `⌘ Enter` | `Ctrl Enter` |
| Cancel request | `Esc` | `Esc` |
| New tab | `⌘ T` | `Ctrl T` |
| Close tab | `⌘ W` | `Ctrl W` |
| Next / previous tab | `Ctrl Tab` / `Ctrl Shift Tab` | same |
| Save / Save as | `⌘ S` / `⌘ ⇧ S` | `Ctrl S` / `Ctrl Shift S` |
| Import collection | `⌘ O` | `Ctrl O` |
| Settings | `⌘ ,` | `Ctrl ,` |

## Development

Requirements: Node.js 20 or newer and npm. No Rust toolchain is needed.

```bash
npm install
```

```bash
npm run dev
```

`npm run dev` starts Vite and Electron together and restarts Electron when files in `electron/` change. To work on the UI in a plain browser instead, run `npm run dev:web` and open http://localhost:1420 (requests go through a dev-server proxy that uses the same HTTP engine).

```bash
npm test
```

```bash
npm run build
```

`npm run build` type-checks, builds the renderer into `dist/` and bundles the main and preload scripts into `dist-electron/`.

## Packaging

```bash
npm run dist:mac
```

```bash
npm run dist:win
```

```bash
npm run dist:linux
```

Installers are written to `release/`: `.dmg`/`.zip` for Apple Silicon and Intel on macOS, `.exe` (NSIS) and `.msi` on Windows, `.AppImage`/`.deb` on Linux. Build each platform on that platform. macOS builds are ad-hoc signed, not notarized.

### Publishing a release

Bump `version` in `package.json`, commit, then push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

The [Release workflow](.github/workflows/release.yml) builds installers on macOS, Windows and Linux and publishes them as a GitHub Release for that tag.

## Where data is stored

| OS | Path |
| --- | --- |
| macOS | `~/Library/Application Support/Getman/workspace.json` |
| Windows | `%APPDATA%\Getman\workspace.json` |
| Linux | `~/.config/Getman/workspace.json` |

On first launch Getman imports the workspace written by the older Tauri build (`com.getman.desktop/workspace.json`), so existing collections, environments and history carry over. Set `GETMAN_USER_DATA=/some/folder` to run with a separate profile.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
