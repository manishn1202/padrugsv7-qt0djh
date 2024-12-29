// React/Router imports - version ^18.2.0, ^6.0.0
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Material UI imports - version ^5.0.0
import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

// Internal component imports
import RequestList from '../components/requests/RequestList';
import PageHeader from '../components/common/PageHeader';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Hook imports
import { useRequest } from '../hooks/useRequest';
import { useAnalytics } from '../hooks/useAnalytics';
import { useTheme } from '../hooks/useTheme';

// Type imports
import { AuthorizationRequest } from '../types/request.types';
import { PaginationParams } from '../types/common.types';

// Constants
const PAGE_TITLE = 'Prior Authorization Requests';
const DEFAULT_PAGE_SIZE = 25;
const WEBSOCKET_RETRY_ATTEMPTS = 3;
const ERROR_BOUNDARY_FALLBACK = 'Error loading requests. Please try again.';

/**
 * Requests page component that displays and manages prior authorization requests
 * Implements real-time updates, filtering, and multi-stakeholder communication
 */
const Requests: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { track } = useAnalytics();
  const { 
    searchRequests, 
    loading, 
    error: requestError,
    clearError 
  } = useRequest();

  // Local state
  const [pagination, setPagination] = useState<PaginationParams>({
    page: 0,
    pageSize: DEFAULT_PAGE_SIZE,
    sortBy: 'submittedDate',
    sortOrder: 'desc',
    filters: {}
  });

  /**
   * Handles navigation to new request creation
   */
  const handleNewRequest = useCallback(() => {
    track('new_request_initiated', {
      source: 'requests_page',
      timestamp: new Date().toISOString()
    });
    navigate('/requests/new');
  }, [navigate, track]);

  /**
   * Handles request selection for viewing details
   */
  const handleRequestSelect = useCallback((request: AuthorizationRequest) => {
    track('request_selected', {
      requestId: request.id,
      status: request.status,
      timestamp: new Date().toISOString()
    });
    navigate(`/requests/${request.id}`);
  }, [navigate, track]);

  /**
   * Handles pagination and filter changes
   */
  const handlePaginationChange = useCallback((newPagination: PaginationParams) => {
    setPagination(prev => ({
      ...prev,
      ...newPagination
    }));
    track('request_list_filtered', {
      filters: newPagination.filters,
      pagination: {
        page: newPagination.page,
        pageSize: newPagination.pageSize
      },
      timestamp: new Date().toISOString()
    });
  }, [track]);

  /**
   * Handles errors from child components
   */
  const handleError = useCallback((error: Error) => {
    console.error('Request list error:', error);
    clearError();
  }, [clearError]);

  // Memoized page actions
  const pageActions = useMemo(() => (
    <Button
      variant="contained"
      color="primary"
      startIcon={<AddIcon />}
      onClick={handleNewRequest}
      aria-label="Create new authorization request"
      sx={{
        height: 40,
        minWidth: 140,
        fontWeight: 500
      }}
    >
      New Request
    </Button>
  ), [handleNewRequest]);

  // Memoized breadcrumbs configuration
  const breadcrumbs = useMemo(() => [
    { label: 'Home', path: '/' },
    { label: 'Requests', path: '/requests' }
  ], []);

  return (
    <ErrorBoundary
      fallback={ERROR_BOUNDARY_FALLBACK}
      onError={handleError}
    >
      <PageHeader
        title={PAGE_TITLE}
        breadcrumbs={breadcrumbs}
        actions={pageActions}
        analyticsData={{
          pageId: 'requests',
          section: 'authorization',
          subsection: 'list'
        }}
      />
      <RequestList
        onRequestSelect={handleRequestSelect}
        defaultFilters={pagination.filters}
        defaultPageSize={pagination.pageSize}
        onError={handleError}
        accessibilityLabel="Authorization requests list"
      />
    </ErrorBoundary>
  );
};

// Export with analytics tracking wrapper
export default Requests;