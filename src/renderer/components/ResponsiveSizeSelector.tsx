import React from 'react';
import { Box, IconButton, Menu, MenuItem, Typography, Tooltip } from '@mui/material';
import DevicesIcon from '@mui/icons-material/Devices';
import CloseIcon from '@mui/icons-material/Close';

export interface ResponsiveSize {
  name: string;
  width: number;
  height: number;
  icon?: React.ReactNode;
}

export const RESPONSIVE_SIZES: ResponsiveSize[] = [
  { name: 'iPhone SE', width: 375, height: 667 },
  { name: 'iPhone 12/13 Pro', width: 390, height: 844 },
  { name: 'iPhone 12/13 Pro Max', width: 428, height: 926 },
  { name: 'iPhone 14 Plus', width: 428, height: 926 },
  { name: 'iPad Mini', width: 768, height: 1024 },
  { name: 'iPad Air', width: 820, height: 1180 },
  { name: 'iPad Pro 11"', width: 834, height: 1194 },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
  { name: 'Desktop (1024px)', width: 1024, height: 768 },
  { name: 'Desktop (1280px)', width: 1280, height: 800 },
  { name: 'Desktop (1440px)', width: 1440, height: 900 },
  { name: 'Desktop (1920px)', width: 1920, height: 1080 },
];

interface ResponsiveSizeSelectorProps {
  currentSize: ResponsiveSize | null;
  onSizeChange: (size: ResponsiveSize | null) => void;
  disabled?: boolean;
}

export const ResponsiveSizeSelector: React.FC<ResponsiveSizeSelectorProps> = ({
  currentSize,
  onSizeChange,
  disabled = false,
}) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSizeSelect = (size: ResponsiveSize) => {
    onSizeChange(size);
    handleClose();
  };

  const handleClearSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSizeChange(null);
    handleClose();
  };

  return (
    <>
      <Tooltip title={currentSize ? `${currentSize.name} (${currentSize.width}×${currentSize.height})` : 'Select responsive size'}>
        <IconButton
          size="small"
          onClick={handleClick}
          disabled={disabled}
          sx={{
            color: currentSize ? 'primary.main' : 'inherit',
          }}
        >
          {currentSize ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DevicesIcon fontSize="small" />
              <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                {currentSize.name}
              </Typography>
              <CloseIcon
                fontSize="small"
                onClick={handleClearSize}
                sx={{ fontSize: 14, '&:hover': { color: 'error.main' } }}
              />
            </Box>
          ) : (
            <DevicesIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            maxHeight: 400,
            width: 250,
          },
        }}
      >
        <MenuItem onClick={handleClearSize} disabled={!currentSize}>
          <Typography variant="body2" color="text.secondary">
            Full Size (No Responsive)
          </Typography>
        </MenuItem>
        <Box sx={{ height: 1, bgcolor: 'divider', my: 0.5 }} />
        {RESPONSIVE_SIZES.map((size) => (
          <MenuItem
            key={`${size.name}-${size.width}x${size.height}`}
            onClick={() => handleSizeSelect(size)}
            selected={currentSize?.name === size.name}
          >
            <Box>
              <Typography variant="body2">{size.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {size.width} × {size.height}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
