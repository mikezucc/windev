import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannels } from '../shared/ipc-channels';

interface BrowserAPI {
  onLoadUrl: (callback: (url: string) => void) => void;
  onSetShellId: (callback: (shellId: string) => void) => void;
  onSetWebviewPreload: (callback: (preloadPath: string) => void) => void;
  sendConsoleMessage: (message: any) => void;
  removeAllListeners: (channel: string) => void;

  // Claude Shell API
  claudeShellWrite: (shellId: string, input: string) => Promise<{ success: boolean }>;
  claudeShellDestroy: (shellId: string) => Promise<{ success: boolean }>;
  claudeShellResize: (shellId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  onClaudeShellOutput: (callback: (shellId: string, output: string) => void) => void;
  onClaudeShellError: (callback: (shellId: string, error: string) => void) => void;
  onClaudeShellExit: (callback: (shellId: string, code: number | null, signal: string | null) => void) => void;

  // Utility
  copyToClipboard: (text: string) => Promise<{ success: boolean }>;
}

const browserAPI: BrowserAPI = {
  onLoadUrl: (callback: (url: string) => void) => {
    ipcRenderer.on('load-url', (_, url) => callback(url));
  },

  onSetShellId: (callback: (shellId: string) => void) => {
    ipcRenderer.on('set-shell-id', (_, shellId) => callback(shellId));
  },

  onSetWebviewPreload: (callback: (preloadPath: string) => void) => {
    ipcRenderer.on('set-webview-preload', (_, preloadPath) => callback(preloadPath));
  },

  sendConsoleMessage: (message: any) => {
    ipcRenderer.send('webview-console-message', message);
  },

  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Claude Shell API
  claudeShellWrite: (shellId: string, input: string) => {
    return ipcRenderer.invoke(IpcChannels.CLAUDE_SHELL_WRITE, shellId, input);
  },

  claudeShellDestroy: (shellId: string) => {
    return ipcRenderer.invoke(IpcChannels.CLAUDE_SHELL_DESTROY, shellId);
  },

  claudeShellResize: (shellId: string, cols: number, rows: number) => {
    return ipcRenderer.invoke(IpcChannels.CLAUDE_SHELL_RESIZE, shellId, cols, rows);
  },

  onClaudeShellOutput: (callback: (shellId: string, output: string) => void) => {
    ipcRenderer.on(IpcChannels.CLAUDE_SHELL_OUTPUT, (_, shellId, output) => callback(shellId, output));
  },

  onClaudeShellError: (callback: (shellId: string, error: string) => void) => {
    ipcRenderer.on(IpcChannels.CLAUDE_SHELL_ERROR, (_, shellId, error) => callback(shellId, error));
  },

  onClaudeShellExit: (callback: (shellId: string, code: number | null, signal: string | null) => void) => {
    ipcRenderer.on(IpcChannels.CLAUDE_SHELL_EXIT, (_, shellId, code, signal) => callback(shellId, code, signal));
  },

  // Utility
  copyToClipboard: (text: string) => {
    return ipcRenderer.invoke(IpcChannels.COPY_TO_CLIPBOARD, text);
  },
};

contextBridge.exposeInMainWorld('browserAPI', browserAPI);
