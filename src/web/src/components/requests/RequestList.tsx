import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useVirtualizer } from '@tanstack/react-virtual';
import { debounce } from 'lodash';
import { DataGrid } from '../common/DataGrid';
import ErrorBoundary from '../common/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import { ApiResponse, LoadingState } from '../../types/common.types';

// Constants for component configuration
const VIRTUALIZATION_THRESHOLD = 1000;
const FILTER_DEBOUNCE_MS = 300;
const ERROR_MESSAGES = {
  LOAD_ERROR: 'Failed to load authorization requests',
  UPDATE_ERROR: 'Failed to update request status',
  NETWORK_ERROR: 'Network connection lost'
} as const;

const ARIA_LABELS = {
  GRID: 'Authorization Requests List',
  LOADING: 'Loading authorization requests',
  STATUS_CELL: 'Request status: {status}',
  FILTER_INPUT: 'Filter {column} column'
} as const;

// Interface definitions
interface RequestListProps {
  onRequestSelect: (request: AuthorizationRequest) => void;
  defaultFilters?: GridFilterModel;
  defaultPageSize?: number;
  onError?: (error: Error) => void;
  accessibilityLabel?: string;
  virtualizeThreshold?: number;
}

interface AuthorizationRequest {
  id: string;
  patientName: string;
  patientId: string;
  medicationName: string;
  status: string;
  submittedDate: string;
  priority: string;
  providerName: string;
  insurancePlan: string;
}

// Custom hook for optimistic updates
const useOptimisticUpdate = (updateFn: (id: string, status: string) => Promise<void>) => {
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, string>>({});

  const updateStatus = useCallback(async (id: string, status: string) => {
    setPendingUpdates(prev => ({ ...prev, [id]: status }));
    try {
      await updateFn(id, status);
    } catch (error) {
      setPendingUpdates(prev => {
        const { [id]: removed, ...rest } = prev;
        return rest;
      });
      throw error;
    }
  }, [updateFn]);

  return { pendingUpdates, updateStatus };
};

// Main component
export const RequestList: React.FC<RequestListProps> = ({
  onRequestSelect,
  defaultFilters,
  defaultPageSize = 25,
  onError,
  accessibilityLabel = ARIA_LABELS.GRID,
  virtualizeThreshold = VIRTUALIZATION_THRESHOLD
}) => {
  const { theme } = useTheme();
  const [loadingState, setLoadingState] = useState<LoadingState>('idle');
  const [requests, setRequests] = useState<AuthorizationRequest[]>([]);
  const [pagination, setPagination] = useState({
    page: 0,
    pageSize: defaultPageSize,
    sortBy: 'submittedDate',
    sortOrder: 'desc' as const,
    filters: defaultFilters || {}
  });

  // Grid columns configuration
  const columns = useMemo(() => [
    {
      field: 'patientName',
      headerName: 'Patient Name',
      flex: 1,
      sortable: true,
      filterable: true,
    },
    {
      field: 'medicationName',
      headerName: 'Medication',
      flex: 1,
      sortable: true,
      filterable: true,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 150,
      sortable: true,
      filterable: true,
      renderCell: (params) => (
        <Box
          sx={{
            color: theme.palette[params.value === 'Approved' ? 'success' : 'primary'].main,
            fontWeight: 'medium'
          }}
          aria-label={ARIA_LABELS.STATUS_CELL.replace('{status}', params.value)}
        >
          {params.value}
        </Box>
      ),
    },
    {
      field: 'submittedDate',
      headerName: 'Submitted Date',
      width: 180,
      sortable: true,
      filterable: true,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      sortable: true,
      filterable: true,
    },
    {
      field: 'providerName',
      headerName: 'Provider',
      flex: 1,
      sortable: true,
      filterable: true,
    },
    {
      field: 'insurancePlan',
      headerName: 'Insurance Plan',
      flex: 1,
      sortable: true,
      filterable: true,
    }
  ], [theme]);

  // Fetch data with debouncing
  const fetchData = useCallback(
    debounce(async () => {
      setLoadingState('loading');
      try {
        // API call would go here
        const response: ApiResponse<AuthorizationRequest[]> = await fetch('/api/authorizations', {
          method: 'POST',
          body: JSON.stringify(pagination)
        }).then(res => res.json());

        if (!response.success) {
          throw new Error(response.error?.message || ERROR_MESSAGES.LOAD_ERROR);
        }

        setRequests(response.data);
        setLoadingState('succeeded');
      } catch (error) {
        setLoadingState('failed');
        onError?.(error as Error);
      }
    }, FILTER_DEBOUNCE_MS),
    [pagination, onError]
  );

  // Handle pagination changes
  const handlePaginationChange = useCallback((newPagination) => {
    setPagination(prev => ({
      ...prev,
      ...newPagination
    }));
  }, []);

  // Effect for data fetching
  useEffect(() => {
    fetchData();
    return () => {
      fetchData.cancel();
    };
  }, [fetchData]);

  // Virtualization setup for large datasets
  const { rows: virtualizedRows } = useMemo(() => {
    if (requests.length < virtualizeThreshold) {
      return { rows: requests };
    }

    const rowVirtualizer = useVirtualizer({
      count: requests.length,
      getScrollElement: () => document.querySelector('.MuiDataGrid-virtualScroller'),
      estimateSize: () => 52,
      overscan: 10
    });

    return {
      rows: rowVirtualizer.getVirtualItems().map(virtualRow => requests[virtualRow.index])
    };
  }, [requests, virtualizeThreshold]);

  return (
    <ErrorBoundary
      onError={onError}
      fallback={<Box p={3}>Error loading authorization requests. Please try again.</Box>}
    >
      <Box
        sx={{
          height: '100%',
          width: '100%',
          '& .MuiDataGrid-root': {
            border: 'none',
            backgroundColor: theme.palette.background.paper
          }
        }}
      >
        <DataGrid
          columns={columns}
          rows={virtualizedRows}
          pagination={pagination}
          onPaginationChange={handlePaginationChange}
          loading={loadingState === 'loading'}
          onRowClick={(params) => onRequestSelect(params.row)}
          density="comfortable"
          showToolbar
          virtualScrolling={requests.length >= virtualizeThreshold}
          aria-label={accessibilityLabel}
        />
        {loadingState === 'loading' && (
          <CircularProgress
            size={40}
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              marginTop: '-20px',
              marginLeft: '-20px'
            }}
            aria-label={ARIA_LABELS.LOADING}
          />
        )}
      </Box>
    </ErrorBoundary>
  );
};

export default RequestList;