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
} from '@mui/material';
import { Delete, Edit, OpenInBrowser, Add, Folder } from '@mui/icons-material';
import { Service } from '../../shared/ipc-channels';

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
        windowPrefs: service.windowPrefs,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: '',
        url: '',
        repoPath: '',
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
    });

    if (!result.success) {
      alert(`Failed to open browser: ${result.error}`);
    }
  };

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Windev Services
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
        >
          Add Service
        </Button>
      </Box>

      <Paper>
        <List>
          {services.length === 0 ? (
            <ListItem>
              <ListItemText
                primary="No services yet"
                secondary="Click 'Add Service' to create your first service"
              />
            </ListItem>
          ) : (
            services.map((service) => (
              <ListItem key={service.id}>
                <ListItemText
                  primary={service.name}
                  secondary={
                    <>
                      <Typography component="span" variant="body2" color="text.primary">
                        {service.url}
                      </Typography>
                      <br />
                      <Typography component="span" variant="body2" color="text.secondary">
                        {service.repoPath}
                      </Typography>
                    </>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="open"
                    onClick={() => handleOpen(service)}
                    sx={{ mr: 1 }}
                  >
                    <OpenInBrowser />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    onClick={() => handleOpenDialog(service)}
                    sx={{ mr: 1 }}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() => handleDelete(service.id)}
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))
          )}
        </List>
      </Paper>

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
  );
}
