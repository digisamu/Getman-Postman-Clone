import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/400-italic.css";
import "@fontsource-variable/jetbrains-mono";
import "@fontsource-variable/bodoni-moda/wght-italic.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { hydrateWorkspace } from "./store/persistence";
import { useWorkspace } from "./store/workspace";
import "./styles.css";

// Load the workspace before the first render so the UI never flashes default data.
await hydrateWorkspace();
document.documentElement.dataset.theme = useWorkspace.getState().theme;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
