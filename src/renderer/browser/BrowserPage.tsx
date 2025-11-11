import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, IconButton, TextField, Stack, Typography } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ClaudeShellPanel } from '../components/ClaudeShellPanel';

declare global {
  interface Window {
    browserAPI: {
      onLoadUrl: (callback: (url: string) => void) => void;
      onSetShellId: (callback: (shellId: string) => void) => void;
      onSetWebviewPreload: (callback: (preloadPath: string) => void) => void;
      removeAllListeners: (channel: string) => void;
      claudeShellWrite: (shellId: string, input: string) => Promise<{ success: boolean }>;
      claudeShellResize: (shellId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
      onClaudeShellOutput: (callback: (shellId: string, output: string) => void) => void;
      onClaudeShellError: (callback: (shellId: string, error: string) => void) => void;
      onClaudeShellExit: (callback: (shellId: string, code: number | null, signal: string | null) => void) => void;
    };
  }
}

export const BrowserPage: React.FC = () => {
  const [url, setUrl] = useState('');
  const [shellId, setShellId] = useState<string | null>(null);
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string>('');
  const webviewRef = useRef<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);

  // Use refs to store callbacks to avoid stale closures
  const urlCallbackRef = useRef<((url: string) => void) | null>(null);
  const shellIdCallbackRef = useRef<((id: string) => void) | null>(null);
  const webviewPreloadCallbackRef = useRef<((path: string) => void) | null>(null);

  // Set up listeners once on mount
  useEffect(() => {
    console.log('[BrowserPage] Setting up IPC listeners');

    // URL listener
    const handleLoadUrl = (loadUrl: string) => {
      console.log('[BrowserPage] Received URL to load:', loadUrl);
      if (urlCallbackRef.current) {
        urlCallbackRef.current(loadUrl);
      }
    };

    // Shell ID listener
    const handleSetShellId = (id: string) => {
      console.log('[BrowserPage] Received shell ID:', id);
      if (shellIdCallbackRef.current) {
        shellIdCallbackRef.current(id);
      }
    };

    // Webview preload listener
    const handleSetWebviewPreload = (preloadPath: string) => {
      console.log('[BrowserPage] Received webview preload path:', preloadPath);
      if (webviewPreloadCallbackRef.current) {
        webviewPreloadCallbackRef.current(preloadPath);
      }
    };

    window.browserAPI.onLoadUrl(handleLoadUrl);
    window.browserAPI.onSetShellId(handleSetShellId);
    window.browserAPI.onSetWebviewPreload(handleSetWebviewPreload);

    return () => {
      console.log('[BrowserPage] Cleaning up IPC listeners');
      window.browserAPI.removeAllListeners('load-url');
      window.browserAPI.removeAllListeners('set-shell-id');
      window.browserAPI.removeAllListeners('set-webview-preload');
    };
  }, []);

  // Update callbacks refs when state setters are available
  useEffect(() => {
    urlCallbackRef.current = (loadUrl: string) => setUrl(loadUrl);
  }, []);

  useEffect(() => {
    shellIdCallbackRef.current = (id: string) => setShellId(id);
  }, []);

  useEffect(() => {
    webviewPreloadCallbackRef.current = (path: string) => setWebviewPreloadPath(path);
  }, []);

  // Setup webview event listeners
  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleDomReady = () => {
      console.log('Webview dom-ready');
      updateNavigationButtons();
    };

    const handleDidNavigate = () => {
      updateNavigationButtons();
    };

    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
    };
  }, []);

  // Load URL in webview when received
  useEffect(() => {
    if (url && webviewRef.current && webviewPreloadPath) {
      console.log('Loading URL in webview:', url);
      webviewRef.current.src = url;
    }
  }, [url, webviewPreloadPath]);

  const updateNavigationButtons = () => {
    if (webviewRef.current) {
      setCanGoBack(webviewRef.current.canGoBack());
      setCanGoForward(webviewRef.current.canGoForward());
    }
  };

  const handleBack = () => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(e.target.value);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (webviewRef.current && url) {
      webviewRef.current.src = url;
    }
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', flexDirection: 'column' }}>
      {/* Navigation Bar */}
      <Paper sx={{ p: 1 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton onClick={handleBack} disabled={!canGoBack} size="small">
            <ArrowBackIcon />
          </IconButton>
          <IconButton onClick={handleForward} disabled={!canGoForward} size="small">
            <ArrowForwardIcon />
          </IconButton>
          <IconButton onClick={handleRefresh} size="small">
            <RefreshIcon />
          </IconButton>
          <Box component="form" onSubmit={handleUrlSubmit} sx={{ flex: 1 }}>
            <TextField
              fullWidth
              size="small"
              value={url}
              onChange={handleUrlChange}
              placeholder="Enter URL"
            />
          </Box>
        </Stack>
      </Paper>

      {/* Main content area with webview and terminal */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Webview container */}
        <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <webview
            ref={webviewRef}
            preload={webviewPreloadPath}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </Box>

        {/* Claude terminal panel */}
        {shellId ? (
          <Box sx={{ width: 475, height: '100%', borderLeft: '1px solid #333' }}>
            <ClaudeShellPanel shellId={shellId} />
          </Box>
        ) : (
          <Box sx={{ width: 475, borderLeft: '1px solid #333', bgcolor: '#1e1e1e', p: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                  No Claude Code terminal available
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  To enable the Claude Code terminal, configure a repository path for this service in the main window.
                </Typography>
              </Stack>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
};
