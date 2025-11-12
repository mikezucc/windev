import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
} from '@mui/material';

interface CreateMomentModalProps {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onSuccess?: () => void;
  initialFile?: File | null;
}

export const CreateMomentModal: React.FC<CreateMomentModalProps> = ({
  open,
  onClose,
  organizationId,
  onSuccess,
  initialFile,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Create a FormData object to send the file and metadata
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('organizationId', organizationId);

      if (initialFile) {
        formData.append('file', initialFile);
      }

      // TODO: Implement actual moment creation API call
      // For now, just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log('Moment created:', {
        title,
        description,
        organizationId,
        file: initialFile?.name,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setError(null);

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error creating moment:', err);
      setError(err instanceof Error ? err.message : 'Failed to create moment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle('');
      setDescription('');
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create Moment</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {initialFile && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Captured file:
              </Typography>
              <Typography variant="body2">
                {initialFile.name}
              </Typography>
              {initialFile.type.startsWith('image/') && (
                <Box
                  component="img"
                  src={URL.createObjectURL(initialFile)}
                  alt="Preview"
                  sx={{
                    width: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    mt: 1,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
              )}
              {initialFile.type.startsWith('video/') && (
                <Box
                  component="video"
                  src={URL.createObjectURL(initialFile)}
                  controls
                  sx={{
                    width: '100%',
                    maxHeight: 200,
                    mt: 1,
                    borderRadius: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                />
              )}
            </Box>
          )}

          <TextField
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            fullWidth
            required
            error={!!error && !title.trim()}
            helperText={error && !title.trim() ? error : ''}
            disabled={isSubmitting}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={4}
            disabled={isSubmitting}
          />

          {error && title.trim() && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || !title.trim()}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : null}
        >
          {isSubmitting ? 'Creating...' : 'Create Moment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
