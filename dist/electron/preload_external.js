"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electron", {
  browser: {
    navigate: (url) => electron.ipcRenderer.invoke("browser:navigate", url),
    goBack: () => electron.ipcRenderer.invoke("browser:go-back"),
    goForward: () => electron.ipcRenderer.invoke("browser:go-forward"),
    reload: () => electron.ipcRenderer.invoke("browser:reload"),
    getUrl: () => electron.ipcRenderer.invoke("browser:get-url"),
    canGoBack: () => electron.ipcRenderer.invoke("browser:can-go-back"),
    canGoForward: () => electron.ipcRenderer.invoke("browser:can-go-forward")
  }
});
