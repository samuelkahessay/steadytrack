/**
 * Core localStorage wrapper with SSR guards, namespacing, and cross-tab sync
 *
 * All data is stored with the prefix: steadytrack:v1:<domain>
 * Example keys:
 * - steadytrack:v1:plan
 * - steadytrack:v1:progress:<planId>
 * - steadytrack:v1:resources:<planId>
 * - steadytrack:v1:streak
 * - steadytrack:v1:infinite
 * - steadytrack:v1:quick-checks
 */

const STORAGE_PREFIX = 'steadytrack:v1:';

/**
 * Storage operation result type
 */
export type StorageResult<T> =
  | { success: true; data: T }
  | { success: false; error: StorageError };

/**
 * Storage error types
 */
export enum StorageErrorType {
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  NOT_AVAILABLE = 'NOT_AVAILABLE',
  PARSE_ERROR = 'PARSE_ERROR',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Storage error class
 */
export class StorageError extends Error {
  constructor(
    public type: StorageErrorType,
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

/**
 * Storage event callback type
 */
export type StorageEventCallback = (key: string, newValue: string | null, oldValue: string | null) => void;

/**
 * Check if localStorage is available (SSR guard)
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build namespaced key
 */
function buildKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

/**
 * Extract original key from namespaced key
 */
function extractKey(namespacedKey: string): string | null {
  if (!namespacedKey.startsWith(STORAGE_PREFIX)) return null;
  return namespacedKey.slice(STORAGE_PREFIX.length);
}

/**
 * Get value from localStorage with type safety
 */
export function get<T>(key: string, fallback: T): T {
  if (!isStorageAvailable()) return fallback;

  try {
    const namespacedKey = buildKey(key);
    const stored = window.localStorage.getItem(namespacedKey);

    if (stored === null) return fallback;

    return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`Failed to get localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * Set value in localStorage with type safety and quota error handling
 * @returns StorageResult with success status and data or error
 */
export function set<T>(key: string, value: T): StorageResult<void> {
  if (!isStorageAvailable()) {
    return {
      success: false,
      error: new StorageError(
        StorageErrorType.NOT_AVAILABLE,
        'localStorage is not available (SSR or private browsing mode)'
      ),
    };
  }

  try {
    const namespacedKey = buildKey(key);
    window.localStorage.setItem(namespacedKey, JSON.stringify(value));
    return { success: true, data: undefined };
  } catch (error) {
    // Check if it's a quota exceeded error
    if (
      error instanceof DOMException &&
      (error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      const currentSize = getStorageSize();
      const estimatedSize = estimateSize(value);

      console.error(
        `localStorage quota exceeded. Current size: ${formatBytes(currentSize)}, ` +
        `Attempted to add: ${formatBytes(estimatedSize)}`
      );

      return {
        success: false,
        error: new StorageError(
          StorageErrorType.QUOTA_EXCEEDED,
          `Storage quota exceeded. Current usage: ${formatBytes(currentSize)}. ` +
          `Try exporting and clearing old data.`,
          error
        ),
      };
    }

    // Other errors
    console.error(`Failed to set localStorage key "${key}":`, error);
    return {
      success: false,
      error: new StorageError(
        StorageErrorType.UNKNOWN,
        `Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error
      ),
    };
  }
}

/**
 * Legacy set function for backward compatibility
 * @deprecated Use set() which returns StorageResult instead
 */
export function setLegacy<T>(key: string, value: T): boolean {
  const result = set(key, value);
  return result.success;
}

/**
 * Update value in localStorage using an updater function
 * @returns StorageResult with success status
 */
export function update<T>(
  key: string,
  updater: (current: T) => T,
  fallback: T
): StorageResult<void> {
  const current = get<T>(key, fallback);
  const updated = updater(current);
  return set(key, updated);
}

/**
 * Legacy update function for backward compatibility
 * @deprecated Use update() which returns StorageResult instead
 */
export function updateLegacy<T>(
  key: string,
  updater: (current: T) => T,
  fallback: T
): boolean {
  const result = update(key, updater, fallback);
  return result.success;
}

/**
 * Remove a specific key from localStorage
 */
export function remove(key: string): void {
  if (!isStorageAvailable()) return;

  try {
    const namespacedKey = buildKey(key);
    window.localStorage.removeItem(namespacedKey);
  } catch (error) {
    console.error(`Failed to remove localStorage key "${key}":`, error);
  }
}

/**
 * Clear all keys with optional prefix filter
 * @param prefix - If provided, only clear keys starting with this prefix (after namespace)
 * @example
 * clear() // Clears all steadytrack:v1:* keys
 * clear('progress:') // Clears all steadytrack:v1:progress:* keys
 */
export function clear(prefix?: string): void {
  if (!isStorageAvailable()) return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      // Only process our namespaced keys
      if (!key.startsWith(STORAGE_PREFIX)) continue;

      // If prefix is specified, only remove matching keys
      if (prefix) {
        const originalKey = extractKey(key);
        if (originalKey && originalKey.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      } else {
        // No prefix, remove all our keys
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => window.localStorage.removeItem(key));
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }
}

/**
 * Get all keys (without namespace prefix)
 */
export function getAllKeys(): string[] {
  if (!isStorageAvailable()) return [];

  try {
    const keys: string[] = [];

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;

      const originalKey = extractKey(key);
      if (originalKey) {
        keys.push(originalKey);
      }
    }

    return keys;
  } catch (error) {
    console.error('Failed to get all keys:', error);
    return [];
  }
}

