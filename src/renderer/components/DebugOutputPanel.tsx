import React, { useState, useMemo } from 'react';
import { Box, Paper, Typography, IconButton, Stack, Tooltip, TextField, Chip, InputAdornment } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import BuildIcon from '@mui/icons-material/Build';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import SearchIcon from '@mui/icons-material/Search';
import { BuilderConsoleMessage } from '../../shared/ipc-channels';

interface DebugOutputPanelProps {
  messages: BuilderConsoleMessage[];
  onClear: () => void;
  onFixError?: (message: BuilderConsoleMessage) => void;
}

type MessageType = BuilderConsoleMessage['type'];

export const DebugOutputPanel: React.FC<DebugOutputPanelProps> = ({
  messages,
  onClear,
  onFixError,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<MessageType>>(new Set(['error']));

  const toggleFilter = (type: MessageType) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Clean up webpack and internal path prefixes
  const cleanPath = (path: string): string => {
    if (!path) return path;

    // Remove webpack-internal:// prefix and variations
    let cleaned = path.replace(/webpack-internal:\/\/\/\([^)]+\)\//g, '');
    cleaned = cleaned.replace(/webpack-internal:\/\/\//g, '');

    // Remove file:// protocol
    cleaned = cleaned.replace(/^file:\/\//g, '');

    // Remove common node_modules verbose paths
    cleaned = cleaned.replace(/\/node_modules\//g, 'node_modules/');

    return cleaned;
  };

  const cleanMessage = (message: string): string => {
    if (!message) return message;

    // Clean webpack paths in error messages
    let cleaned = message.replace(/webpack-internal:\/\/\/\([^)]+\)\//g, '');
    cleaned = cleaned.replace(/webpack-internal:\/\/\//g, '');

    return cleaned;
  };

  // Filter and search messages
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Filter by type
      if (!activeFilters.has(msg.type)) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const messageText = msg.message.toLowerCase();
        const sourceText = (msg.source || '').toLowerCase();
        return messageText.includes(query) || sourceText.includes(query);
      }

      return true;
    });
  }, [messages, activeFilters, searchQuery]);
  const getMessageIcon = (type: BuilderConsoleMessage['type']) => {
    switch (type) {
      case 'error':
        return <ErrorIcon sx={{ fontSize: 14, color: '#d32f2f' }} />;
      case 'warning':
        return <WarningIcon sx={{ fontSize: 14, color: '#f57c00' }} />;
      case 'info':
        return <InfoIcon sx={{ fontSize: 14, color: '#1976d2' }} />;
      default:
        return null;
    }
  };

  const getMessageColor = (type: BuilderConsoleMessage['type']) => {
    switch (type) {
      case 'error':
        return '#d32f2f';
      case 'warning':
        return '#f57c00';
      case 'info':
        return '#1976d2';
      case 'debug':
        return '#757575';
      default:
        return '#424242';
    }
  };

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100%"
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
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
          {/* Clear Button */}
          <Tooltip title="Clear output">
            <IconButton
              size="small"
              onClick={onClear}
              sx={{ p: 0.5 }}
            >
              <ClearIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          {/* Filter Chips */}
          <Stack direction="row" spacing={0.5}>
            <Chip
              icon={<ErrorIcon sx={{ fontSize: 12 }} />}
              label="Errors"
              size="small"
              onClick={() => toggleFilter('error')}
              variant={activeFilters.has('error') ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.65rem',
                height: 22,
                borderColor: '#d32f2f',
                color: activeFilters.has('error') ? '#fff' : '#d32f2f',
                bgcolor: activeFilters.has('error') ? '#d32f2f' : 'transparent',
                '& .MuiChip-icon': {
                  color: activeFilters.has('error') ? '#fff' : '#d32f2f',
                  ml: 0.5,
                },
                '& .MuiChip-label': {
                  px: 0.75,
                }
              }}
            />
            <Chip
              icon={<WarningIcon sx={{ fontSize: 12 }} />}
              label="Warnings"
              size="small"
              onClick={() => toggleFilter('warning')}
              variant={activeFilters.has('warning') ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.65rem',
                height: 22,
                borderColor: '#f57c00',
                color: activeFilters.has('warning') ? '#fff' : '#f57c00',
                bgcolor: activeFilters.has('warning') ? '#f57c00' : 'transparent',
                '& .MuiChip-icon': {
                  color: activeFilters.has('warning') ? '#fff' : '#f57c00',
                  ml: 0.5,
                },
                '& .MuiChip-label': {
                  px: 0.75,
                }
              }}
            />
            <Chip
              icon={<InfoIcon sx={{ fontSize: 12 }} />}
              label="Info"
              size="small"
              onClick={() => toggleFilter('info')}
              variant={activeFilters.has('info') ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.65rem',
                height: 22,
                borderColor: '#1976d2',
                color: activeFilters.has('info') ? '#fff' : '#1976d2',
                bgcolor: activeFilters.has('info') ? '#1976d2' : 'transparent',
                '& .MuiChip-icon': {
                  color: activeFilters.has('info') ? '#fff' : '#1976d2',
                  ml: 0.5,
                },
                '& .MuiChip-label': {
                  px: 0.75,
                }
              }}
            />
            <Chip
              label="Log"
              size="small"
              onClick={() => toggleFilter('log')}
              variant={activeFilters.has('log') ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.65rem',
                height: 22,
                borderColor: '#757575',
                color: activeFilters.has('log') ? '#fff' : '#757575',
                bgcolor: activeFilters.has('log') ? '#757575' : 'transparent',
                '& .MuiChip-label': {
                  px: 0.75,
                }
              }}
            />
            <Chip
              label="Debug"
              size="small"
              onClick={() => toggleFilter('debug')}
              variant={activeFilters.has('debug') ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.65rem',
                height: 22,
                borderColor: '#9e9e9e',
                color: activeFilters.has('debug') ? '#fff' : '#9e9e9e',
                bgcolor: activeFilters.has('debug') ? '#9e9e9e' : 'transparent',
                '& .MuiChip-label': {
                  px: 0.75,
                }
              }}
            />
          </Stack>

          {/* Search Input */}
          <TextField
            size="small"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              flex: 1,
              minWidth: 120,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1,
                fontSize: '0.75rem',
                height: 28,
                bgcolor: 'background.default',
              },
              '& .MuiOutlinedInput-input': {
                py: 0.5,
              }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </Paper>

      <Box
        flex={1}
        sx={{
          overflow: 'auto',
          fontFamily: 'Consolas, "Courier New", monospace',
          fontSize: '0.75rem',
          p: 1.5,
        }}
      >
        {filteredMessages.length === 0 && messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
            No console messages yet
          </Typography>
        ) : filteredMessages.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', fontStyle: 'italic' }}>
            No messages match your filters or search
          </Typography>
        ) : (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontSize: '0.7rem' }}>
              Showing {filteredMessages.length} of {messages.length} messages
            </Typography>
            {filteredMessages.map((msg, index) => (
            <Box
              key={index}
              sx={{
                mb: 0.5,
                p: 1,
                borderLeft: 3,
                borderColor: getMessageColor(msg.type),
                bgcolor: 'rgba(0,0,0,0.02)',
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
                    {cleanMessage(msg.message)}
                  </Typography>
                  {msg.source && (
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.65rem',
                        color: 'text.secondary',
                        display: 'block',
                        mt: 0.25,
                      }}
                    >
                      {cleanPath(msg.source)}
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
                      sx={{ p: 0.25 }}
                    >
                      <BuildIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Stack>
            </Box>
          ))}
          </>
        )}
      </Box>
    </Box>
  );
};
