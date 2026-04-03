import { useState, useEffect, useCallback } from 'react';

interface NetworkDebugState {
  activeRequests: number;
  lastFetchAt: Date | null;
  lastUrl: string;
}

// Store for network debug state with subscribers
const subscribers = new Set<(state: NetworkDebugState) => void>();
let currentState: NetworkDebugState = {
  activeRequests: 0,
  lastFetchAt: null,
  lastUrl: '',
};

// Update function that notifies all subscribers
export const updateNetworkDebug = (updates: Partial<NetworkDebugState>) => {
  currentState = { ...currentState, ...updates };
  subscribers.forEach(callback => callback(currentState));
};

// Hook to subscribe to network debug updates
export const useNetworkDebug = (): NetworkDebugState => {
  const [state, setState] = useState<NetworkDebugState>(currentState);

  useEffect(() => {
    // Subscribe to updates
    subscribers.add(setState);
    
    // Cleanup subscription on unmount
    return () => {
      subscribers.delete(setState);
    };
  }, []);

  return state;
};

// Utility functions to update network debug state
export const incrementActiveRequests = () => {
  updateNetworkDebug({ 
    activeRequests: currentState.activeRequests + 1 
  });
};

export const decrementActiveRequests = () => {
  updateNetworkDebug({ 
    activeRequests: Math.max(0, currentState.activeRequests - 1),
    lastFetchAt: new Date()
  });
};

export const setLastUrl = (url: string) => {
  updateNetworkDebug({ lastUrl: url });
};