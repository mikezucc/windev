export enum IpcChannels {
  // Service management
  GET_SERVICES = 'get-services',
  ADD_SERVICE = 'add-service',
  UPDATE_SERVICE = 'update-service',
  REMOVE_SERVICE = 'remove-service',

  // Browser window
  OPEN_BROWSER_WINDOW = 'open-browser-window',
  BUILDER_CONSOLE_MESSAGE = 'builder-console-message',
  BUILDER_BROWSER_CLOSED = 'builder-browser-closed',

  // Claude Code Shell channels
  CLAUDE_SHELL_CREATE = 'claude-shell-create',
  CLAUDE_SHELL_WRITE = 'claude-shell-write',
  CLAUDE_SHELL_OUTPUT = 'claude-shell-output',
  CLAUDE_SHELL_ERROR = 'claude-shell-error',
  CLAUDE_SHELL_EXIT = 'claude-shell-exit',
  CLAUDE_SHELL_DESTROY = 'claude-shell-destroy',
  CLAUDE_SHELL_RESIZE = 'claude-shell-resize',

  // Webview Capture channels
  WEBVIEW_CAPTURE_SCREENSHOT = 'webview-capture-screenshot',
  WEBVIEW_START_RECORDING = 'webview-start-recording',
  WEBVIEW_STOP_RECORDING = 'webview-stop-recording',
  WEBVIEW_RECORDING_FRAME = 'webview-recording-frame',

  // Utility channels
  COPY_TO_CLIPBOARD = 'copy-to-clipboard',
  OPEN_EXTERNAL_URL = 'open-external-url',
  GET_THEME_MODE = 'get-theme-mode',
  SET_THEME_MODE = 'set-theme-mode',
  SELECT_DIRECTORY = 'select-directory',
}

export interface Service {
  id: string;
  name: string;
  url: string;
  repoPath: string;
  windowPrefs: WindowPreferences;
  shellCommand?: 'claude' | 'codex';
}

export interface WindowPreferences {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

export interface BrowserWindowOptions {
  serviceId: string;
  url: string;
  title: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  repoPath: string;
  shellCommand?: 'claude' | 'codex';
}

export interface BuilderConsoleMessage {
  windowId: string;
  type: 'log' | 'error' | 'warning' | 'info' | 'debug';
  message: string;
  timestamp: number;
  source?: string;
  lineNumber?: number;
  columnNumber?: number;
}

export interface ClaudeShellCreateResult {
  success: boolean;
  shellId?: string;
  error?: string;
}

export interface ClaudeShellOutputData {
  shellId: string;
  data: string;
}

export interface ClaudeShellErrorData {
  shellId: string;
  error: string;
}

export interface ClaudeShellExitData {
  shellId: string;
  exitCode: number;
}

export interface ClaudeShellResizeData {
  shellId: string;
  cols: number;
  rows: number;
}
