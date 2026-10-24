import { contextBridge, ipcRenderer } from "electron";
import type { GetmanBridge, MenuCommand } from "../src/shared/ipc";

const bridge: GetmanBridge = {
  platform: process.platform,
  loadWorkspace: () => ipcRenderer.invoke("workspace:load"),
  saveWorkspace: (data) => ipcRenderer.invoke("workspace:save", data),
  saveWorkspaceSync: (data) => {
    ipcRenderer.sendSync("workspace:save-sync", data);
  },
  sendRequest: (id, payload) => ipcRenderer.invoke("http:send", id, payload),
  cancelRequest: (id) => ipcRenderer.send("http:cancel", id),
  saveFile: (options) => ipcRenderer.invoke("file:save", options),
  openFile: (options) => ipcRenderer.invoke("file:open", options),
  setTitleBarColors: (background, symbols) => ipcRenderer.send("window:titlebar", background, symbols),
  onMenuCommand: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, command: MenuCommand) => listener(command);
    ipcRenderer.on("menu:command", handler);
    return () => ipcRenderer.removeListener("menu:command", handler);
  }
};

contextBridge.exposeInMainWorld("getman", bridge);
