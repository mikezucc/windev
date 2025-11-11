import { BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { BrowserWindowOptions, BuilderConsoleMessage, IpcChannels } from '../shared/ipc-channels';
import { shellManager } from './shellManager';

interface BrowserWindowInfo {
  id: string;
  window: BrowserWindow;
  url: string;
  serviceId: string;
  shellId?: string;
}

class BrowserManager {
  private windows: Map<string, BrowserWindowInfo> = new Map();
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    this.setupIpcHandlers();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  private setupIpcHandlers() {
    ipcMain.handle(IpcChannels.OPEN_BROWSER_WINDOW, async (_, options: BrowserWindowOptions) => {
      return this.createBrowserWindow(options);
    });
  }

  private async createBrowserWindow(options: BrowserWindowOptions): Promise<{ success: boolean; windowId?: string; error?: string }> {
    try {
      const windowId = `browser-${Date.now()}`;

      const win = new BrowserWindow({
        width: options.width || 1400,
        height: options.height || 900,
        x: options.x,
        y: options.y,
        title: options.title || 'Windev Browser',
        webPreferences: {
          preload: path.join(__dirname, '../preload/browserPreload.js'),
          contextIsolation: true,
          nodeIntegration: false,
          webviewTag: true,
          sandbox: false,
        },
        show: false,
        autoHideMenuBar: true,
      });

      // Store window reference before loading
      this.windows.set(windowId, {
        id: windowId,
        window: win,
        url: options.url,
        serviceId: options.serviceId,
      });

      // Wait for DOM to be ready, then send configuration
      win.webContents.once('dom-ready', () => {
        console.log('Browser window loaded, sending configuration');
        setTimeout(() => {
          // Send the URL to load
          console.log('Sending URL to browser:', options.url);
          win.webContents.send('load-url', options.url);

          // Send the webview preload path
          const webviewPreloadPath = `file://${path.join(__dirname, '../preload/webviewPreload.js')}`;
          console.log('Sending webview preload path:', webviewPreloadPath);
          win.webContents.send('set-webview-preload', webviewPreloadPath);

          // Create shell session for this window
          if (options.repoPath) {
            try {
              const shellId = shellManager.createShell(options.repoPath, windowId);
              const windowInfo = this.windows.get(windowId);
              if (windowInfo) {
                windowInfo.shellId = shellId;
              }
              win.webContents.send('set-shell-id', shellId);
              console.log(`Created shell ${shellId} for window ${windowId}`);
            } catch (error) {
              console.error('Failed to create shell:', error);
            }
          }
        }, 500);
      });

      // Show window when ready
      win.once('ready-to-show', () => {
        win.show();
      });

      // Handle window closed
      win.on('closed', () => {
        const windowInfo = this.windows.get(windowId);
        if (windowInfo?.shellId) {
          shellManager.destroyShell(windowInfo.shellId);
        }
        this.windows.delete(windowId);

        // Notify main window that this browser window was closed
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.webContents.send(IpcChannels.BUILDER_BROWSER_CLOSED, windowId);
        }
      });

      // Set up webview event forwarding
      this.setupWebviewEventForwarding(win, windowId);

      // Load the Browser page
      const browserUrl = `file://${path.join(__dirname, '../renderer/browser.html')}`;
      await win.loadURL(browserUrl);

      return { success: true, windowId };
    } catch (error) {
      console.error('Failed to create browser window:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private setupWebviewEventForwarding(win: BrowserWindow, windowId: string) {
    // Listen for console messages from the browser window
    win.webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'webview-console-message') {
        const [message] = args;

        // Forward to main window if needed (optional)
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          const consoleMessage: BuilderConsoleMessage = {
            windowId,
            ...message,
          };
          this.mainWindow.webContents.send(IpcChannels.BUILDER_CONSOLE_MESSAGE, consoleMessage);
        }
      }
    });
  }

  getWindow(windowId: string): BrowserWindow | undefined {
    return this.windows.get(windowId)?.window;
  }

  getAllWindows(): BrowserWindowInfo[] {
    return Array.from(this.windows.values());
  }

  closeWindow(windowId: string): boolean {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      windowInfo.window.close();
      return true;
    }
    return false;
  }

  closeAllWindows() {
    for (const [_, windowInfo] of this.windows) {
      if (!windowInfo.window.isDestroyed()) {
        windowInfo.window.close();
      }
    }
  }

  // Send shell output to specific window
  sendShellOutputToWindow(windowId: string, shellId: string, output: string) {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send(IpcChannels.CLAUDE_SHELL_OUTPUT, shellId, output);
    }
  }

  sendShellErrorToWindow(windowId: string, shellId: string, error: string) {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send(IpcChannels.CLAUDE_SHELL_ERROR, shellId, error);
    }
  }

  sendShellExitToWindow(windowId: string, shellId: string, code: number | null, signal: string | null) {
    const windowInfo = this.windows.get(windowId);
    if (windowInfo && !windowInfo.window.isDestroyed()) {
      windowInfo.window.webContents.send(IpcChannels.CLAUDE_SHELL_EXIT, shellId, code, signal);
    }
  }
}

export const browserManager = new BrowserManager();
