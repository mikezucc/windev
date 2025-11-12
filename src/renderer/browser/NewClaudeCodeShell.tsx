import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Stack,
  Tooltip,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Chip,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import TerminalIcon from '@mui/icons-material/Terminal';
import FolderIcon from '@mui/icons-material/Folder';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { Repository } from '../../shared/ipc-channels';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useDropzone } from 'react-dropzone';
import '@xterm/xterm/css/xterm.css';

interface ClaudeCodeShellPanelProps {
  onCommandExecute?: (command: string) => Promise<string>;
  initialRepo?: string;
}

export const ClaudeCodeShellPanel = React.forwardRef<ClaudeCodeShellPanelRef, ClaudeCodeShellPanelProps>(
  ({ onCommandExecute, initialRepo }, ref) => {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [shellId, setShellId] = useState<string | null>(null);
  const [isShellReady, setIsShellReady] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const scrollLockRef = useRef<boolean>(false);

  // Check if we're in the builder browser context
  const isBuilderContext = !window.electronAPI && window.builderAPI;

  // Handle file drop
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!shellId || !isShellReady || acceptedFiles.length === 0) return;

    // Convert files to paths and escape them properly
    const filePaths = acceptedFiles.map(file => {
      // For browser File objects, we get the path from the File object
      const path = (file as any).path || file.name;
      // Escape spaces and special characters in the path
      return path.includes(' ') ? `"${path}"` : path;
    });

    // Send the file paths to the terminal
    const pathsString = filePaths.join(' ');
    try {
      if (isBuilderContext) {
        await window.builderAPI.claudeShellWrite(shellId, pathsString);
      } else {
        await window.electronAPI.claudeShellWrite(shellId, pathsString);
      }
    } catch (error) {
      console.error('Error sending file paths to shell:', error);
    }
  }, [shellId, isShellReady, isBuilderContext]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    onDropAccepted: () => setIsDragging(false),
    onDropRejected: () => setIsDragging(false),
  });

  // Load repositories on mount
  useEffect(() => {
    const loadRepositories = async () => {
      try {
        let repos;
        if (isBuilderContext) {
          repos = await window.builderAPI.getRepositories();
        } else {
          repos = await window.electronAPI.getRepositories();
        }
        
        setRepositories(repos);
        if (initialRepo) {
          // Use the initial repo if provided and it exists in the list
          const repoExists = repos.some(r => r.path === initialRepo);
          if (repoExists) {
            setSelectedRepo(initialRepo);
          } else if (repos.length > 0 && !selectedRepo) {
            setSelectedRepo(repos[0].path);
          }
        } else if (repos.length > 0 && !selectedRepo) {
          setSelectedRepo(repos[0].path);
        }
      } catch (error) {
        console.error('Failed to load repositories:', error);
      }
    };
    loadRepositories();
  }, [isBuilderContext, initialRepo]);

  // Listen for repository path from builder context
  useEffect(() => {
    if (!isBuilderContext || !window.builderAPI) return;

    const handleSetRepoPath = (path: string) => {
      console.log('ClaudeCodeShellPanel received repository path:', path);
      // Check if this repo exists in our list
      const repoExists = repositories.some(repo => repo.path === path);
      if (repoExists || repositories.length === 0) {
        // If repo exists or we haven't loaded repos yet, set it
        setSelectedRepo(path);
      }
    };
    
    window.builderAPI.onSetRepoPath(handleSetRepoPath);
    
    return () => {
      window.builderAPI.removeAllListeners('set-repo-path');
    };
  }, [isBuilderContext, repositories]);

  // Add right-click context menu handler
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();
    
    if (!xtermRef.current) return;
    
    // Create custom context menu
    const existingMenu = document.querySelector('.terminal-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const menu = document.createElement('div');
    menu.className = 'terminal-context-menu';
    menu.style.cssText = `
      position: fixed;
      left: ${e.clientX}px;
      top: ${e.clientY}px;
      background: #2a2a2a;
      border: 1px solid #3a3a3a;
      border-radius: 4px;
      padding: 4px 0;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
    `;

    const hasSelection = xtermRef.current.hasSelection();

    // Copy option
    if (hasSelection) {
      const copyItem = document.createElement('div');
      copyItem.style.cssText = `
        padding: 6px 16px;
        cursor: pointer;
        color: #e0e0e0;
        user-select: none;
      `;
      copyItem.textContent = 'Copy';
      copyItem.onmouseover = () => copyItem.style.background = '#3a3a3a';
      copyItem.onmouseout = () => copyItem.style.background = 'transparent';
      copyItem.onclick = async () => {
        const selection = xtermRef.current?.getSelection();
        if (selection) {
          try {
            await navigator.clipboard.writeText(selection);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        }
        menu.remove();
      };
      menu.appendChild(copyItem);
    }

    // Paste option
    const pasteItem = document.createElement('div');
    pasteItem.style.cssText = `
      padding: 6px 16px;
      cursor: pointer;
      color: #e0e0e0;
      user-select: none;
    `;
    pasteItem.textContent = 'Paste';
    pasteItem.onmouseover = () => pasteItem.style.background = '#3a3a3a';
    pasteItem.onmouseout = () => pasteItem.style.background = 'transparent';
    pasteItem.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text && shellId && isShellReady) {
          if (isBuilderContext) {
            await window.builderAPI.claudeShellWrite(shellId, text);
          } else {
            await window.electronAPI.claudeShellWrite(shellId, text);
          }
        }
      } catch (err) {
        console.error('Failed to paste:', err);
      }
      menu.remove();
    };
    menu.appendChild(pasteItem);

    // Clear option
    const separator = document.createElement('div');
    separator.style.cssText = `
      height: 1px;
      background: #3a3a3a;
      margin: 4px 0;
    `;
    menu.appendChild(separator);

    const clearItem = document.createElement('div');
    clearItem.style.cssText = `
      padding: 6px 16px;
      cursor: pointer;
      color: #e0e0e0;
      user-select: none;
    `;
    clearItem.textContent = 'Clear';
    clearItem.onmouseover = () => clearItem.style.background = '#3a3a3a';
    clearItem.onmouseout = () => clearItem.style.background = 'transparent';
    clearItem.onclick = () => {
      xtermRef.current?.clear();
      menu.remove();
    };
    menu.appendChild(clearItem);

    document.body.appendChild(menu);

    // Remove menu when clicking elsewhere
    const removeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node)) {
        menu.remove();
        document.removeEventListener('click', removeMenu);
      }
    };
    setTimeout(() => {
      document.addEventListener('click', removeMenu);
    }, 0);
  }, [shellId, isShellReady, isBuilderContext]);

  // Initialize xterm.js
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#e0e0e0',
        cursor: '#e0e0e0',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#4a4a4a',
        black: '#2d2d2d',
        red: '#f07178',
        green: '#c3e88d',
        yellow: '#ffcb6b',
        blue: '#82aaff',
        magenta: '#c792ea',
        cyan: '#89ddff',
        white: '#e0e0e0',
        brightBlack: '#545454',
        brightRed: '#f07178',
        brightGreen: '#c3e88d',
        brightYellow: '#ffcb6b',
        brightBlue: '#82aaff',
        brightMagenta: '#c792ea',
        brightCyan: '#89ddff',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Consolas, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1,
      letterSpacing: 0,
      scrollback: 10000,
      smoothScrollDuration: 0,
      scrollOnUserInput: false,
    });

    // Add fit addon
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    fitAddonRef.current = fitAddon;

    // Add web links addon
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(webLinksAddon);

    // Open terminal in the DOM
    term.open(terminalRef.current);
    xtermRef.current = term;

    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 0);
    
    // Focus the terminal and set up focus handling
    term.focus();
    
    // Add scroll event listener to detect manual scrolling
    term.onScroll(() => {
      if (!xtermRef.current) return;
      
      const buffer = xtermRef.current.buffer.active;
      const isAtBottom = buffer.viewportY === buffer.baseY;
      
      // User is manually scrolling, so lock scroll position
      scrollLockRef.current = !isAtBottom;
    });
    
    // // Prevent terminal scrolling with keyboard
    // const viewport = terminalRef.current.querySelector('.xterm-viewport');
    // if (viewport) {
    //   viewport.addEventListener('keydown', (e) => {
    //     if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes((e as KeyboardEvent).key)) {
    //       e.preventDefault();
    //       e.stopPropagation();
    //     }
    //   }, true);
    // }

    return () => {
      term.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // Attach context menu handler
  useEffect(() => {
    if (!terminalRef.current) return;

    terminalRef.current.addEventListener('contextmenu', handleContextMenu);

    return () => {
      if (terminalRef.current) {
        terminalRef.current.removeEventListener('contextmenu', handleContextMenu);
      }
    };
  }, [handleContextMenu]);

  // Handle terminal resize
  useEffect(() => {
    if (!fitAddonRef.current || !shellId || !xtermRef.current) return;

    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit();
        const { cols, rows } = xtermRef.current;
        
        // Send resize to PTY
        if (isBuilderContext && (window.builderAPI as any).claudeShellResize) {
          (window.builderAPI as any).claudeShellResize(shellId, cols, rows);
        } else if (!isBuilderContext && (window.electronAPI as any).claudeShellResize) {
          (window.electronAPI as any).claudeShellResize(shellId, cols, rows);
        }
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Initial resize
    handleResize();

    return () => {
      resizeObserver.disconnect();
    };
  }, [shellId, isBuilderContext]);

  // Set up shell event listeners
  useEffect(() => {
    if (isBuilderContext && !window.builderAPI) {
      return;
    }

    const handleOutput = (id: string, output: string) => {
      if (id !== shellId || !xtermRef.current) return;
      
      // If scroll is locked (user has scrolled up), don't auto-scroll
      if (scrollLockRef.current) {
        xtermRef.current.write(output);
        return;
      }
      
      // Store current viewport position before writing
      const buffer = xtermRef.current.buffer.active;
      const viewportY = buffer.viewportY;
      const baseY = buffer.baseY;
      
      // Check if we're at the bottom
      const isAtBottom = viewportY === baseY;
      
      // Write the output
      xtermRef.current.write(output);
      
      // Only auto-scroll if we were at the bottom and scroll isn't locked
      if (isAtBottom && !scrollLockRef.current) {
        // Use setTimeout to ensure the write has completed
        setTimeout(() => {
          if (xtermRef.current && !scrollLockRef.current) {
            xtermRef.current.scrollToBottom();
          }
        }, 0);
      }
    };

    const handleError = (id: string, error: string) => {
      if (id !== shellId || !xtermRef.current) return;
      xtermRef.current.write(`\x1b[31mError: ${error}\x1b[0m\n`);
    };

    const handleExit = (id: string, code: number | null, signal: string | null) => {
      if (id !== shellId || !xtermRef.current) return;
      
      setIsShellReady(false);
      setShellId(null);
      
      const exitMessage = `\n\x1b[33mClaude shell exited${code !== null ? ` with code ${code}` : ''}${signal ? ` (signal: ${signal})` : ''}\x1b[0m\n`;
      xtermRef.current.write(exitMessage);
    };

    if (isBuilderContext) {
      window.builderAPI.onClaudeShellOutput(handleOutput);
      window.builderAPI.onClaudeShellError(handleError);
      window.builderAPI.onClaudeShellExit(handleExit);
    } else {
      window.electronAPI.onClaudeShellOutput(handleOutput);
      window.electronAPI.onClaudeShellError(handleError);
      window.electronAPI.onClaudeShellExit(handleExit);
    }

    return () => {
      // Clean up listeners
    };
  }, [shellId, isBuilderContext]);

  // Handle terminal input
  useEffect(() => {
    if (!xtermRef.current) return;

    const disposable = xtermRef.current.onData(async (data: string) => {
      if (!shellId || !isShellReady) return;

      try {
        let result;
        if (isBuilderContext) {
          result = await window.builderAPI.claudeShellWrite(shellId, data);
        } else {
          result = await window.electronAPI.claudeShellWrite(shellId, data);
        }
        if (!result.success) {
          console.error('Failed to send data to shell');
        }
      } catch (error) {
        console.error('Error sending data:', error);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [shellId, isShellReady, isBuilderContext]);

  const initializeShell = useCallback(async (repoPath?: string) => {
    const targetRepo = repoPath || selectedRepo;
    if (!targetRepo || shellId) return;
    
    try {
      if (xtermRef.current) {
        xtermRef.current.write(`\x1b[32mInitializing Claude Code session in ${targetRepo}...\x1b[0m\n`);
      }
      
      let result;
      if (isBuilderContext) {
        result = await window.builderAPI.claudeShellCreate(targetRepo);
      } else {
        result = await window.electronAPI.claudeShellCreate(targetRepo);
      }
      if (result.success && result.shellId) {
        setShellId(result.shellId);
        setIsShellReady(true);
      } else {
        if (xtermRef.current) {
          xtermRef.current.write(`\x1b[31mError: ${result.error || 'Failed to create shell'}\x1b[0m\n`);
        }
      }
    } catch (error) {
      console.error('Failed to initialize shell:', error);
      if (xtermRef.current) {
        xtermRef.current.write(`\x1b[31mError: Failed to initialize Claude shell\x1b[0m\n`);
      }
    }
  }, [shellId, isBuilderContext, selectedRepo]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  const handleRestart = async () => {
    if (shellId) {
      if (isBuilderContext) {
        await window.builderAPI.claudeShellDestroy(shellId);
      } else {
        await window.electronAPI.claudeShellDestroy(shellId);
      }
      setShellId(null);
      setIsShellReady(false);
    }
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    await initializeShell(selectedRepo);
  };

  const handleRepoChange = async (newRepo: string) => {
    // Don't do anything if selecting the same repo
    if (newRepo === selectedRepo) return;

    // Destroy current shell if it exists
    if (shellId) {
      if (isBuilderContext) {
        await window.builderAPI.claudeShellDestroy(shellId);
      } else {
        await window.electronAPI.claudeShellDestroy(shellId);
      }
      setShellId(null);
      setIsShellReady(false);
    }
    
    // Clear the terminal
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
    
    // Update the selected repo
    setSelectedRepo(newRepo);
    
    // Initialize new shell with the new repository
    setTimeout(async () => {
      await initializeShell(newRepo);
    }, 100);
  };

  // Initialize shell when repo is selected
  useEffect(() => {
    if (selectedRepo && !shellId && xtermRef.current) {
      initializeShell(selectedRepo);
    }
  }, [selectedRepo, shellId]);

  // Cleanup shell on unmount
  useEffect(() => {
    return () => {
      if (shellId) {
        if (isBuilderContext) {
          window.builderAPI.claudeShellDestroy(shellId);
        } else {
          window.electronAPI.claudeShellDestroy(shellId);
        }
      }
    };
  }, [shellId, isBuilderContext]);
  
  // Prevent arrow keys from scrolling the page
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If the terminal is focused and arrow keys are pressed, prevent default
      // if (xtermRef.current && document.activeElement?.closest('.xterm')) {
      //   if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
      //     e.preventDefault();
      //     e.stopPropagation();
      //   }
      // }
    };
    
    // Add event listener to window to catch all keyboard events
    window.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Public method to send commands programmatically
  React.useImperativeHandle(
    ref,
    () => ({
      executeCommand: async (command: string) => {
        if (xtermRef.current && shellId && isShellReady) {
          // Send command with newline
          const data = command + '\r';
          if (isBuilderContext) {
            await window.builderAPI.claudeShellWrite(shellId, data);
          } else {
            await window.electronAPI.claudeShellWrite(shellId, data);
          }
        }
      },
    }),
    [shellId, isShellReady, isBuilderContext]
  );

  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      height="100%" 
      width="100%" 
      sx={{ 
        bgcolor: '#0d0d0d',
        color: '#e0e0e0',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderBottom: 1,
          borderColor: '#2a2a2a',
          borderRadius: 0,
          width: '100%',
          boxSizing: 'border-box',
          bgcolor: '#1a1a1a',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <TerminalIcon sx={{ fontSize: 16, color: '#82aaff' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem', color: '#e0e0e0' }}>
              Claude Code
            </Typography>
            {shellId && isShellReady && (
              <Chip
                label="Connected"
                size="small"
                sx={{ 
                  height: 16, 
                  fontSize: '0.65rem',
                  bgcolor: '#2d4a2b',
                  color: '#c3e88d',
                  '& .MuiChip-label': {
                    px: 1
                  }
                }}
              />
            )}
          </Stack>
          <Stack direction="row" spacing={0.5}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                  value={selectedRepo}
                  onChange={(e) => handleRepoChange(e.target.value)}
                  displayEmpty
                  startAdornment={
                    <InputAdornment position="start">
                      <FolderIcon sx={{ fontSize: 14, color: '#ffcb6b' }} />
                    </InputAdornment>
                  }
                  sx={{ 
                    fontSize: '0.7rem',
                    height: 24,
                    bgcolor: '#0d0d0d',
                    color: '#e0e0e0',
                    '& .MuiSelect-select': {
                      py: 0.5,
                      display: 'flex',
                      alignItems: 'center'
                    },
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#3a3a3a',
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#4a4a4a',
                    },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#5a5a5a',
                    },
                    '& .MuiSvgIcon-root': {
                      color: '#666'
                    }
                  }}
                >
                  {repositories.length === 0 ? (
                    <MenuItem value="" disabled>
                      <Typography variant="caption" color="text.secondary">
                        No repositories available
                      </Typography>
                    </MenuItem>
                  ) : (
                    repositories.map((repo) => (
                      <MenuItem key={repo.id} value={repo.path}>
                        <Typography variant="caption" noWrap>
                          {repo.name}
                        </Typography>
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>
            <Tooltip title="Restart shell">
              <IconButton size="small" onClick={handleRestart} sx={{ p: 0.5, color: '#666', '&:hover': { color: '#e0e0e0' } }}>
                <RestartAltIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear output">
              <IconButton size="small" onClick={handleClear} sx={{ p: 0.5, color: '#666', '&:hover': { color: '#e0e0e0' } }}>
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>
      
      <Box
        {...getRootProps()}
        ref={terminalRef}
        flex={1}
        onKeyDown={(e) => {
          // Prevent default scrolling behavior for arrow keys and other navigation keys
          if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            e.stopPropagation();
          }
          // Ensure terminal stays focused
          // if (xtermRef.current) {
          //   xtermRef.current.focus();
          // }
        }}
        onClick={() => {
          // Focus terminal on click
          if (xtermRef.current) {
            xtermRef.current.focus();
          }
        }}
        sx={{
          width: '100%',
          height: '100%',
          outline: 'none',
          position: 'relative',
          overflow: 'hidden',
          '& .xterm': {
            padding: '8px',
            height: '100%',
          },
          '& .xterm-viewport': {
            backgroundColor: '#1a1a1a',
            scrollBehavior: 'auto',
          },
          '& .xterm-screen': {
            outline: 'none',
          },
          ...(isDragging && {
            '&::after': {
              content: '"Drop files here"',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(130, 170, 255, 0.1)',
              border: '2px dashed #82aaff',
              borderRadius: '4px',
              fontSize: '1.2rem',
              color: '#82aaff',
              pointerEvents: 'none',
              zIndex: 10,
            }
          })
        }}
        tabIndex={-1}
      >
        <input {...getInputProps()} style={{ display: 'none' }} />
      </Box>
    </Box>
  );
});

ClaudeCodeShellPanel.displayName = 'ClaudeCodeShellPanel';

// Export a ref type for external usage
export interface ClaudeCodeShellPanelRef {
  executeCommand: (command: string) => Promise<void>;
}
