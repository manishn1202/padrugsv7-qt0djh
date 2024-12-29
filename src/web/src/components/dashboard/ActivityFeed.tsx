import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material'; // ^5.0.0
import { FixedSizeList as VirtualList } from 'react-window'; // ^1.8.9
import { Skeleton } from '@mui/material'; // ^5.0.0
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

// Internal imports
import Card from '../common/Card';
import { useRequest } from '../../hooks/useRequest';
import { AuthorizationStatus } from '../../types/request.types';
import { formatErrorMessage } from '../../utils/validation.utils';

// Activity type definition
interface Activity {
  id: string;
  type: 'status_change' | 'document_upload' | 'clinical_update' | 'comment';
  timestamp: string;
  requestId: string;
  description: string;
  status?: AuthorizationStatus;
  actor?: {
    id: string;
    name: string;
    role: string;
  };
}

// Props interface
interface ActivityFeedProps {
  limit?: number;
  pollingInterval?: number;
  filterTypes?: Activity['type'][];
  onError?: (error: Error) => void;
}

// Constants
const DEFAULT_LIMIT = 50;
const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds
const ACTIVITY_ITEM_HEIGHT = 72;
const FEED_HEIGHT = 400;

/**
 * ActivityFeed component displays real-time PA request activities
 * Implements WCAG 2.1 Level AA compliance and performance optimizations
 */
const ActivityFeed: React.FC<ActivityFeedProps> = ({
  limit = DEFAULT_LIMIT,
  pollingInterval = DEFAULT_POLLING_INTERVAL,
  filterTypes,
  onError
}) => {
  const theme = useTheme();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isPolling, setIsPolling] = useState(true);
  const { searchRequests, loading, error, clearError } = useRequest();

  // Fetch activities with pagination and filtering
  const fetchActivities = useCallback(async () => {
    try {
      const response = await searchRequests(
        {
          types: filterTypes,
          limit,
          sort: 'timestamp:desc'
        },
        {
          page: 0,
          pageSize: limit,
          sortBy: 'timestamp',
          sortOrder: 'desc',
          filters: {}
        }
      );

      if (response.success && response.data) {
        setActivities(response.data.activities);
      } else if (response.error) {
        throw new Error(response.error.message);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch activities');
      onError?.(error);
      setIsPolling(false);
    }
  }, [searchRequests, limit, filterTypes, onError]);

  // Set up polling interval
  useEffect(() => {
    if (!isPolling) return;

    fetchActivities();
    const intervalId = setInterval(fetchActivities, pollingInterval);

    return () => {
      clearInterval(intervalId);
    };
  }, [fetchActivities, isPolling, pollingInterval]);

  // Activity item renderer for virtual list
  const ActivityItem = React.memo(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const activity = activities[index];
    if (!activity) return null;

    return (
      <Box
        style={style}
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:hover': {
            backgroundColor: theme.palette.action.hover
          }
        }}
        role="listitem"
        aria-label={`Activity: ${activity.description}`}
      >
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mb: 0.5 }}
          aria-label="Activity timestamp"
        >
          {new Date(activity.timestamp).toLocaleString()}
        </Typography>
        <Typography variant="body1" sx={{ mb: 0.5 }}>
          {activity.description}
        </Typography>
        {activity.actor && (
          <Typography variant="caption" color="textSecondary">
            By {activity.actor.name} ({activity.actor.role})
          </Typography>
        )}
      </Box>
    );
  });

  // Loading skeleton
  const LoadingSkeleton = () => (
    <Box sx={{ p: 2 }}>
      {[...Array(5)].map((_, i) => (
        <Box key={i} sx={{ mb: 2 }}>
          <Skeleton width="30%" height={20} sx={{ mb: 1 }} />
          <Skeleton width="100%" height={24} sx={{ mb: 1 }} />
          <Skeleton width="50%" height={16} />
        </Box>
      ))}
    </Box>
  );

  return (
    <Card
      role="region"
      aria-label="Activity Feed"
      elevation={1}
      fullWidth
    >
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" component="h2">
          Recent Activities
        </Typography>
        <Tooltip title="Refresh activities">
          <IconButton
            onClick={() => fetchActivities()}
            disabled={loading}
            aria-label="Refresh activities"
            size="small"
          >
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Box
          sx={{
            p: 2,
            backgroundColor: theme.palette.error.light,
            color: theme.palette.error.contrastText
          }}
          role="alert"
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ErrorOutlineIcon />
            <Typography variant="body2">
              {formatErrorMessage(error.message)}
            </Typography>
          </Box>
        </Box>
      )}

      <Box
        sx={{
          height: FEED_HEIGHT,
          overflowX: 'hidden'
        }}
        role="list"
      >
        {loading ? (
          <LoadingSkeleton />
        ) : (
          <VirtualList
            height={FEED_HEIGHT}
            width="100%"
            itemCount={activities.length}
            itemSize={ACTIVITY_ITEM_HEIGHT}
            overscanCount={5}
          >
            {ActivityItem}
          </VirtualList>
        )}
      </Box>
    </Card>
  );
};

export default React.memo(ActivityFeed);