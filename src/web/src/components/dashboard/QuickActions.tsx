import React, { memo, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.x
import { AddCircleOutline, Search, BarChart } from '@mui/icons-material'; // v5.x

// Internal components
import Card from '../common/Card';
import Button from '../common/Button';

// Hooks
import { useRequest } from '../../hooks/useRequest';
import { useNotification } from '../../hooks/useNotification';
import { useAnalytics } from '../../hooks/useAnalytics';

// Error boundary decorator
const withErrorBoundary = (Component: React.ComponentType<any>) => {
  return class ErrorBoundary extends React.Component<any, { hasError: boolean }> {
    constructor(props: any) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
      return { hasError: true };
    }

    componentDidCatch(error: Error) {
      console.error('QuickActions Error:', error);
    }

    render() {
      if (this.state.hasError) {
        return null;
      }
      return <Component {...this.props} />;
    }
  };
};

/**
 * Props interface for the QuickActions component
 */
interface QuickActionsProps {
  /** Disables all quick actions */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback after action completion */
  onActionComplete?: () => void;
}

/**
 * QuickActions component that displays common task buttons with accessibility support
 * Implements Material Design 3.0 components with healthcare-optimized styling
 */
const QuickActionsBase: React.FC<QuickActionsProps> = ({
  disabled = false,
  className,
  onActionComplete
}) => {
  // Hooks
  const navigate = useNavigate();
  const { createRequest } = useRequest();
  const { showNotification } = useNotification();
  const { trackEvent } = useAnalytics();

  // Loading states
  const [loadingStates, setLoadingStates] = useState({
    newRequest: false,
    search: false,
    analytics: false
  });

  /**
   * Handles new request creation
   */
  const handleNewRequest = useCallback(async () => {
    try {
      setLoadingStates(prev => ({ ...prev, newRequest: true }));
      trackEvent('quick_action_click', { action: 'new_request' });

      const result = await createRequest({
        status: 'DRAFT',
        metadata: {
          source: 'quick_action',
          created_at: new Date().toISOString()
        }
      });

      if (result.success) {
        showNotification('success', 'New request created successfully', 'LOW');
        navigate(`/requests/${result.data.id}`);
        onActionComplete?.();
      } else {
        throw new Error(result.error?.message);
      }
    } catch (error) {
      showNotification(
        'error',
        'Failed to create new request. Please try again.',
        'HIGH'
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, newRequest: false }));
    }
  }, [createRequest, navigate, showNotification, trackEvent, onActionComplete]);

  /**
   * Handles search navigation
   */
  const handleSearch = useCallback(() => {
    try {
      setLoadingStates(prev => ({ ...prev, search: true }));
      trackEvent('quick_action_click', { action: 'search' });
      navigate('/search');
      onActionComplete?.();
    } catch (error) {
      showNotification(
        'error',
        'Failed to navigate to search. Please try again.',
        'HIGH'
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, search: false }));
    }
  }, [navigate, showNotification, trackEvent, onActionComplete]);

  /**
   * Handles analytics navigation
   */
  const handleAnalytics = useCallback(() => {
    try {
      setLoadingStates(prev => ({ ...prev, analytics: true }));
      trackEvent('quick_action_click', { action: 'analytics' });
      navigate('/analytics');
      onActionComplete?.();
    } catch (error) {
      showNotification(
        'error',
        'Failed to navigate to analytics. Please try again.',
        'HIGH'
      );
    } finally {
      setLoadingStates(prev => ({ ...prev, analytics: false }));
    }
  }, [navigate, showNotification, trackEvent, onActionComplete]);

  return (
    <Card
      variant="elevation"
      elevation={2}
      className={className}
      role="region"
      aria-label="Quick Actions"
      data-testid="quick-actions"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddCircleOutline />}
          onClick={handleNewRequest}
          disabled={disabled}
          loading={loadingStates.newRequest}
          fullWidth
          aria-label="Start New Request"
          data-testid="new-request-button"
        >
          Start New Request
        </Button>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<Search />}
          onClick={handleSearch}
          disabled={disabled}
          loading={loadingStates.search}
          fullWidth
          aria-label="Search Requests"
          data-testid="search-button"
        >
          Search Requests
        </Button>

        <Button
          variant="outlined"
          color="primary"
          startIcon={<BarChart />}
          onClick={handleAnalytics}
          disabled={disabled}
          loading={loadingStates.analytics}
          fullWidth
          aria-label="View Analytics"
          data-testid="analytics-button"
        >
          View Analytics
        </Button>
      </div>
    </Card>
  );
};

// Apply error boundary and memo
const QuickActions = withErrorBoundary(memo(QuickActionsBase));

// Set display name for debugging
QuickActions.displayName = 'QuickActions';

export default QuickActions;