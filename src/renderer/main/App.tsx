import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Container,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { Delete, Edit, OpenInBrowser, Add, Folder } from '@mui/icons-material';
import { Service } from '../../shared/ipc-channels';

// Helper to replace home directory with ~
const formatPath = (path: string): string => {
  if (!path) return path;
  // Get the home directory from the path (e.g., /Users/michaelzuccarino)
  const homePattern = /^\/Users\/[^/]+/;
  return path.replace(homePattern, '~');
};

declare global {
  interface Window {
    electronAPI: {
      getServices: () => Promise<{ success: boolean; services?: Service[]; error?: string }>;
      addService: (service: Omit<Service, 'id'>) => Promise<{ success: boolean; service?: Service; error?: string }>;
      updateService: (service: Service) => Promise<{ success: boolean; service?: Service; error?: string }>;
      removeService: (serviceId: string) => Promise<{ success: boolean; error?: string }>;
      openBrowserWindow: (options: any) => Promise<{ success: boolean; windowId?: string; error?: string }>;
      selectDirectory: () => Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}

interface ServiceFormData {
  name: string;
  url: string;
  repoPath: string;
  shellCommand: 'claude' | 'codex';
  windowPrefs: {
    width: number;
    height: number;
  };
}

export default function App() {
  const [services, setServices] = useState<Service[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    url: '',
    repoPath: '',
    shellCommand: 'claude',
    windowPrefs: {
      width: 1400,
      height: 900,
    },
  });

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    const result = await window.electronAPI.getServices();
    if (result.success && result.services) {
      setServices(result.services);
    }
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        url: service.url,
        repoPath: service.repoPath,
        shellCommand: service.shellCommand || 'claude',
        windowPrefs: service.windowPrefs,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        url: '',
        repoPath: '',
        shellCommand: 'claude',
        windowPrefs: {
          width: 1400,
          height: 900,
        },
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingService(null);
  };

  const handleSelectDirectory = async () => {
    const result = await window.electronAPI.selectDirectory();
    if (result.success && result.path) {
      setFormData({ ...formData, repoPath: result.path });
    }
  };

  const handleSave = async () => {
    if (editingService) {
      // Update existing service
      const result = await window.electronAPI.updateService({
        ...editingService,
        ...formData,
      });
      if (result.success) {
        await loadServices();
        handleCloseDialog();
      }
    } else {
      // Add new service
      const result = await window.electronAPI.addService(formData);
      if (result.success) {
        await loadServices();
        handleCloseDialog();
      }
    }
  };

  const handleDelete = async (serviceId: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      const result = await window.electronAPI.removeService(serviceId);
      if (result.success) {
        await loadServices();
      }
    }
  };

  const handleOpen = async (service: Service) => {
    const result = await window.electronAPI.openBrowserWindow({
      serviceId: service.id,
      url: service.url,
      title: service.name,
      width: service.windowPrefs.width,
      height: service.windowPrefs.height,
      x: service.windowPrefs.x,
      y: service.windowPrefs.y,
      repoPath: service.repoPath,
      shellCommand: service.shellCommand || 'claude',
    });

    if (!result.success) {
      alert(`Failed to open browser: ${result.error}`);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `
          linear-gradient(30deg, #f5f5f5 12%, transparent 12.5%, transparent 87%, #f5f5f5 87.5%, #f5f5f5),
          linear-gradient(150deg, #f5f5f5 12%, transparent 12.5%, transparent 87%, #f5f5f5 87.5%, #f5f5f5),
          linear-gradient(30deg, #f5f5f5 12%, transparent 12.5%, transparent 87%, #f5f5f5 87.5%, #f5f5f5),
          linear-gradient(150deg, #f5f5f5 12%, transparent 12.5%, transparent 87%, #f5f5f5 87.5%, #f5f5f5),
          linear-gradient(60deg, #f9f9f9 25%, transparent 25.5%, transparent 75%, #f9f9f9 75%, #f9f9f9),
          linear-gradient(60deg, #f9f9f9 25%, transparent 25.5%, transparent 75%, #f9f9f9 75%, #f9f9f9)
        `,
        backgroundSize: '80px 140px',
        backgroundPosition: '0 0, 0 0, 40px 70px, 40px 70px, 0 0, 40px 70px',
        backgroundColor: '#ffffff',
      }}
    >
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 300 }}>
            Projects
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            Add Project
          </Button>
        </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {services.length === 0 ? (
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No services yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Click 'Add Service' to create your first service
            </Typography>
          </Paper>
        ) : (
          services.map((service, index) => (
            <Paper
              key={service.id}
              elevation={0}
              sx={{
                p: 2.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 500, mb: 1 }}>
                    {service.name}
                  </Typography>
                  <Typography variant="body2" color="text.primary" sx={{ mb: 0.5 }}>
                    {service.url}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                    {formatPath(service.repoPath)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Shell: {service.shellCommand || 'claude'}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    aria-label="open"
                    onClick={() => handleOpen(service)}
                    size="small"
                  >
                    <OpenInBrowser />
                  </IconButton>
                  <IconButton
                    aria-label="edit"
                    onClick={() => handleOpenDialog(service)}
                    size="small"
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    aria-label="delete"
                    onClick={() => handleDelete(service.id)}
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </Box>
              </Box>
            </Paper>
          ))
        )}
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingService ? 'Edit Service' : 'Add Service'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Service Name"
            fullWidth
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="URL"
            fullWidth
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="http://localhost:3000"
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <TextField
              margin="dense"
              label="Repository Path"
              fullWidth
              value={formData.repoPath}
              onChange={(e) => setFormData({ ...formData, repoPath: e.target.value })}
            />
            <Button
              variant="outlined"
              onClick={handleSelectDirectory}
              sx={{ mt: 1 }}
              startIcon={<Folder />}
            >
              Browse
            </Button>
          </Box>
          <FormControl fullWidth margin="dense" sx={{ mt: 2 }}>
            <InputLabel>Shell Command</InputLabel>
            <Select
              value={formData.shellCommand}
              label="Shell Command"
              onChange={(e) => setFormData({ ...formData, shellCommand: e.target.value as 'claude' | 'codex' })}
            >
              <MenuItem value="claude">Claude (Anthropic)</MenuItem>
              <MenuItem value="codex">Codex (OpenAI)</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
            <TextField
              margin="dense"
              label="Window Width"
              type="number"
              value={formData.windowPrefs.width}
              onChange={(e) => setFormData({
                ...formData,
                windowPrefs: { ...formData.windowPrefs, width: parseInt(e.target.value) }
              })}
            />
            <TextField
              margin="dense"
              label="Window Height"
              type="number"
              value={formData.windowPrefs.height}
              onChange={(e) => setFormData({
                ...formData,
                windowPrefs: { ...formData.windowPrefs, height: parseInt(e.target.value) }
              })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">
            {editingService ? 'Save' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
}
