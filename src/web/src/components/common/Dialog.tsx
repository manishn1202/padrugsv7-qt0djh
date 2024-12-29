import React from 'react';
import { Dialog as MuiDialog, DialogTitle, DialogContent, DialogActions, IconButton } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { theme } from '../../assets/styles/theme';
import Button from './Button';

// Styled components with comprehensive theming support
const StyledDialog = styled(MuiDialog, {
  shouldForwardProp: (prop) => !['size', 'preventScroll'].includes(prop as string),
})<{ size: DialogProps['size']; preventScroll?: boolean }>(({ theme, size, preventScroll }) => ({
  '& .MuiDialog-paper': {
    borderRadius: theme.shape.borderRadius,
    boxShadow: theme.shadows[3], // Using modal shadow
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    margin: theme.spacing(2),
    ...(size === 'small' && {
      maxWidth: '400px',
      minWidth: '320px',
    }),
    ...(size === 'medium' && {
      maxWidth: '600px',
      minWidth: '400px',
    }),
    ...(size === 'large' && {
      maxWidth: '800px',
      minWidth: '600px',
    }),
    ...(size === 'fullscreen' && {
      margin: 0,
      maxWidth: '100%',
      height: '100%',
      borderRadius: 0,
    }),
    ...(preventScroll && {
      overflow: 'hidden',
    }),
  },
  '& .MuiBackdrop-root': {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    backdropFilter: 'blur(4px)',
  },
}));

const StyledDialogTitle = styled(DialogTitle)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTypography-root': {
    fontSize: theme.typography.h6.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  },
}));

const StyledDialogContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  overflowY: 'auto',
  '&:first-of-type': {
    paddingTop: theme.spacing(3),
  },
}));

const StyledDialogActions = styled(DialogActions)(({ theme }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
  '& > :not(:first-of-type)': {
    marginLeft: theme.spacing(2),
  },
}));

// Comprehensive props interface
interface DialogProps {
  open: boolean;
  title: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: string;
  cancelText?: string;
  hideActions?: boolean;
  disableBackdropClick?: boolean;
  children: React.ReactNode;
  loading?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  focusOnMount?: string;
  closeOnEscape?: boolean;
  fullWidth?: boolean;
  maxHeight?: string | number;
  preventScroll?: boolean;
  transitionDuration?: number;
}

/**
 * Enhanced Dialog component implementing Material Design 3.0 specifications
 * with comprehensive accessibility support and theming capabilities.
 */
export const Dialog = React.memo<DialogProps>(({
  open,
  title,
  size = 'medium',
  onClose,
  onConfirm,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  hideActions = false,
  disableBackdropClick = false,
  children,
  loading = false,
  ariaLabel,
  ariaDescribedBy,
  focusOnMount,
  closeOnEscape = true,
  fullWidth = false,
  maxHeight,
  preventScroll = false,
  transitionDuration = 225,
}) => {
  const theme = useTheme();

  // Handle backdrop click
  const handleBackdropClick = React.useCallback((event: React.MouseEvent) => {
    if (!disableBackdropClick) {
      onClose();
    }
  }, [disableBackdropClick, onClose]);

  // Handle escape key
  const handleKeyDown = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && closeOnEscape) {
      onClose();
    }
  }, [closeOnEscape, onClose]);

  // Focus management
  React.useEffect(() => {
    if (open && focusOnMount) {
      const element = document.getElementById(focusOnMount);
      if (element) {
        element.focus();
      }
    }
  }, [open, focusOnMount]);

  return (
    <StyledDialog
      open={open}
      size={size}
      onClose={handleBackdropClick}
      aria-labelledby="dialog-title"
      aria-describedby={ariaDescribedBy}
      maxWidth={false}
      fullWidth={fullWidth}
      preventScroll={preventScroll}
      onKeyDown={handleKeyDown}
      transitionDuration={transitionDuration}
      aria-modal={true}
      role="dialog"
    >
      <StyledDialogTitle id="dialog-title">
        {title}
        <IconButton
          onClick={onClose}
          aria-label="Close dialog"
          size="small"
          sx={{
            color: theme.palette.text.secondary,
            '&:hover': {
              backgroundColor: theme.palette.action.hover,
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </StyledDialogTitle>

      <StyledDialogContent
        sx={{
          maxHeight: maxHeight,
        }}
      >
        {children}
      </StyledDialogContent>

      {!hideActions && (
        <StyledDialogActions>
          <Button
            variant="outlined"
            onClick={onClose}
            disabled={loading}
            color="secondary"
            aria-label={cancelText}
          >
            {cancelText}
          </Button>
          {onConfirm && (
            <Button
              variant="contained"
              onClick={onConfirm}
              loading={loading}
              color="primary"
              aria-label={confirmText}
            >
              {confirmText}
            </Button>
          )}
        </StyledDialogActions>
      )}
    </StyledDialog>
  );
});

Dialog.displayName = 'Dialog';

export default Dialog;