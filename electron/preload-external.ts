import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  browser: {
    navigate: (url: string): Promise<any> => ipcRenderer.invoke('browser:navigate', url),
    goBack: (): Promise<any> => ipcRenderer.invoke('browser:go-back'),
    goForward: (): Promise<any> => ipcRenderer.invoke('browser:go-forward'),
    reload: (): Promise<any> => ipcRenderer.invoke('browser:reload'),
    getUrl: (): Promise<string> => ipcRenderer.invoke('browser:get-url'),
    canGoBack: (): Promise<boolean> => ipcRenderer.invoke('browser:can-go-back'),
    canGoForward: (): Promise<boolean> => ipcRenderer.invoke('browser:can-go-forward')
  }
})
