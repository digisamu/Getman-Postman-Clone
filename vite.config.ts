import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { cancelHttpRequest, executeHttpRequest } from "./electron/http";

// Browser-only preview (`npm run dev:web`): route requests through the same Node HTTP engine
// the desktop app uses, so testing in a browser is not blocked by CORS.
function browserProxy(): Plugin {
  return {
    name: "getman-browser-proxy",
    configureServer(server) {
      server.middlewares.use("/__getman__/send", async (req, res) => {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(Buffer.from(chunk));
        const { id, payload } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const result = await executeHttpRequest(id, payload);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(result));
      });
      server.middlewares.use("/__getman__/cancel", (req, res) => {
        const id = new URL(req.url ?? "", "http://localhost").searchParams.get("id");
        if (id) cancelHttpRequest(id);
        res.end();
      });
    }
  };
}

// Strict CSP for the packaged app. Left out in dev because Vite's HMR injects inline scripts.
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'";

function contentSecurityPolicy(): Plugin {
  return {
    name: "getman-csp",
    apply: "build",
    transformIndexHtml: (html) => html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`)
  };
}

export default defineConfig({
  base: "./",
  plugins: [react(), browserProxy(), contentSecurityPolicy()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true
  },
  build: {
    target: "chrome130",
    outDir: "dist",
    emptyOutDir: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1500
  }
});
