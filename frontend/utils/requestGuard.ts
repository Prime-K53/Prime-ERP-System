/**
 * Request Guard Utility
 * Prevents duplicate API calls by tracking active requests
 */

// Global map to track active requests
const activeRequests = new Map<string, Promise<any>>();

/**
 * Generates a unique key for the request based on method and URL
 */
const getRequestKey = (method: string, url: string): string => {
  return `${method.toUpperCase()}:${url}`;
};

/**
 * Executes a request only if it's not already in progress
 * If a request with the same key is already running, returns the existing promise
 * 
 * @param key - Unique identifier for the request (e.g., 'GET:/api/sales')
 * @param requestFn - The async function to execute
 * @returns Promise that resolves with the request result
 */
export const fetchOnce = async <T>(
  key: string,
  requestFn: () => Promise<T>
): Promise<T> => {
  // Check if request is already in progress
  if (activeRequests.has(key)) {
    console.log(`[RequestGuard] Skipping duplicate request: ${key}`);
    return activeRequests.get(key) as Promise<T>;
  }

  // Create a new request promise
  const requestPromise = (async () => {
    try {
      const result = await requestFn();
      return result;
    } finally {
      // Remove from active requests when done (success or failure)
      activeRequests.delete(key);
    }
  })();

  // Store the promise in the map
  activeRequests.set(key, requestPromise);

  return requestPromise;
};

/**
 * Creates a request key for API calls
 */
export const createRequestKey = (method: string, endpoint: string): string => {
  return getRequestKey(method, endpoint);
};

/**
 * Checks if a request is currently in progress
 */
export const isRequestActive = (key: string): boolean => {
  return activeRequests.has(key);
};

/**
 * Clears all active requests (useful for testing or cleanup)
 */
export const clearAllRequests = (): void => {
  activeRequests.clear();
};

/**
 * Gets the count of active requests
 */
export const getActiveRequestCount = (): number => {
  return activeRequests.size;
};

export default {
  fetchOnce,
  createRequestKey,
  isRequestActive,
  clearAllRequests,
  getActiveRequestCount,
};