import React, { useRef, useEffect } from 'react';
import { Box, Paper, Typography, IconButton, Stack } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import TerminalIcon from '@mui/icons-material/Terminal';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

interface ClaudeShellPanelProps {
  shellId: string;
}

export const ClaudeShellPanel: React.FC<ClaudeShellPanelProps> = ({ shellId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
      scrollback: 10000,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(terminalRef.current);

    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;

    // Delay fit to ensure container has dimensions
    setTimeout(() => {
      try {
        fitAddon.fit();
        const dimensions = fitAddon.proposeDimensions();
        if (dimensions && shellId) {
          window.browserAPI.claudeShellResize(shellId, dimensions.cols, dimensions.rows);
        }
      } catch (err) {
        console.error('Failed to fit terminal:', err);
      }
    }, 0);

    // Handle terminal input
    terminal.onData((data) => {
      if (shellId) {
        window.browserAPI.claudeShellWrite(shellId, data);
      }
    });

    // Handle resize
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const dimensions = fitAddonRef.current.proposeDimensions();
          if (dimensions && shellId) {
            window.browserAPI.claudeShellResize(shellId, dimensions.cols, dimensions.rows);
          }
        } catch (err) {
          console.error('Failed to resize terminal:', err);
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      terminal.dispose();
    };
  }, []);

  // Handle shell output
  useEffect(() => {
    const handleOutput = (id: string, data: string) => {
      if (id === shellId && xtermRef.current) {
        xtermRef.current.write(data);
      }
    };

    const handleError = (id: string, error: string) => {
      if (id === shellId && xtermRef.current) {
        xtermRef.current.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
      }
    };

    const handleExit = (id: string, code: number | null, signal: string | null) => {
      if (id === shellId && xtermRef.current) {
        xtermRef.current.write(`\r\n\x1b[33mShell exited with code ${code}\x1b[0m\r\n`);
      }
    };

    window.browserAPI.onClaudeShellOutput(handleOutput);
    window.browserAPI.onClaudeShellError(handleError);
    window.browserAPI.onClaudeShellExit(handleExit);
  }, [shellId]);

  const handleClear = () => {
    if (xtermRef.current) {
      xtermRef.current.clear();
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#1e1e1e' }}>
      {/* Header */}
      <Paper sx={{ p: 1, borderRadius: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <TerminalIcon fontSize="small" />
            <Typography variant="body2">Claude Code Terminal</Typography>
          </Stack>
          <IconButton onClick={handleClear} size="small" title="Clear terminal">
            <ClearIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Paper>

      {/* Terminal */}
      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          overflow: 'hidden',
          bgcolor: '#1e1e1e',
          '& .xterm': {
            height: '100%',
            padding: '8px',
          },
        }}
      />
    </Box>
  );
};
