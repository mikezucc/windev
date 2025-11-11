import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, IconButton, TextField, Stack } from '@mui/material';
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

  // Listen for URL to load
  useEffect(() => {
    window.browserAPI.onLoadUrl((loadUrl: string) => {
      console.log('Received URL to load:', loadUrl);
      setUrl(loadUrl);
    });

    return () => {
      window.browserAPI.removeAllListeners('load-url');
    };
  }, []);

  // Listen for shell ID
  useEffect(() => {
    window.browserAPI.onSetShellId((id: string) => {
      console.log('Received shell ID:', id);
      setShellId(id);
    });

    return () => {
      window.browserAPI.removeAllListeners('set-shell-id');
    };
  }, []);

  // Listen for webview preload path
  useEffect(() => {
    window.browserAPI.onSetWebviewPreload((preloadPath: string) => {
      console.log('Received webview preload path:', preloadPath);
      setWebviewPreloadPath(preloadPath);
    });

    return () => {
      window.browserAPI.removeAllListeners('set-webview-preload');
    };
  }, []);

  // Load URL in webview when received
  useEffect(() => {
    if (url && webviewRef.current && webviewPreloadPath) {
      console.log('Loading URL in webview:', url);
      webviewRef.current.src = url;
      updateNavigationButtons();
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
      updateNavigationButtons();
    }
  };

  const handleForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
      updateNavigationButtons();
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
      updateNavigationButtons();
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
        {shellId && (
          <Box sx={{ width: 475, borderLeft: '1px solid #333' }}>
            <ClaudeShellPanel shellId={shellId} />
          </Box>
        )}
      </Box>
    </Box>
  );
};
