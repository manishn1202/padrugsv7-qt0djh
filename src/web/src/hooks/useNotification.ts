// React v18.2.0
import { useState, useCallback, useRef, useEffect } from 'react';
// uuid v9.0.0
import { v4 as uuidv4 } from 'uuid';
import {
  Notification,
  NotificationType,
  NotificationPriority
} from '../../types/common.types';

// Constants for notification configuration
const DEFAULT_DURATION = 5000; // 5 seconds
const MAX_NOTIFICATIONS = 5;
const PRIORITY_WEIGHTS = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1
} as const;

/**
 * Interface defining the return type of the useNotification hook
 */
interface NotificationHookReturn {
  notifications: Notification[];
  showNotification: (
    type: NotificationType,
    message: string,
    priority?: NotificationPriority,
    isPersistent?: boolean,
    duration?: number
  ) => void;
  hideNotification: (id: string) => void;
  clearAllNotifications: () => void;
  updateNotificationPriority: (id: string, priority: NotificationPriority) => void;
}

/**
 * Custom hook for managing the application's notification system
 * Supports different notification types, priorities, and persistence options
 * Implements intelligent stacking and auto-dismissal behavior
 */
export const useNotification = (): NotificationHookReturn => {
  // State to store active notifications
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Ref to store notification timers for cleanup
  const timerRefs = useRef<Record<string, NodeJS.Timeout>>({});

  /**
   * Sorts notifications by priority and timestamp
   */
  const sortNotifications = useCallback((notifs: Notification[]): Notification[] => {
    return [...notifs].sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
      return priorityDiff === 0 ? b.timestamp - a.timestamp : priorityDiff;
    });
  }, []);

  /**
   * Shows a new notification with specified parameters
   */
  const showNotification = useCallback(
    (
      type: NotificationType,
      message: string,
      priority: NotificationPriority = NotificationPriority.LOW,
      isPersistent = false,
      duration = DEFAULT_DURATION
    ) => {
      const id = uuidv4();
      const newNotification: Notification = {
        id,
        type,
        message,
        priority,
        isPersistent,
        duration,
        timestamp: Date.now()
      };

      setNotifications(currentNotifications => {
        let updatedNotifications = [...currentNotifications];

        // Handle maximum notifications limit
        if (updatedNotifications.length >= MAX_NOTIFICATIONS) {
          // Find and remove the oldest low priority notification
          const lowestPriorityIndex = updatedNotifications.findIndex(
            n => n.priority === NotificationPriority.LOW && !n.isPersistent
          );

          if (lowestPriorityIndex !== -1) {
            const removedNotification = updatedNotifications[lowestPriorityIndex];
            if (timerRefs.current[removedNotification.id]) {
              clearTimeout(timerRefs.current[removedNotification.id]);
              delete timerRefs.current[removedNotification.id];
            }
            updatedNotifications.splice(lowestPriorityIndex, 1);
          } else if (priority === NotificationPriority.LOW) {
            // Don't add new low priority notification if no space
            return currentNotifications;
          }
        }

        updatedNotifications.push(newNotification);
        return sortNotifications(updatedNotifications);
      });

      // Set auto-dismiss timer for non-persistent notifications
      if (!isPersistent) {
        timerRefs.current[id] = setTimeout(() => {
          hideNotification(id);
        }, duration);
      }
    },
    [sortNotifications]
  );

  /**
   * Hides a specific notification by ID
   */
  const hideNotification = useCallback((id: string) => {
    // Clear the auto-dismiss timer if it exists
    if (timerRefs.current[id]) {
      clearTimeout(timerRefs.current[id]);
      delete timerRefs.current[id];
    }

    setNotifications(current => current.filter(notification => notification.id !== id));
  }, []);

  /**
   * Clears all notifications and their timers
   */
  const clearAllNotifications = useCallback(() => {
    // Clear all timers
    Object.values(timerRefs.current).forEach(timer => clearTimeout(timer));
    timerRefs.current = {};
    setNotifications([]);
  }, []);

  /**
   * Updates the priority of an existing notification
   */
  const updateNotificationPriority = useCallback(
    (id: string, priority: NotificationPriority) => {
      setNotifications(current => {
        const notificationIndex = current.findIndex(n => n.id === id);
        if (notificationIndex === -1) return current;

        const updatedNotifications = [...current];
        updatedNotifications[notificationIndex] = {
          ...updatedNotifications[notificationIndex],
          priority
        };

        return sortNotifications(updatedNotifications);
      });
    },
    [sortNotifications]
  );

  /**
   * Cleanup effect to clear timers on unmount
   */
  useEffect(() => {
    return () => {
      Object.values(timerRefs.current).forEach(timer => clearTimeout(timer));
    };
  }, []);

  return {
    notifications,
    showNotification,
    hideNotification,
    clearAllNotifications,
    updateNotificationPriority
  };
};