/**
 * Subscribe to storage events for cross-tab synchronization
 * Returns an unsubscribe function
 */
export function subscribe(callback: StorageEventCallback): () => void {
  if (!isStorageAvailable()) return () => {};

  const handler = (e: StorageEvent) => {
    // Only handle our namespaced keys
    if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;

    const originalKey = extractKey(e.key);
    if (!originalKey) return;

    callback(originalKey, e.newValue, e.oldValue);
  };

  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener('storage', handler);
  };
}

/**
 * Get storage size estimate in bytes
 */
export function getStorageSize(): number {
  if (!isStorageAvailable()) return 0;

  try {
    let total = 0;

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

      const value = window.localStorage.getItem(key);
      if (value) {
        // Rough estimate: key length + value length in bytes (UTF-16)
        total += (key.length + value.length) * 2;
      }
    }

    return total;
  } catch (error) {
    console.error('Failed to get storage size:', error);
    return 0;
  }
}

/**
 * Export all data as JSON (for backup/export feature)
 */
export function exportAll(): Record<string, unknown> {
  if (!isStorageAvailable()) return {};

  try {
    const data: Record<string, unknown> = {};

    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

      const originalKey = extractKey(key);
      if (!originalKey) continue;

      const value = window.localStorage.getItem(key);
      if (value) {
        try {
          data[originalKey] = JSON.parse(value);
        } catch {
          // If parse fails, store as string
          data[originalKey] = value;
        }
      }
    }

    return data;
  } catch (error) {
    console.error('Failed to export data:', error);
    return {};
  }
}

/**
 * Import data from JSON (for restore feature)
 * @param data - Object with key-value pairs to import
 * @param clearExisting - If true, clear existing data before import
 */
export function importAll(data: Record<string, unknown>, clearExisting = false): boolean {
  if (!isStorageAvailable()) return false;

  try {
    if (clearExisting) {
      clear();
    }

    Object.entries(data).forEach(([key, value]) => {
      set(key, value);
    });

    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

// ============================================================================
// QUOTA MANAGEMENT UTILITIES
// ============================================================================

/**
 * Estimate the size of data in bytes (UTF-16 encoding)
 */
export function estimateSize<T>(data: T): number {
  try {
    const jsonString = JSON.stringify(data);
    // Each character in JavaScript is 2 bytes (UTF-16)
    return jsonString.length * 2;
  } catch {
    return 0;
  }
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * Get quota information
 */
export interface QuotaInfo {
  used: number;
  available: number;
  total: number;
  percentUsed: number;
  formattedUsed: string;
  formattedTotal: string;
}

/**
 * Get storage quota information
 * Note: Most browsers have a 5-10MB limit for localStorage
 */
export function getQuotaInfo(): QuotaInfo {
  const used = getStorageSize();
  // Most browsers allow 5-10MB; we'll use conservative 5MB estimate
  const total = 5 * 1024 * 1024; // 5MB in bytes
  const available = Math.max(0, total - used);
  const percentUsed = Math.round((used / total) * 100);

  return {
    used,
    available,
    total,
    percentUsed,
    formattedUsed: formatBytes(used),
    formattedTotal: formatBytes(total),
  };
}

/**
 * Check if sufficient quota is available for data
 * @param estimatedBytes - Estimated size of data to store
 * @param bufferPercent - Safety buffer as percentage (default 10%)
 * @returns true if space is available
 */
export function checkQuotaAvailable(
  estimatedBytes: number,
  bufferPercent = 10
): boolean {
  const quota = getQuotaInfo();
  const requiredBytes = estimatedBytes * (1 + bufferPercent / 100);
  return quota.available >= requiredBytes;
}

/**
 * Check if storage is approaching quota limit
 * @param warningThreshold - Percentage at which to warn (default 80%)
 */
export function isApproachingQuota(warningThreshold = 80): boolean {
  const quota = getQuotaInfo();
  return quota.percentUsed >= warningThreshold;
}

/**
 * Get the oldest keys to help with data pruning
 * Note: This is best-effort as localStorage doesn't track access times
 */
export function getOldestKeys(limit = 10): string[] {
  if (!isStorageAvailable()) return [];

  try {
    const keys = getAllKeys();
    // Return keys that look like they might be old progress data
    // Priority: progress, resources, old sessions
    const progressKeys = keys.filter(k => k.startsWith('progress:'));
    const resourceKeys = keys.filter(k => k.startsWith('resources:'));

    return [...progressKeys, ...resourceKeys].slice(0, limit);
  } catch (error) {
    console.error('Failed to get oldest keys:', error);
    return [];
  }
}
