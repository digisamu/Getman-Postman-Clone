// Starts Vite, rebuilds the Electron main/preload on change, and restarts Electron when they change.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "vite";
import { watchElectron } from "./build-electron.mjs";

const require = createRequire(import.meta.url);
const electronBinary = require("electron");

const server = await createServer({ configFile: "vite.config.ts" });
await server.listen();
const url = server.resolvedUrls.local[0];
console.log(`Vite ready at ${url}`);

let child = null;
let restarting = false;

function startElectron() {
  child = spawn(electronBinary, ["."], {
    stdio: "inherit",
    env: { ...process.env, VITE_DEV_SERVER_URL: url }
  });
  child.on("exit", () => {
    if (restarting) return;
    void server.close();
    process.exit(0);
  });
}

let startedAt = Infinity;
await watchElectron(() => {
  // Ignore the initial watch build that lands right after launch.
  if (Date.now() - startedAt < 1500) return;
  restarting = true;
  child?.once("exit", () => {
    restarting = false;
    startElectron();
  });
  child?.kill();
});
startedAt = Date.now();
startElectron();
