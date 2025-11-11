import { app, BrowserWindow, ipcMain, dialog, shell, clipboard } from 'electron';
import path from 'path';
import { randomBytes } from 'crypto';
import store from './store';
import { browserManager } from './browserManager';
import { shellManager } from './shellManager';
import { IpcChannels, Service, ClaudeShellCreateResult, ClaudeShellResizeData } from '../shared/ipc-channels';

let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  const bounds = store.get('windowBounds');

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    title: 'Windev',
    webPreferences: {
      preload: path.join(__dirname, '../preload/mainPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // Set main window for browser manager
  browserManager.setMainWindow(mainWindow);

  // Save window bounds on close
  mainWindow.on('close', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      store.set('windowBounds', bounds);
    }
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load main window
  const mainUrl = `file://${path.join(__dirname, '../renderer/index.html')}`;
  mainWindow.loadURL(mainUrl);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// IPC Handlers

// Service management
ipcMain.handle(IpcChannels.GET_SERVICES, async () => {
  try {
    const services = store.get('services');
    return { success: true, services };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle(IpcChannels.ADD_SERVICE, async (_, service: Omit<Service, 'id'>) => {
  try {
    const services = store.get('services');
    const newService: Service = {
      ...service,
      id: `service-${Date.now()}-${randomBytes(4).toString('hex')}`,
    };
    services.push(newService);
    store.set('services', services);
    return { success: true, service: newService };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle(IpcChannels.UPDATE_SERVICE, async (_, updatedService: Service) => {
  try {
    const services = store.get('services');
    const index = services.findIndex(s => s.id === updatedService.id);
    if (index === -1) {
      return { success: false, error: 'Service not found' };
    }
    services[index] = updatedService;
    store.set('services', services);
    return { success: true, service: updatedService };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

ipcMain.handle(IpcChannels.REMOVE_SERVICE, async (_, serviceId: string) => {
  try {
    const services = store.get('services');
    const filteredServices = services.filter(s => s.id !== serviceId);
    store.set('services', filteredServices);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
});

// Claude Shell handlers
ipcMain.handle(IpcChannels.CLAUDE_SHELL_CREATE, async (_, repoPath: string, windowId: string): Promise<ClaudeShellCreateResult> => {
  try {
    const shellId = shellManager.createShell(repoPath, windowId);
    return { success: true, shellId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.CLAUDE_SHELL_WRITE, async (_, shellId: string, data: string) => {
  try {
    const success = shellManager.writeToShell(shellId, data);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.CLAUDE_SHELL_DESTROY, async (_, shellId: string) => {
  try {
    const success = shellManager.destroyShell(shellId);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.CLAUDE_SHELL_RESIZE, async (_, resizeData: ClaudeShellResizeData) => {
  try {
    const success = shellManager.resizeShell(resizeData.shellId, resizeData.cols, resizeData.rows);
    return { success };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Utility handlers
ipcMain.handle(IpcChannels.SELECT_DIRECTORY, async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) {
      return { success: false };
    }
    return { success: true, path: result.filePaths[0] };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.OPEN_EXTERNAL_URL, async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.COPY_TO_CLIPBOARD, async (_, text: string) => {
  try {
    clipboard.writeText(text);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.GET_THEME_MODE, async () => {
  try {
    const themeMode = store.get('themeMode');
    return { success: true, themeMode };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

ipcMain.handle(IpcChannels.SET_THEME_MODE, async (_, themeMode: 'light' | 'dark' | 'system') => {
  try {
    store.set('themeMode', themeMode);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
});

// Shell event forwarding
shellManager.on('output', (shellId: string, windowId: string, data: string) => {
  browserManager.sendShellOutputToWindow(windowId, shellId, data);
});

shellManager.on('error', (shellId: string, windowId: string, error: string) => {
  browserManager.sendShellErrorToWindow(windowId, shellId, error);
});

shellManager.on('exit', (shellId: string, windowId: string, exitCode: number, signal: string | null) => {
  browserManager.sendShellExitToWindow(windowId, shellId, exitCode, signal);
});

// App lifecycle
app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  browserManager.closeAllWindows();
  shellManager.destroyAllShells();
});
