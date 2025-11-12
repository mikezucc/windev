// Global type declarations for the windev application

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

  // Webview Capture API
  webviewCaptureScreenshot: () => Promise<{ success: boolean; path?: string; error?: string }>;
  webviewStartRecording: () => Promise<{ success: boolean; error?: string }>;
  webviewStopRecording: () => Promise<{ success: boolean; path?: string; error?: string; isVideo?: boolean }>;
  sendRecordingComplete: (videoData: ArrayBuffer | null, error?: string) => void;
  onRecordingFrame: (callback: (data: any) => void) => void;

  // Utility
  copyToClipboard: (text: string) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    browserAPI: BrowserAPI;
  }
}

export {};
