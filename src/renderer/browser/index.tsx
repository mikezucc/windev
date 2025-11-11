import React from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { BrowserPage } from './BrowserPage';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const root = createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserPage />
    </ThemeProvider>
  </React.StrictMode>
);
