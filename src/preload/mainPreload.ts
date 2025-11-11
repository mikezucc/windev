import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels, Service, BrowserWindowOptions } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Service management
  getServices: () => ipcRenderer.invoke(IpcChannels.GET_SERVICES),
  addService: (service: Omit<Service, 'id'>) => ipcRenderer.invoke(IpcChannels.ADD_SERVICE, service),
  updateService: (service: Service) => ipcRenderer.invoke(IpcChannels.UPDATE_SERVICE, service),
  removeService: (serviceId: string) => ipcRenderer.invoke(IpcChannels.REMOVE_SERVICE, serviceId),

  // Browser window
  openBrowserWindow: (options: BrowserWindowOptions) => ipcRenderer.invoke(IpcChannels.OPEN_BROWSER_WINDOW, options),
  onBuilderBrowserClosed: (callback: (windowId: string) => void) => {
    ipcRenderer.on(IpcChannels.BUILDER_BROWSER_CLOSED, (_, windowId) => callback(windowId));
  },

  // Utility
  selectDirectory: () => ipcRenderer.invoke(IpcChannels.SELECT_DIRECTORY),
  openExternalUrl: (url: string) => ipcRenderer.invoke(IpcChannels.OPEN_EXTERNAL_URL, url),
  getThemeMode: () => ipcRenderer.invoke(IpcChannels.GET_THEME_MODE),
  setThemeMode: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke(IpcChannels.SET_THEME_MODE, mode),
});
