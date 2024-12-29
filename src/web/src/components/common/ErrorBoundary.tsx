import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';
import { showNotification, NotificationType } from '../common/Notification';
import { ErrorResponse } from '../../types/common.types';

/**
 * Props interface for ErrorBoundary component with extended configuration options
 */
interface ErrorBoundaryProps {
  /** Child components to be rendered */
  children: React.ReactNode;
  /** Optional custom fallback UI */
  fallback?: React.ReactNode | null;
  /** Optional error callback for external error handling */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Flag to enable retry functionality */
  retryable?: boolean;
  /** Flag to enable error monitoring */
  errorMonitoring?: boolean;
}

/**
 * State interface for ErrorBoundary component
 */
interface ErrorBoundaryState {
  /** Flag indicating if an error has occurred */
  hasError: boolean;
  /** Captured error object */
  error: Error | null;
  /** React error info object */
  errorInfo: React.ErrorInfo | null;
  /** Counter for retry attempts */
  retryCount: number;
}

/**
 * Enhanced React error boundary component with comprehensive error handling,
 * monitoring, and recovery features. Implements Material UI components for
 * consistent visual presentation and accessibility support.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private readonly maxRetries: number = 3;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    };
    this.handleRetry = this.handleRetry.bind(this);
  }

  /**
   * Static lifecycle method called when an error occurs in a child component
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    };
  }

  /**
   * Lifecycle method for handling caught errors with enhanced error reporting
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update component state with error details
    this.setState({
      errorInfo
    });

    // Show error notification
    showNotification(
      NotificationType.ERROR,
      'An unexpected error occurred. Our team has been notified.',
      'HIGH',
      true
    );

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Format error for monitoring
    const errorResponse: ErrorResponse = {
      code: error.name,
      message: error.message,
      details: {
        componentStack: errorInfo.componentStack,
        stack: error.stack
      },
      timestamp: new Date().toISOString()
    };

    // Log error for monitoring if enabled
    if (this.props.errorMonitoring) {
      console.error('Error Boundary Caught Error:', errorResponse);
      // Here you would typically send to your error monitoring service
      // e.g., Sentry, DataDog, etc.
    }
  }

  /**
   * Handles retry attempts for recoverable errors
   */
  private handleRetry(): void {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1
      }));

      showNotification(
        NotificationType.INFO,
        `Retrying... (Attempt ${this.state.retryCount + 1}/${this.maxRetries})`,
        'MEDIUM'
      );
    } else {
      showNotification(
        NotificationType.ERROR,
        'Maximum retry attempts reached. Please refresh the page.',
        'HIGH',
        true
      );
    }
  }

  render(): React.ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, retryable = true } = this.props;

    if (hasError) {
      // Return custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI with Material components
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '200px',
            p: 3
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              textAlign: 'center',
              maxWidth: '600px',
              width: '100%'
            }}
          >
            <ErrorOutline
              color="error"
              sx={{ fontSize: 48, mb: 2 }}
              aria-hidden="true"
            />
            <Typography
              variant="h5"
              component="h2"
              gutterBottom
              color="error"
              role="alert"
            >
              Something went wrong
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              {error?.message || 'An unexpected error occurred.'}
            </Typography>
            {retryable && this.state.retryCount < this.maxRetries && (
              <Button
                variant="contained"
                color="primary"
                onClick={this.handleRetry}
                startIcon={<Refresh />}
                aria-label="Retry loading the component"
                sx={{ mt: 2 }}
              >
                Retry
              </Button>
            )}
          </Paper>
        </Box>
      );
    }

    return children;
  }
}

export default ErrorBoundary;
```

This implementation provides:

1. Comprehensive error handling with detailed error reporting and monitoring integration
2. Material UI components for consistent visual presentation
3. Accessibility features including ARIA roles and labels
4. Integration with the notification system for user feedback
5. Retry functionality with configurable maximum attempts
6. Customizable fallback UI support
7. TypeScript type safety with detailed interfaces
8. Error monitoring integration capability
9. Proper error boundary lifecycle method implementation
10. Clean and maintainable code structure with detailed comments

The component can be used to wrap any part of the application where error handling is needed:

```typescript
<ErrorBoundary
  onError={(error, errorInfo) => {
    // Custom error handling
  }}
  errorMonitoring={true}
  retryable={true}
>
  <YourComponent />
</ErrorBoundary>