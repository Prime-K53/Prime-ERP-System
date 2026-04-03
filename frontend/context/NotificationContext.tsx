import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { ExaminationBatchNotification } from '../types';
import { examinationNotificationService } from '../services/examinationNotificationService';

interface NotificationContextType {
  // State
  notifications: ExaminationBatchNotification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;

  // Actions
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  clearAllRead: () => Promise<void>;
  getNotificationById: (id: string) => ExaminationBatchNotification | undefined;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
  pollInterval?: number; // in milliseconds, default 30 seconds
  maxNotifications?: number; // max number to fetch, default 50
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  pollInterval = 30000,
  maxNotifications = 50
}) => {
  const [notifications, setNotifications] = useState<ExaminationBatchNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);
  
  // Request lock and retry control
  const isFetchingRef = useRef<boolean>(false);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 2;
  const retryDelayMs = 5000; // 5 seconds minimum between retries

  const fetchNotifications = useCallback(async (isInitialLoad: boolean = false) => {
    // Request lock: prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('[NotificationContext] Fetch already in progress, skipping...');
      return;
    }

    const now = Date.now();
    // Throttle polling: don't poll more than once every 10 seconds unless it's initial load
    if (!isInitialLoad && now - lastFetchTimeRef.current < 10000) {
      console.log('[NotificationContext] Throttled: too soon since last fetch');
      return;
    }

    // Check retry limit
    if (retryCountRef.current >= maxRetries) {
      console.warn(`[NotificationContext] Max retries (${maxRetries}) reached, stopping retry attempts`);
      return;
    }

    isFetchingRef.current = true;
    setLoading(true);
    setError(null);
    
    try {
      const user = examinationNotificationService.getCurrentUserId();
      if (!user) {
        console.log('[NotificationContext] No user found, clearing notifications');
        setNotifications([]);
        retryCountRef.current = 0; // Reset retry count on successful empty state
        return;
      }

      userIdRef.current = user;
      console.log('[NotificationContext] Fetching notifications for user:', user);
      const fetchedNotifications = await examinationNotificationService.getUserNotifications(user, maxNotifications);
      
      // Success: reset retry count
      retryCountRef.current = 0;
      console.log(`[NotificationContext] Successfully fetched ${fetchedNotifications.length} notifications`);

      // Merge with existing notifications, avoiding duplicates
      setNotifications(prev => {
        const merged = new Map<string, ExaminationBatchNotification>();

        // Add existing notifications first (preserve read status)
        prev.forEach(n => {
          const key = n.id;
          merged.set(key, n);
        });

        // Add/update with fetched notifications
        fetchedNotifications.forEach(n => {
          const existing = merged.get(n.id);
          if (existing) {
            // Keep the read status from existing if it's more recent
            merged.set(n.id, {
              ...n,
              is_read: existing.is_read,
              read_at: existing.read_at || n.read_at
            });
          } else {
            merged.set(n.id, n);
          }
        });

        // Convert back to array and sort by created_at descending
        return Array.from(merged.values())
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, maxNotifications);
      });

      lastFetchTimeRef.current = now;
    } catch (err) {
      // Only set error for non-network failures; network failures are handled gracefully with fallback
      const isNetworkError = err instanceof TypeError ||
        (err instanceof Error && (
          err.message.includes('Failed to fetch') ||
          err.message.includes('ERR_CONNECTION') ||
          err.message.includes('Network') ||
          err.message.includes('timeout')
        ));

      if (isNetworkError) {
        // Increment retry count for network errors
        retryCountRef.current += 1;
        console.warn(`[NotificationContext] Network error, retry ${retryCountRef.current}/${maxRetries}`);
        
        // If we haven't reached max retries, schedule a retry with delay
        if (retryCountRef.current < maxRetries) {
          console.log(`[NotificationContext] Retrying in ${retryDelayMs}ms...`);
          setTimeout(() => {
            isFetchingRef.current = false; // Release lock before retry
            fetchNotifications(false);
          }, retryDelayMs);
          return; // Don't release lock yet, let retry handle it
        } else {
          console.error('[NotificationContext] Stopped retrying: max retries reached');
        }
      } else {
        const message = err instanceof Error ? err.message : 'Failed to fetch notifications';
        setError(message);
        console.error('[NotificationContext] Error fetching notifications:', err);
      }
    } finally {
      // Only release lock if we're not scheduling a retry
      if (retryCountRef.current >= maxRetries || retryCountRef.current === 0) {
        isFetchingRef.current = false;
      }
      setLoading(false);
    }
  }, [maxNotifications]);

  const refreshNotifications = useCallback(async () => {
    // Reset retry count on manual refresh
    retryCountRef.current = 0;
    isFetchingRef.current = false; // Release any existing lock
    console.log('[NotificationContext] Manual refresh triggered, retry count reset');
    await fetchNotifications(false);
  }, [fetchNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    try {
      await examinationNotificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, is_read: true, read_at: new Date().toISOString() }
            : n
        )
      );
    } catch (err) {
      console.error('[NotificationContext] Error marking notification as read:', err);
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
      throw err;
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId: string) => {
    try {
      await examinationNotificationService.dismissNotification(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('[NotificationContext] Error dismissing notification:', err);
      setError(err instanceof Error ? err.message : 'Failed to dismiss notification');
      throw err;
    }
  }, []);

  const clearAllRead = useCallback(async () => {
    try {
      const readNotifications = notifications.filter(n => n.is_read);
      await Promise.all(
        readNotifications.map(n => examinationNotificationService.dismissNotification(n.id))
      );
      setNotifications(prev => prev.filter(n => !n.is_read));
    } catch (err) {
      console.error('[NotificationContext] Error clearing read notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to clear read notifications');
      throw err;
    }
  }, [notifications]);

  const getNotificationById = useCallback((id: string) => {
    return notifications.find(n => n.id === id);
  }, [notifications]);

  // Initial load: run once on mount
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    (async () => { await fetchNotifications(true); })();
    // Intentionally run once on mount. fetchNotifications is stable enough for this use-case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up polling for real-time updates
  useEffect(() => {
    // enforce minimum polling interval of 15s
    const effectiveInterval = Math.max(15000, Number(pollInterval || 0));
    if (effectiveInterval > 0) {
      pollIntervalRef.current = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        fetchNotifications(false);
      }, effectiveInterval);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollInterval]);

  // Listen for storage events (for cross-tab sync)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'nexus_notification_update' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data.userId === userIdRef.current) {
            // Refresh notifications from another tab
            fetchNotifications(false);
          }
        } catch (err) {
          // Ignore invalid data
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [fetchNotifications]);

  const value: NotificationContextType = {
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    loading,
    error,
    refreshNotifications,
    markAsRead,
    dismissNotification,
    clearAllRead,
    getNotificationById
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;