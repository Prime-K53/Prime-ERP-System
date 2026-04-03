import { useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for optimized message event handling that prevents 'Violation' warnings
 * by using passive event listeners and batching updates
 */
export function useOptimizedMessageHandler(
  handler: (event: MessageEvent) => void,
  options: {
    passive?: boolean;
    enabled?: boolean;
    batchUpdates?: boolean;
    batchDelay?: number;
  } = {}
) {
  const { passive = true, enabled = true, batchUpdates = false, batchDelay = 16 } = options;
  const handlerRef = useRef<(event: MessageEvent) => void>(undefined);
  const batchRef = useRef<MessageEvent[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Remember the latest handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  // Process batched messages
  const processBatch = useCallback(() => {
    if (batchRef.current.length > 0 && handlerRef.current) {
      const messages = [...batchRef.current];
      batchRef.current = [];
      
      // Process all batched messages
      messages.forEach(event => {
        try {
          handlerRef.current?.(event);
        } catch (error) {
          console.error('Error processing batched message:', error);
        }
      });
    }
  }, []);

  // Set up the message listener
  useEffect(() => {
    if (!enabled) return;

    const handleMessage = (event: MessageEvent) => {
      if (batchUpdates) {
        // Batch updates to prevent frequent handler calls
        batchRef.current.push(event);
        
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        
        timeoutRef.current = setTimeout(processBatch, batchDelay);
      } else {
        // Immediate processing with error handling
        try {
          handlerRef.current?.(event);
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    };

    // Use passive listener for better performance
    window.addEventListener('message', handleMessage, { passive });

    return () => {
      window.removeEventListener('message', handleMessage);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [enabled, passive, batchUpdates, batchDelay, processBatch]);

  // Return a function to manually clear the batch
  const clearBatch = useCallback(() => {
    batchRef.current = [];
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  return clearBatch;
}