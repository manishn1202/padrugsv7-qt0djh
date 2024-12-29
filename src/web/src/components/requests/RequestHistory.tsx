// @mui/lab version ^5.0.0
// @mui/material version ^5.0.0
// react version ^18.2.0
// react-virtual version ^3.0.0

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useVirtualizer } from 'react-virtual';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineContent,
  TimelineDot,
} from '@mui/lab';
import { 
  Box,
  Paper,
  Typography,
  useTheme,
  Skeleton,
  IconButton,
  Tooltip,
} from '@mui/material';
import { AuthorizationStatus } from '../../types/request.types';
import { useRequest } from '../../hooks/useRequest';

// Constants for timeline configuration
const TIMELINE_ITEM_HEIGHT = 100;
const TIMELINE_BATCH_SIZE = 20;
const TIMELINE_UPDATE_INTERVAL = 30000; // 30 seconds

// Status color mapping for visual consistency
const STATUS_COLORS = {
  SUBMITTED: 'info.main',
  PENDING_DOCUMENTS: 'warning.main',
  UNDER_REVIEW: 'info.main',
  APPROVED: 'success.main',
  DENIED: 'error.main',
  CANCELLED: 'grey.500',
} as const;

// ARIA labels for accessibility
const ARIA_LABELS = {
  timeline: 'Request history timeline',
  timelineItem: 'Timeline event from {timestamp}',
  statusChange: 'Status changed to {status}',
  documentUpdate: 'Document {action} by {actor}',
  communication: 'Communication from {actor}',
};

// Interface definitions
interface RequestHistoryProps {
  requestId: string;
  className?: string;
  onError?: (error: Error) => void;
  onRetry?: () => void;
}

interface TimelineEvent {
  timestamp: string;
  status: AuthorizationStatus;
  actor: string;
  actorRole: string;
  description: string;
  type: string;
  eventCategory: string;
  metadata: Record<string, unknown>;
  ariaLabel: string;
}

/**
 * Enhanced RequestHistory component that displays a chronological timeline
 * of authorization request events with real-time updates and accessibility features
 */
export const RequestHistory: React.FC<RequestHistoryProps> = ({
  requestId,
  className,
  onError,
  onRetry,
}) => {
  const theme = useTheme();
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { getRequest } = useRequest();

  // Virtual scrolling setup for performance optimization
  const parentRef = React.useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: timelineEvents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => TIMELINE_ITEM_HEIGHT, []),
    overscan: 5,
  });

  /**
   * Processes workflow information into timeline events with enhanced metadata
   */
  const processTimelineEvents = useCallback((request: any): TimelineEvent[] => {
    if (!request?.workflow_info) return [];

    return request.workflow_info
      .map((event: any) => ({
        timestamp: event.timestamp,
        status: event.status,
        actor: event.actor,
        actorRole: event.actor_role,
        description: event.description,
        type: event.type,
        eventCategory: event.category,
        metadata: event.metadata || {},
        ariaLabel: formatAriaLabel(event),
      }))
      .sort((a: TimelineEvent, b: TimelineEvent) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }, []);

  /**
   * Formats ARIA labels for accessibility
   */
  const formatAriaLabel = (event: any): string => {
    const timestamp = new Date(event.timestamp).toLocaleString();
    switch (event.type) {
      case 'status_change':
        return ARIA_LABELS.statusChange.replace('{status}', event.status)
          .replace('{timestamp}', timestamp);
      case 'document_update':
        return ARIA_LABELS.documentUpdate
          .replace('{action}', event.metadata.action)
          .replace('{actor}', event.actor);
      case 'communication':
        return ARIA_LABELS.communication.replace('{actor}', event.actor);
      default:
        return ARIA_LABELS.timelineItem.replace('{timestamp}', timestamp);
    }
  };

  /**
   * Fetches request data and updates timeline
   */
  const fetchRequestData = useCallback(async () => {
    try {
      const response = await getRequest(requestId);
      if (response.success && response.data) {
        setTimelineEvents(processTimelineEvents(response.data));
      } else {
        throw new Error('Failed to fetch request data');
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [requestId, getRequest, processTimelineEvents, onError]);

  // Initial data fetch and polling setup
  useEffect(() => {
    fetchRequestData();
    const intervalId = setInterval(fetchRequestData, TIMELINE_UPDATE_INTERVAL);
    return () => clearInterval(intervalId);
  }, [fetchRequestData]);

  // Memoized timeline items for performance
  const virtualTimelineItems = useMemo(() => 
    rowVirtualizer.getVirtualItems().map((virtualRow) => {
      const event = timelineEvents[virtualRow.index];
      return (
        <TimelineItem
          key={`${event.timestamp}-${virtualRow.index}`}
          sx={{ minHeight: TIMELINE_ITEM_HEIGHT }}
          aria-label={event.ariaLabel}
        >
          <TimelineSeparator>
            <TimelineDot 
              color={STATUS_COLORS[event.status] as any}
              aria-label={`Status: ${event.status}`}
            />
          </TimelineSeparator>
          <TimelineContent>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                backgroundColor: theme.palette.background.paper,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <Typography variant="subtitle2" color="textSecondary">
                {new Date(event.timestamp).toLocaleString()}
              </Typography>
              <Typography variant="body1" gutterBottom>
                {event.description}
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {`${event.actor} (${event.actorRole})`}
              </Typography>
            </Paper>
          </TimelineContent>
        </TimelineItem>
      );
    }), [rowVirtualizer, timelineEvents, theme]);

  // Loading state with skeleton placeholder
  if (isLoading) {
    return (
      <Box className={className}>
        {[...Array(3)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={TIMELINE_ITEM_HEIGHT}
            sx={{ my: 1 }}
          />
        ))}
      </Box>
    );
  }

  return (
    <Box
      ref={parentRef}
      className={className}
      sx={{
        height: '100%',
        overflowY: 'auto',
        px: 2,
      }}
      role="region"
      aria-label={ARIA_LABELS.timeline}
    >
      <Timeline position="right">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${rowVirtualizer.getVirtualItems()[0]?.start ?? 0}px)`,
            }}
          >
            {virtualTimelineItems}
          </div>
        </div>
      </Timeline>
      {timelineEvents.length === 0 && (
        <Typography
          variant="body1"
          color="textSecondary"
          align="center"
          sx={{ py: 4 }}
        >
          No timeline events available
        </Typography>
      )}
    </Box>
  );
};

export default React.memo(RequestHistory);