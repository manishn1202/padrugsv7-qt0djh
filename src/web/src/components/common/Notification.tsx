import React, { useCallback, useEffect } from 'react';
import { Alert, Snackbar, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { VisuallyHidden } from '@mui/utils';
import { NotificationType } from '../../types/common.types';

// Constants for component configuration
const ANIMATION_DURATION = 300;

// Styles for the Alert component
const ALERT_STYLES = {
  width: '100%',
  maxWidth: '600px',
  boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
  outline: 'none',
  position: 'relative'
} as const;

// Screen reader announcement messages
const SCREEN_READER_MESSAGES = {
  success: 'Success notification:',
  error: 'Error notification:',
  warning: 'Warning notification:',
  info: 'Information notification:'
} as const;

/**
 * Props interface for the Notification component with enhanced accessibility support
 */
interface NotificationProps {
  /** Unique identifier for the notification */
  id: string;
  /** Type/severity of the notification */
  type: NotificationType;
  /** Content of the notification */
  message: string;
  /** Auto-dismiss duration in milliseconds */
  duration: number | null;
  /** Priority level for notification ordering */
  priority: number;
  /** Accessible label for screen readers */
  ariaLabel?: string;
  /** ARIA role for accessibility */
  role?: 'alert' | 'status';
  /** Callback function when notification is closed */
  onClose: (id: string) => void;
}

/**
 * Maps notification type to Material UI Alert severity with proper accessibility attributes
 * @param type - The notification type
 * @returns The corresponding Material UI Alert severity
 */
const getAlertSeverity = (type: NotificationType): 'success' | 'error' | 'warning' | 'info' => {
  switch (type) {
    case 'success':
      return 'success';
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    default:
      return 'info';
  }
};

/**
 * Accessible notification component for displaying alerts, messages, and feedback
 * Implements WCAG 2.1 Level AA compliance with proper ARIA attributes
 */
const Notification: React.FC<NotificationProps> = ({
  id,
  type,
  message,
  duration,
  priority,
  ariaLabel,
  role = 'alert',
  onClose
}) => {
  // State to manage notification visibility
  const [open, setOpen] = React.useState(true);

  /**
   * Handles notification close event with keyboard support
   */
  const handleClose = useCallback(
    (event: React.SyntheticEvent | null, reason?: string) => {
      if (reason === 'clickaway') {
        return;
      }

      setOpen(false);
      setTimeout(() => {
        onClose(id);
      }, ANIMATION_DURATION);
    },
    [id, onClose]
  );

  // Auto-dismiss effect for non-persistent notifications
  useEffect(() => {
    if (duration !== null) {
      const timer = setTimeout(() => {
        handleClose(null);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, handleClose]);

  // Generate accessible label for screen readers
  const screenReaderLabel = ariaLabel || `${SCREEN_READER_MESSAGES[type]} ${message}`;

  return (
    <Snackbar
      open={open}
      onClose={handleClose}
      TransitionProps={{
        timeout: ANIMATION_DURATION
      }}
      anchorOrigin={{
        vertical: 'top',
        horizontal: 'right'
      }}
      data-priority={priority}
    >
      <Alert
        severity={getAlertSeverity(type)}
        sx={ALERT_STYLES}
        role={role}
        aria-live={type === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        action={
          <>
            <VisuallyHidden>{screenReaderLabel}</VisuallyHidden>
            <IconButton
              size="small"
              aria-label="Close notification"
              onClick={handleClose}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  handleClose(event);
                }
              }}
              color="inherit"
              sx={{ ml: 1 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </>
        }
      >
        {message}
      </Alert>
    </Snackbar>
  );
};

export default Notification;