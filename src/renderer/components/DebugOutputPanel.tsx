import React from 'react';
import { Box, Paper, Typography, IconButton, Stack, Tooltip } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import BuildIcon from '@mui/icons-material/Build';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import { BuilderConsoleMessage } from '../../shared/ipc-channels';

interface DebugOutputPanelProps {
  messages: BuilderConsoleMessage[];
  onClear: () => void;
  onFixError?: (message: BuilderConsoleMessage) => void;
}

export const DebugOutputPanel: React.FC<DebugOutputPanelProps> = ({
  messages,
  onClear,
  onFixError,
}) => {
  const getMessageIcon = (type: BuilderConsoleMessage['type']) => {
    switch (type) {
      case 'error':
        return <ErrorIcon sx={{ fontSize: 14, color: '#f07178' }} />;
      case 'warning':
        return <WarningIcon sx={{ fontSize: 14, color: '#ffcb6b' }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 14, color: '#82aaff' }} />;
      default:
        return null;
    }
  };

  const getMessageColor = (type: BuilderConsoleMessage['type']) => {
    switch (type) {
      case 'error':
        return '#f07178';
      case 'warning':
        return '#ffcb6b';
      case 'info':
        return '#82aaff';
      case 'debug':
        return '#999';
      default:
        return '#e0e0e0';
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      sx={{
        bgcolor: '#0d0d0d',
        color: '#e0e0e0',
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 0.5,
          borderBottom: 1,
          borderColor: '#2a2a2a',
          borderRadius: 0,
          bgcolor: '#1a1a1a',
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.75rem' }}>
            Console Output
          </Typography>
          <Stack direction="row" spacing={0.5}>
            <Tooltip title="Clear output">
              <IconButton
                size="small"
                onClick={onClear}
                sx={{ p: 0.5, color: '#666', '&:hover': { color: '#e0e0e0' } }}
              >
                <ClearIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
      </Paper>

      <Box
        flex={1}
        sx={{
          overflow: 'auto',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '0.75rem',
          p: 1,
        }}
      >
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
            No console messages yet
          </Typography>
        ) : (
          messages.map((msg, index) => (
            <Box
              key={index}
              sx={{
                mb: 0.5,
                p: 0.5,
                borderLeft: 3,
                borderColor: getMessageColor(msg.type),
                bgcolor: 'rgba(255,255,255,0.02)',
                '&:hover': {
                  bgcolor: 'rgba(255,255,255,0.05)',
                },
              }}
            >
              <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                {getMessageIcon(msg.type)}
                <Box flex={1}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.7rem',
                      color: getMessageColor(msg.type),
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.message}
                  </Typography>
                  {msg.source && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        color: '#666',
                        display: 'block',
                        mt: 0.25,
                      }}
                    >
                      {msg.source}
                      {msg.lineNumber && `:${msg.lineNumber}`}
                      {msg.columnNumber && `:${msg.columnNumber}`}
                    </Typography>
                  )}
                </Box>
                {msg.type === 'error' && onFixError && (
                  <Tooltip title="Attempt to fix">
                    <IconButton
                      size="small"
                      onClick={() => onFixError(msg)}
                      sx={{ p: 0.25, color: '#666', '&:hover': { color: '#82aaff' } }}
                    >
                      <BuildIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};
