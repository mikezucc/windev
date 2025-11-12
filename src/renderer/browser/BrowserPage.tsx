import React, { useState, useRef, useEffect } from 'react';
import { Box, Paper, IconButton, TextField, Stack, Tooltip, Divider, Typography, Menu, MenuItem, LinearProgress, InputAdornment } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HomeIcon from '@mui/icons-material/Home';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import VideocamIcon from '@mui/icons-material/Videocam';
import StopIcon from '@mui/icons-material/Stop';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import HistoryIcon from '@mui/icons-material/History';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { DebugOutputPanel } from '../components/DebugOutputPanel';
import { ClaudeCodeShellPanel, ClaudeCodeShellPanelRef } from './ClaudeCodeShell';
import { BuilderConsoleMessage, IpcChannels } from '../../shared/ipc-channels';
import { CreateMomentModal } from '../components/moments/CreateMomentModal';
import { Snackbar, Alert } from '@mui/material';
import { CanvasRecorder } from '../utils/webcodecs-recorder';
import { ResponsiveSizeSelector, ResponsiveSize, RESPONSIVE_SIZES } from '../components/ResponsiveSizeSelector';

export const BrowserPage: React.FC = () => {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [repositoryUrl, setRepositoryUrl] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [messages, setMessages] = useState<BuilderConsoleMessage[]>([]);
  const [urlHistory, setUrlHistory] = useState<string[]>([]);
  const [historyAnchorEl, setHistoryAnchorEl] = useState<null | HTMLElement>(null);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const webviewRef = useRef<any>(null);
  const [webviewElement, setWebviewElement] = useState<any>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [webviewReady, setWebviewReady] = useState(false);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [consoleWidth, setConsoleWidth] = useState(475);
  const [isResizing, setIsResizing] = useState(false);
  const [debugPanelHeight, setDebugPanelHeight] = useState(30); // percentage
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const shellPanelRef = useRef<ClaudeCodeShellPanelRef | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [capturedFile, setCapturedFile] = useState<{ path: string; type: 'screenshot' | 'recording' } | null>(null);
  const [createMomentOpen, setCreateMomentOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState<{ text: string; severity: 'success' | 'error' | 'info' } | null>(null);
  const [captureFile, setCaptureFile] = useState<File | null>(null);
  const recorderRef = useRef<CanvasRecorder | null>(null);
  const [responsiveSize, setResponsiveSize] = useState<ResponsiveSize | null>(null);
  const [webviewWidth, setWebviewWidth] = useState<number | null>(null);
  const [webviewHeight, setWebviewHeight] = useState<number | null>(null);
  const [isDraggingWebview, setIsDraggingWebview] = useState(false);
  const webviewContainerRef = useRef<HTMLDivElement>(null);
  const [webviewPosition, setWebviewPosition] = useState({ x: 0, y: 0 });
  const [webviewZoom, setWebviewZoom] = useState(1);
  const [activeResize, setActiveResize] = useState<'left' | 'right' | 'bottom' | 'bottom-left' | 'bottom-right' | null>(null);
  const [webviewPreloadPath, setWebviewPreloadPath] = useState<string>('');
  
  // Listen for webview preload path
  useEffect(() => {
    const handleSetWebviewPreload = (preloadPath: string) => {
      console.log('Received webview preload path:', preloadPath);
      setWebviewPreloadPath(preloadPath);
      
      // If webview is already created, update its preload
      if (webviewRef.current && webviewReady) {
        console.log('Updating webview preload attribute:', preloadPath);
        webviewRef.current.setAttribute('preload', preloadPath);
        // Reload to apply the preload script
        if (url && url !== 'about:blank') {
          webviewRef.current.reload();
        }
      }
    };
    
    window.browserAPI.onSetWebviewPreload(handleSetWebviewPreload);
    
    return () => {
      window.browserAPI.removeAllListeners('set-webview-preload');
    };
  }, [webviewReady, url]);
  
  // Set repository URL to repoPath
  useEffect(() => {
    if (repoPath) {
      setRepositoryUrl(repoPath);
      console.log('Repository path:', repoPath);
    } else {
      setRepositoryUrl(null);
    }
  }, [repoPath]);
  
  // Listen for recording frames
  useEffect(() => {
    const handleRecordingFrame = async (data: any) => {
      if (data.type === 'start') {
        // Initialize recorder
        recorderRef.current = new CanvasRecorder();
        await recorderRef.current.startRecording(data.width, data.height);
      } else if (data.type === 'frame' && recorderRef.current) {
        // Add frame to recording
        await recorderRef.current.addFrame(data.data);
      } else if (data.type === 'stop' && recorderRef.current) {
        // Finish recording and send back the video
        try {
          const videoData = await recorderRef.current.finishRecording();
          // Send video data back to main process
          window.browserAPI.sendRecordingComplete(videoData.buffer as ArrayBuffer);
          recorderRef.current = null;
        } catch (error) {
          console.error('Error finishing recording:', error);
          window.browserAPI.sendRecordingComplete(null, error instanceof Error ? error.message : 'Failed to encode video');
        }
      }
    };
    
    // Listen for recording frames
    window.browserAPI.onRecordingFrame(handleRecordingFrame);
    
    return () => {
      window.browserAPI.removeAllListeners(IpcChannels.WEBVIEW_RECORDING_FRAME);
    };
  }, []);
  
  
  useEffect(() => {
    // Listen for URL to load from main process
    const handleLoadUrl = (targetUrl: string) => {
      console.log(Date(), 'Received URL to load:', targetUrl, webviewRef.current);
      
      if (webviewReady && webviewRef.current) {
        console.log(Date(), 'Webview is ready, loading URL immediately');
        setUrl(targetUrl);
        webviewRef.current.loadURL(targetUrl);
      } else {
        console.log(Date(), 'Webview not ready yet, storing URL for later');
        setPendingUrl(targetUrl);
      }
    };
    
    window.browserAPI.onLoadUrl(handleLoadUrl);

    return () => {
      window.browserAPI.removeAllListeners('load-url');
    };
  }, [webviewReady]);

  // Try to load URL when webview becomes ready
  useEffect(() => {
    if (webviewReady && pendingUrl && webviewRef.current) {
      console.log('Webview is now ready, loading pending URL:', pendingUrl);
      setUrl(pendingUrl);
      webviewRef.current.loadURL(pendingUrl);
      setPendingUrl(null);
    }
  }, [webviewReady, pendingUrl]);

  // Handle webview ref callback
  const handleWebviewRef = (element: any) => {
    webviewRef.current = element;
    setWebviewElement(element);

    if (element) {
      console.log('Webview element attached to DOM');

      // Fix the internal iframe styling in the shadow root
      // The webview creates an iframe inside its shadow root that needs explicit height
      setTimeout(() => {
        try {
          const shadowRoot = element.shadowRoot;
          if (shadowRoot) {
            const iframe = shadowRoot.querySelector('iframe');
            if (iframe) {
              iframe.style.height = '100%';
              iframe.style.width = '100%';
              iframe.style.flex = 'none';
              iframe.style.display = 'block';
              console.log('Fixed webview internal iframe styling');
            }
          }
        } catch (e) {
          console.error('Failed to fix webview iframe styling:', e);
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (!webviewElement || !webviewPreloadPath) return;

    const webview = webviewElement;
    
    // Define network logging script
    const networkLoggingScript = `
        (function() {
          // Check if already injected
          if (window.__networkLogInjected) return;
          window.__networkLogInjected = true;
          
          console.log('[Network Logger] Injecting network interceptors');
          
          // Store originals
          const originalFetch = window.fetch;
          const OriginalXHR = window.XMLHttpRequest;
          
          // Override fetch
          window.fetch = function(...args) {
            const [url, options = {}] = args;
            const startTime = Date.now();
            const method = options.method || 'GET';
            
            console.log('[Network] ' + method + ' ' + url);
            
            return originalFetch.apply(this, args)
              .then(response => {
                const duration = Date.now() - startTime;
                const logType = response.status >= 400 ? 'error' : 'log';
                console[logType]('[Network] ' + method + ' ' + url + ' - ' + response.status + ' ' + response.statusText + ' (' + duration + 'ms)');
                
                if (response.status >= 400) {
                  response.clone().text().then(body => {
                    if (body) {
                      console.error('[Network] Response: ' + body.substring(0, 500));
                    }
                  }).catch(() => {});
                }
                
                return response;
              })
              .catch(error => {
                const duration = Date.now() - startTime;
                console.error('[Network] ' + method + ' ' + url + ' - Failed: ' + error.message + ' (' + duration + 'ms)');
                throw error;
              });
          };
          
          // Override XMLHttpRequest
          window.XMLHttpRequest = function() {
            const xhr = new OriginalXHR();
            let method, url, startTime;
            
            const originalOpen = xhr.open;
            xhr.open = function(...args) {
              method = args[0];
              url = args[1];
              return originalOpen.apply(this, args);
            };
            
            const originalSend = xhr.send;
            xhr.send = function(...args) {
              startTime = Date.now();
              console.log('[Network] ' + method + ' ' + url);
              
              xhr.addEventListener('load', function() {
                const duration = Date.now() - startTime;
                const logType = xhr.status >= 400 ? 'error' : 'log';
                console[logType]('[Network] ' + method + ' ' + url + ' - ' + xhr.status + ' ' + xhr.statusText + ' (' + duration + 'ms)');
                
                if (xhr.status >= 400 && xhr.responseText) {
                  console.error('[Network] Response: ' + xhr.responseText.substring(0, 500));
                }
              });
              
              xhr.addEventListener('error', function() {
                const duration = Date.now() - startTime;
                console.error('[Network] ' + method + ' ' + url + ' - Failed: Network error (' + duration + 'ms)');
              });
              
              return originalSend.apply(this, args);
            };
            
            return xhr;
          };
          
          console.log('[Network Logger] Injection complete');
        })();
      `;

    const handleDomReady = () => {
      console.log('Webview DOM ready');
      console.log('Webview preload attribute:', webview.getAttribute('preload'));
      console.log('Webview preloadPath state:', webviewPreloadPath);
      setWebviewReady(true);

      // Fix the internal iframe styling
      try {
        const shadowRoot = webview.shadowRoot;
        if (shadowRoot) {
          const iframe = shadowRoot.querySelector('iframe');
          if (iframe) {
            iframe.style.height = '100%';
            iframe.style.width = '100%';
            iframe.style.flex = 'none';
            iframe.style.display = 'block';
            console.log('Fixed webview internal iframe styling on dom-ready');
          }
        }
      } catch (e) {
        console.error('Failed to fix webview iframe styling on dom-ready:', e);
      }

      try {
        webview.executeJavaScript(networkLoggingScript);
        console.log('Network logging script injected');
      } catch (e) {
        console.error('Failed to inject network logging script:', e);
      }

      // Load pending URL if exists
      if (pendingUrl) {
        console.log('Loading pending URL:', pendingUrl);
        setUrl(pendingUrl);
        webview.loadURL(pendingUrl);
        setPendingUrl(null);
      }
    };

    const handleNewWindow = (e: any) => {
      e.preventDefault();
      const newUrl = e.url;
      webview.loadURL(newUrl);
    };

    const handleDidNavigate = (e: any) => {
      console.log(Date(), 'Webview handleDidNavigate', e.url);
      setUrl(e.url);
      setCanGoBack(webview.canGoBack());
      setCanGoForward(webview.canGoForward());
      
      // Re-inject network logging script after navigation
      if (e.url && e.url !== 'about:blank') {
        setTimeout(() => {
          try {
            webview.executeJavaScript(networkLoggingScript);
            console.log('Network logging script re-injected after navigation');
          } catch (e) {
            console.error('Failed to re-inject network logging script:', e);
          }
        }, 100);
      }
    };

    const handleDidStartLoading = () => {
      setIsLoading(true);
      setLoadingProgress(0);
    };

    const handleDidStopLoading = () => {
      console.log(Date(), 'Webview handleDidStopLoading');
      setIsLoading(false);
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(null), 300);
    };

    const handleLoadCommit = (e: any) => {
      console.log('Load commit:', e.url);
      // Add URL to history if it's not already the most recent
      if (e.url && e.url !== 'about:blank' && e.url !== urlHistory[0]) {
        setUrlHistory(prev => {
          const filtered = prev.filter(u => u !== e.url);
          return [e.url, ...filtered].slice(0, 20); // Keep last 20 URLs
        });
      }
    };

    const handleLoadProgress = (e: any) => {
      const progress = Math.round(e.percent * 100);
      setLoadingProgress(progress);
    };

    const handleIpcMessage = (e: any) => {
      console.log('IPC message received:', e.channel, e.args);
      
      // The webview's sendToHost sends messages directly in args
      const consoleData = e.args[0];
      
      // Log for debugging
      console.log('IPC message data:', consoleData);
      
      // Ensure type is properly set
      let messageType = consoleData.type;
      if (!['log', 'error', 'warning', 'info', 'debug'].includes(messageType)) {
        messageType = 'log';
      }
      
      const newMessage: BuilderConsoleMessage = {
        windowId: 'current',
        type: messageType,
        message: consoleData.message,
        timestamp: consoleData.timestamp || Date.now(),
        source: consoleData.source,
        lineNumber: consoleData.lineNumber,
        columnNumber: consoleData.columnNumber
      };
      
      console.log('Adding message to state:', newMessage);
      setMessages(prev => [...prev, newMessage]);
      
      // Forward to main process
      window.browserAPI.sendConsoleMessage({
        type: newMessage.type,
        message: newMessage.message,
        timestamp: newMessage.timestamp,
        source: newMessage.source,
        lineNumber: newMessage.lineNumber,
        columnNumber: newMessage.columnNumber
      });
    };

    const handleConsoleMessage = (e: any) => {
      console.log('Console message event:', e, 'Level:', e.level, 'Type:', typeof e.level);
      const { level, message, line, sourceId } = e;
      
      // Map console levels from Electron's numeric levels to our types
      // Electron webview console levels: 0 = verbose/debug, 1 = info/log, 2 = warning, 3 = error
      const levelMap: { [key: number]: BuilderConsoleMessage['type'] } = {
        0: 'debug',   // verbose
        1: 'log',     // info/log
        2: 'warning', // warning
        3: 'error'    // error
      };
      
      // Also handle string levels in case they come through
      const stringLevelMap: { [key: string]: BuilderConsoleMessage['type'] } = {
        'log': 'log',
        'info': 'info',
        'warning': 'warning',
        'error': 'error',
        'debug': 'debug'
      };
      
      // Determine the type based on whether level is numeric or string
      let messageType: BuilderConsoleMessage['type'];
      if (typeof level === 'number') {
        messageType = levelMap[level] || 'log';
      } else if (typeof level === 'string') {
        messageType = stringLevelMap[level.toLowerCase()] || 'log';
      } else {
        messageType = 'log';
      }
      
      const newMessage: BuilderConsoleMessage = {
        windowId: 'current',
        type: messageType,
        message: message,
        timestamp: Date.now(),
        source: sourceId,
        lineNumber: line
      };
      
      setMessages(prev => [...prev, newMessage]);
      
      // Forward to main process
      window.browserAPI.sendConsoleMessage({
        type: newMessage.type,
        message: newMessage.message,
        timestamp: newMessage.timestamp,
        source: newMessage.source,
        lineNumber: newMessage.lineNumber
      });
    };

    // Add event listeners
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('new-window', handleNewWindow);
    webview.addEventListener('did-navigate', handleDidNavigate);
    webview.addEventListener('did-navigate-in-page', handleDidNavigate);
    webview.addEventListener('did-start-loading', handleDidStartLoading);
    webview.addEventListener('did-stop-loading', handleDidStopLoading);
    webview.addEventListener('load-commit', handleLoadCommit);
    webview.addEventListener('did-fail-load', handleDidStopLoading);
    webview.addEventListener('did-fail-provisional-load', handleDidStopLoading);
    
    // Handle loading progress if supported
    if ('addEventListener' in webview) {
      try {
        webview.addEventListener('did-fail-load', (e: any) => {
          console.log('Load failed:', e);
          setLoadingProgress(null);
          setIsLoading(false);
        });
      } catch (e) {
        console.log('Progress events not supported:', e);
      }
    }
    webview.addEventListener('ipc-message', handleIpcMessage);
    webview.addEventListener('console-message', handleConsoleMessage);

    // Don't force call handleDomReady - wait for the actual event

    return () => {
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('new-window', handleNewWindow);
      webview.removeEventListener('did-navigate', handleDidNavigate);
      webview.removeEventListener('did-navigate-in-page', handleDidNavigate);
      webview.removeEventListener('did-start-loading', handleDidStartLoading);
      webview.removeEventListener('did-stop-loading', handleDidStopLoading);
      webview.removeEventListener('load-commit', handleLoadCommit);
      webview.removeEventListener('did-fail-load', handleDidStopLoading);
      webview.removeEventListener('did-fail-provisional-load', handleDidStopLoading);
      webview.removeEventListener('ipc-message', handleIpcMessage);
      webview.removeEventListener('console-message', handleConsoleMessage);
    };
  }, [webviewElement, pendingUrl, webviewPreloadPath]);

  // Reset custom dimensions, position and zoom when responsive size changes
  useEffect(() => {
    setWebviewWidth(null);
    setWebviewHeight(null);
    setWebviewPosition({ x: 0, y: 0 });
    setWebviewZoom(1);
  }, [responsiveSize]);

  const handleNavigateBack = () => {
    if (webviewRef.current && canGoBack) {
      webviewRef.current.goBack();
    }
  };

  const handleNavigateForward = () => {
    if (webviewRef.current && canGoForward) {
      webviewRef.current.goForward();
    }
  };

  const handleRefresh = () => {
    if (webviewRef.current && webviewReady) {
      webviewRef.current.reload();
    }
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (webviewRef.current && webviewReady && url) {
      let finalUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        finalUrl = 'https://' + url;
      }
      webviewRef.current.loadURL(finalUrl);
    }
  };

  const handleClearMessages = () => {
    setMessages([]);
  };

  const handleCaptureScreenshot = async () => {
    if (!webviewRef.current || !webviewReady) return;
    
    try {
      const result = await window.browserAPI.webviewCaptureScreenshot();
      if (result.success && result.path) {
        setCapturedFile({ path: result.path, type: 'screenshot' });
        
        // Read the file and create a File object
        const response = await fetch(`file://${result.path}`);
        const blob = await response.blob();
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
        setCaptureFile(file);
        
        // Open create moment modal
        setCreateMomentOpen(true);
        setSnackbarMessage({ text: 'Screenshot captured!', severity: 'success' });
      } else {
        setSnackbarMessage({ text: result.error || 'Failed to capture screenshot', severity: 'error' });
      }
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      setSnackbarMessage({ text: 'Error capturing screenshot', severity: 'error' });
    }
  };

  const handleStartRecording = async () => {
    if (!webviewRef.current || !webviewReady || isRecording) return;
    
    try {
      const result = await window.browserAPI.webviewStartRecording();
      if (result.success) {
        setIsRecording(true);
        console.log('Recording started');
      } else {
        console.error('Failed to start recording:', result.error);
      }
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const handleStopRecording = async () => {
    if (!isRecording) return;
    
    try {
      const result = await window.browserAPI.webviewStopRecording();
      if (result.success && result.path) {
        setIsRecording(false);
        setCapturedFile({ path: result.path, type: 'recording' });
        
        // Read the file and create a File object
        const response = await fetch(`file://${result.path}`);
        const blob = await response.blob();
        
        // Check if it's a video or screenshot
        const isVideo = result.path.endsWith('.webm') || (result as any).isVideo;
        const fileName = isVideo ? `recording-${Date.now()}.webm` : `recording-${Date.now()}.png`;
        const mimeType = isVideo ? 'video/webm' : 'image/png';
        
        const file = new File([blob], fileName, { type: mimeType });
        setCaptureFile(file);
        
        // Open create moment modal
        setCreateMomentOpen(true);
        setSnackbarMessage({ 
          text: isVideo ? 'Video recording saved!' : 'Recording saved as screenshot!', 
          severity: isVideo ? 'success' : 'info' 
        });
      } else {
        setSnackbarMessage({ text: result.error || 'Failed to stop recording', severity: 'error' });
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      setSnackbarMessage({ text: 'Error stopping recording', severity: 'error' });
    }
  };

  const handleFixError = (errorMessage: BuilderConsoleMessage) => {
    console.log('Attempting to fix error:', errorMessage);
    
    // Analyze the error message to determine the type of fix needed
    const errorText = errorMessage.message.toLowerCase();
    const source = errorMessage.source || '';
    
    // Common error patterns and their fixes
    if (errorText.includes('unexpected token') || errorText.includes('syntax error')) {
      // Handle syntax errors
      if (errorText.includes(';')) {
        console.log('Possible missing semicolon detected');
        // In a real implementation, we would:
        // 1. Load the file at the source location
        // 2. Add the missing semicolon
        // 3. Reload the page
      }
    } else if (errorText.includes('is not defined')) {
      // Handle undefined variable errors
      const match = errorMessage.message.match(/(\w+) is not defined/);
      if (match) {
        const variableName = match[1];
        console.log(`Variable ${variableName} is not defined`);
        // In a real implementation, we would:
        // 1. Check if it's a missing import
        // 2. Declare the variable
        // 3. Suggest common fixes
      }
    } else if (errorText.includes('cannot find module') || errorText.includes('module not found')) {
      // Handle missing module errors
      const match = errorMessage.message.match(/['"](.*?)['"]/);
      if (match) {
        const moduleName = match[1];
        console.log(`Module ${moduleName} not found`);
        // In a real implementation, we would:
        // 1. Check if the module needs to be installed
        // 2. Fix the import path
        // 3. Suggest alternatives
      }
    } else if (errorText.includes('cannot read property') || errorText.includes('cannot read properties')) {
      // Handle null/undefined property access
      console.log('Null or undefined property access detected');
      // In a real implementation, we would add null checks
    }
    
    // For now, just show an alert with the analysis
    // In a real implementation, this would apply the fix
    // Send the command to the Claude Code shell
    const commandText = `Fix this issue from the developer console: "${errorMessage.message}"`;
    
    if (shellPanelRef.current) {
      shellPanelRef.current.executeCommand(commandText);
    }
  };

  const handleHistoryClick = (event: React.MouseEvent<HTMLElement>) => {
    setHistoryAnchorEl(event.currentTarget);
  };

  const handleHistoryClose = () => {
    setHistoryAnchorEl(null);
  };

  const handleHistorySelect = (selectedUrl: string) => {
    setUrl(selectedUrl);
    if (webviewRef.current && webviewReady) {
      webviewRef.current.loadURL(selectedUrl);
    }
    handleHistoryClose();
  };

  return (
    <Box display="flex" flexDirection="column" height="100vh" bgcolor="background.default">
      <Paper
        elevation={0}
        sx={{
          p: 1,
          borderBottom: 1,
          borderColor: 'divider',
          borderRadius: 0,
          bgcolor: 'background.paper',
        }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton
            size="small"
            onClick={handleNavigateBack}
            disabled={!canGoBack}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleNavigateForward}
            disabled={!canGoForward}
          >
            <ArrowForwardIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={handleRefresh}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <Tooltip title="Take Screenshot">
            <IconButton
              size="small"
              onClick={handleCaptureScreenshot}
              disabled={!webviewReady}
            >
              <CameraAltIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!isRecording ? (
            <Tooltip title="Start Recording">
              <IconButton
                size="small"
                onClick={handleStartRecording}
                disabled={!webviewReady}
              >
                <VideocamIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip title="Stop Recording">
              <IconButton
                size="small"
                onClick={handleStopRecording}
                color="error"
              >
                <StopIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
          <ResponsiveSizeSelector
            currentSize={responsiveSize}
            onSizeChange={setResponsiveSize}
            disabled={!webviewReady}
          />
          <Box component="form" onSubmit={handleUrlSubmit} flex={1}>
            <TextField
              fullWidth
              size="small"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter URL..."
              variant="outlined"
              InputProps={{
                endAdornment: urlHistory.length > 0 ? (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={handleHistoryClick}
                      edge="end"
                      sx={{ p: 0.5 }}
                    >
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  pr: 0.5,
                },
              }}
            />
          </Box>
          <Menu
            anchorEl={historyAnchorEl}
            open={Boolean(historyAnchorEl)}
            onClose={handleHistoryClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            PaperProps={{
              sx: {
                maxHeight: 400,
                width: 500,
                mt: 1,
              },
            }}
          >
            {urlHistory.length > 0 ? (
              urlHistory.map((historyUrl, index) => (
                <MenuItem
                  key={index}
                  onClick={() => handleHistorySelect(historyUrl)}
                  sx={{
                    fontSize: '0.875rem',
                    py: 0.75,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography
                    variant="body2"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {historyUrl}
                  </Typography>
                </MenuItem>
              ))
            ) : (
              <MenuItem disabled>
                <Typography variant="body2" color="text.secondary">
                  No history yet
                </Typography>
              </MenuItem>
            )}
          </Menu>
        </Stack>
      </Paper>

      {loadingProgress !== null && (
        <LinearProgress
          variant="determinate"
          value={loadingProgress}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 1500,
            transition: 'opacity 0.3s',
            opacity: loadingProgress === 100 ? 0 : 1,
          }}
        />
      )}

      <Box display="flex" flex={1} overflow="hidden" position="relative" minHeight={0}>
        <Box
          flex={1}
          display="flex"
          flexDirection="column"
          alignItems="stretch"
          sx={{
            backgroundColor: responsiveSize ? '#f5f5f5' : 'background.default',
            position: 'relative',
            overflow: responsiveSize ? 'auto' : 'hidden',
            minHeight: 0,
          }}
        >
          {responsiveSize && (
            <Box
              sx={{
                position: 'absolute',
                top: 10,
                right: 10,
                zIndex: 10,
                display: 'flex',
                gap: 0.5,
                backgroundColor: 'background.paper',
                borderRadius: 1,
                boxShadow: 2,
                overflow: 'hidden',
                transition: 'all 0.2s ease-in-out',
              }}
            >
              <Tooltip title={`Zoom: ${Math.round(webviewZoom * 100)}%`}>
                <IconButton
                  size="small"
                  sx={{ 
                    borderRadius: 1,
                    color: webviewZoom !== 1 ? 'primary.main' : 'text.secondary'
                  }}
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Box
                className="zoom-controls"
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  maxWidth: 0,
                  opacity: 0,
                  transition: 'all 0.2s ease-in-out',
                  overflow: 'hidden',
                  alignItems: 'center'
                }}
              >
                <Divider orientation="vertical" flexItem />
                <IconButton
                  size="small"
                  onClick={() => setWebviewZoom(Math.max(0.25, webviewZoom - 0.1))}
                  disabled={webviewZoom <= 0.25}
                  sx={{ borderRadius: 1 }}
                >
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setWebviewZoom(Math.min(2, webviewZoom + 0.1))}
                  disabled={webviewZoom >= 2}
                  sx={{ borderRadius: 1 }}
                >
                  <ZoomInIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => {
                    setWebviewPosition({ x: 0, y: 0 });
                    setWebviewZoom(1);
                  }}
                  sx={{ borderRadius: 1 }}
                >
                  <CenterFocusStrongIcon fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          )}
          <Box
            ref={webviewContainerRef}
            sx={{
              position: responsiveSize ? 'absolute' : 'relative',
              left: responsiveSize ? '50%' : 0,
              top: responsiveSize ? '50%' : 0,
              transform: responsiveSize
                ? `translate(calc(-50% + ${webviewPosition.x}px), calc(-50% + ${webviewPosition.y}px)) scale(${webviewZoom})`
                : 'none',
              width: responsiveSize ? (webviewWidth || responsiveSize.width) : '100%',
              height: responsiveSize ? (webviewHeight || responsiveSize.height) : undefined,
              flex: responsiveSize ? undefined : 1,
              boxShadow: responsiveSize ? 3 : 'none',
              backgroundColor: 'background.paper',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
              transition: activeResize || isDraggingWebview ? 'none' : 'transform 0.2s ease-out'
            }}
          >
            {responsiveSize && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#e8e8e8',
                  px: 1.5,
                  py: 0.75,
                  borderBottom: 1,
                  borderColor: 'divider',
                  cursor: isDraggingWebview ? 'grabbing' : 'grab',
                  userSelect: 'none'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDraggingWebview(true);
                  
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startPosX = webviewPosition.x;
                  const startPosY = webviewPosition.y;
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    e.preventDefault();
                    const deltaX = e.clientX - startX;
                    const deltaY = e.clientY - startY;
                    
                    // Pan mode (default)
                    setWebviewPosition({
                      x: startPosX + deltaX / webviewZoom,
                      y: startPosY + deltaY / webviewZoom
                    });
                  };
                  
                  const handleMouseUp = () => {
                    setIsDraggingWebview(false);
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = '';
                  };
                  
                  document.body.style.cursor = 'grabbing';
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                <Box display="flex" alignItems="center" gap={0.5}>
                  <DragIndicatorIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    {responsiveSize.name}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {Math.round(webviewWidth || responsiveSize.width)} × {Math.round(webviewHeight || responsiveSize.height)}
                </Typography>
              </Box>
            )}
            <Box flex={1} position="relative" minHeight={0} display="flex">
              {webviewPreloadPath ? (
                <webview
                  ref={handleWebviewRef}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    flex: 'none',
                    display: 'block',
                  }}
                  webpreferences="contextIsolation=true, nodeIntegration=false, enableRemoteModule=false, sandbox=false"
                  partition="persist:browser"
                  src="about:blank"
                  preload={webviewPreloadPath}
                />
              ) : (
                <Box
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                  width="100%"
                  height="100%"
                >
                  <Typography variant="body2" color="text.secondary">
                    Initializing webview...
                  </Typography>
                </Box>
              )}
            </Box>
            
            {/* Resize borders for responsive mode */}
            {responsiveSize && (
              <>
                {/* Left border */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -4,
                    top: 30, // Below header
                    bottom: 0,
                    width: 8,
                    cursor: 'ew-resize',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveResize('left');
                    const startX = e.clientX;
                    const startWidth = webviewWidth || responsiveSize.width;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = startX - e.clientX;
                      const newWidth = Math.max(320, startWidth + deltaX);
                      setWebviewWidth(newWidth);
                    };
                    
                    const handleMouseUp = () => {
                      setActiveResize(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
                
                {/* Right border */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: -4,
                    top: 30, // Below header
                    bottom: 0,
                    width: 8,
                    cursor: 'ew-resize',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveResize('right');
                    const startX = e.clientX;
                    const startWidth = webviewWidth || responsiveSize.width;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = e.clientX - startX;
                      const newWidth = Math.max(320, startWidth + deltaX);
                      setWebviewWidth(newWidth);
                    };
                    
                    const handleMouseUp = () => {
                      setActiveResize(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
                
                {/* Bottom border */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: -4,
                    height: 8,
                    cursor: 'ns-resize',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveResize('bottom');
                    const startY = e.clientY;
                    const startHeight = webviewHeight || responsiveSize.height;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaY = e.clientY - startY;
                      const newHeight = Math.max(240, startHeight + deltaY);
                      setWebviewHeight(newHeight);
                    };
                    
                    const handleMouseUp = () => {
                      setActiveResize(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
                
                {/* Bottom-left corner */}
                <Box
                  sx={{
                    position: 'absolute',
                    left: -4,
                    bottom: -4,
                    width: 16,
                    height: 16,
                    cursor: 'nesw-resize',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveResize('bottom-left');
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = webviewWidth || responsiveSize.width;
                    const startHeight = webviewHeight || responsiveSize.height;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = startX - e.clientX;
                      const deltaY = e.clientY - startY;
                      const newWidth = Math.max(320, startWidth + deltaX);
                      const newHeight = Math.max(240, startHeight + deltaY);
                      setWebviewWidth(newWidth);
                      setWebviewHeight(newHeight);
                    };
                    
                    const handleMouseUp = () => {
                      setActiveResize(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
                
                {/* Bottom-right corner */}
                <Box
                  sx={{
                    position: 'absolute',
                    right: -4,
                    bottom: -4,
                    width: 16,
                    height: 16,
                    cursor: 'nwse-resize',
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setActiveResize('bottom-right');
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startWidth = webviewWidth || responsiveSize.width;
                    const startHeight = webviewHeight || responsiveSize.height;
                    
                    const handleMouseMove = (e: MouseEvent) => {
                      const deltaX = e.clientX - startX;
                      const deltaY = e.clientY - startY;
                      const newWidth = Math.max(320, startWidth + deltaX);
                      const newHeight = Math.max(240, startHeight + deltaY);
                      setWebviewWidth(newWidth);
                      setWebviewHeight(newHeight);
                    };
                    
                    const handleMouseUp = () => {
                      setActiveResize(null);
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    };
                    
                    document.addEventListener('mousemove', handleMouseMove);
                    document.addEventListener('mouseup', handleMouseUp);
                  }}
                />
              </>
            )}
          </Box>
        </Box>
        
        <Box
          sx={{
            position: 'relative',
            width: 8,
            cursor: 'col-resize',
            backgroundColor: 'divider',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: -4,
              right: -4,
              cursor: 'col-resize',
            }
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
            
            const startX = e.clientX;
            const startWidth = consoleWidth;
            
            const handleMouseMove = (e: MouseEvent) => {
              e.preventDefault();
              const deltaX = startX - e.clientX;
              const newWidth = Math.max(250, Math.min(600, startWidth + deltaX));
              setConsoleWidth(newWidth);
            };
            
            const handleMouseUp = () => {
              setIsResizing(false);
              document.removeEventListener('mousemove', handleMouseMove);
              document.removeEventListener('mouseup', handleMouseUp);
              document.body.style.cursor = '';
            };
            
            document.body.style.cursor = 'col-resize';
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
          }}
        >
          <Divider orientation="vertical" sx={{ width: '100%', border: 'none' }} />
        </Box>
        
        <Box 
          width={consoleWidth} 
          display="flex"
          flexDirection="column"
          sx={{ 
            userSelect: isResizing ? 'none' : 'auto',
            minWidth: 250,
            maxWidth: 600,
            overflow: 'hidden',
            flexShrink: 0
          }}
        >
          <Box display="flex" flexDirection="column" height="100%">
            <Box
              height={`${debugPanelHeight}%`}
              display="flex"
              flexDirection="column"
              overflow="hidden"
            >
              <DebugOutputPanel
                messages={messages}
                onClear={handleClearMessages}
                onFixError={handleFixError}
              />
            </Box>
            
            <Box
              sx={{
                position: 'relative',
                height: 8,
                cursor: 'row-resize',
                backgroundColor: 'divider',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: -4,
                  bottom: -4,
                  cursor: 'row-resize',
                }
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsResizingVertical(true);
                
                const startY = e.clientY;
                const containerRect = e.currentTarget.parentElement?.getBoundingClientRect();
                if (!containerRect) return;
                
                const containerHeight = containerRect.height;
                const startHeight = debugPanelHeight;
                
                const handleMouseMove = (e: MouseEvent) => {
                  e.preventDefault();
                  const deltaY = e.clientY - startY;
                  const deltaPercent = (deltaY / containerHeight) * 100;
                  const newHeight = Math.max(20, Math.min(80, startHeight + deltaPercent));
                  setDebugPanelHeight(newHeight);
                };
                
                const handleMouseUp = () => {
                  setIsResizingVertical(false);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = '';
                };
                
                document.body.style.cursor = 'row-resize';
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            >
              <Divider sx={{ width: '100%', border: 'none' }} />
            </Box>
            
            <Box
              height={`${100 - debugPanelHeight}%`}
              display="flex"
              flexDirection="column"
              overflow="hidden"
            >
              <ClaudeCodeShellPanel
                ref={shellPanelRef}
                {...(repoPath ? { initialRepo: repoPath } : {})}
              />
            </Box>
          </Box>
        </Box>
        
        {/* Invisible overlay during resize to capture all mouse events */}
        {(isResizing || isResizingVertical || isDraggingWebview || activeResize) && (
          <Box
            sx={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              cursor: isResizing ? 'col-resize' : 
                      isResizingVertical ? 'row-resize' : 
                      isDraggingWebview ? 'grabbing' :
                      activeResize === 'left' || activeResize === 'right' ? 'ew-resize' :
                      activeResize === 'bottom' ? 'ns-resize' :
                      activeResize === 'bottom-left' ? 'nesw-resize' :
                      activeResize === 'bottom-right' ? 'nwse-resize' : 'default',
              zIndex: 9999,
              userSelect: 'none',
            }}
          />
        )}
      </Box>
      
      {/* Create Moment Modal */}
      <CreateMomentModal
        open={createMomentOpen}
        onClose={() => {
          setCreateMomentOpen(false);
          setCaptureFile(null);
        }}
        organizationId=""
        onSuccess={() => {
          setSnackbarMessage({ text: 'Moment created successfully!', severity: 'success' });
          setCaptureFile(null);
        }}
        initialFile={captureFile}
      />
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={4000}
        onClose={() => setSnackbarMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {snackbarMessage ? (
          <Alert 
            onClose={() => setSnackbarMessage(null)} 
            severity={snackbarMessage.severity}
            sx={{ width: '100%' }}
          >
            {snackbarMessage.text}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Box>
  );
};
