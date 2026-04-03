import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for optimized setInterval that prevents unnecessary re-renders
 * and handles cleanup properly to avoid 'Violation' warnings
 */
export function useOptimizedInterval(
  callback: () => void,
  delay: number | null,
  options: {
    immediate?: boolean;
    enabled?: boolean;
  } = {}
) {
  const { immediate = false, enabled = true } = options;
  const savedCallback = useRef<() => void>(undefined);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest callback
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // Don't schedule if delay is null or disabled
    if (!enabled || delay === null) {
      return;
    }

    // Execute immediately if requested
    if (immediate) {
      savedCallback.current?.();
    }

    // Use requestAnimationFrame for smoother timing when possible
    const tick = () => {
      if (savedCallback.current) {
        // Use requestIdleCallback if available, otherwise fallback to setTimeout
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(() => {
            savedCallback.current?.();
          }, { timeout: delay });
        } else {
          savedCallback.current();
        }
      }
    };

    intervalRef.current = setInterval(tick, delay);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [delay, enabled, immediate]);

  // Return a function to manually clear the interval
  const clearOptimizedInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  return clearOptimizedInterval;
}