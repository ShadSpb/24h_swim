import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Whether an error represents a genuine connectivity failure (no response from
 * the server) rather than a server-side rejection.
 *
 * A server that answers — even with an HTTP error like 429 "double count
 * detected", 422, or 4xx — is reachable, so it must NOT flip the connection
 * indicator to "offline". Our RemoteApiError carries a numeric `status` only
 * when the server responded; a network failure leaves it undefined.
 */
export function isNetworkError(error: unknown): boolean {
  return typeof (error as { status?: unknown } | null | undefined)?.status !== 'number';
}

export interface ConnectionStatus {
  /** Best estimate of whether the server is currently reachable. */
  online: boolean;
  /** Epoch ms of the last confirmed successful server interaction, or null. */
  lastSyncedAt: number | null;
  /** Call after any successful server write/read to record a sync. */
  markSynced: () => void;
  /** Call when a server request fails (network/HTTP error). */
  markSyncError: () => void;
}

/**
 * Tracks connectivity for a long-running operator screen (the referee lap
 * counter). It combines three signals:
 *  - the browser's online/offline events (instant feedback for airplane mode),
 *  - the success/failure reported by real API calls via markSynced/markSyncError,
 *  - a periodic lightweight probe so a referee who isn't tapping still finds out
 *    the backend went away.
 *
 * `probe` is held in a ref so callers don't have to memoise it; the interval is
 * (re)started only when `enabled` or `intervalMs` change.
 */
export function useConnectionStatus(
  enabled: boolean,
  probe: () => Promise<unknown>,
  intervalMs = 15000,
): ConnectionStatus {
  const [browserOnline, setBrowserOnline] = useState<boolean>(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );
  const [serverReachable, setServerReachable] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const markSynced = useCallback(() => {
    setServerReachable(true);
    setLastSyncedAt(Date.now());
  }, []);

  const markSyncError = useCallback(() => {
    setServerReachable(false);
  }, []);

  // Browser-level connectivity events.
  useEffect(() => {
    const goOnline = () => setBrowserOnline(true);
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Periodic reachability probe.
  const probeRef = useRef(probe);
  probeRef.current = probe;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const run = async () => {
      try {
        await probeRef.current();
        if (!cancelled) markSynced();
      } catch (error) {
        // A server response (any HTTP status) still proves reachability.
        if (!cancelled) {
          if (isNetworkError(error)) markSyncError();
          else markSynced();
        }
      }
    };

    void run();
    const id = setInterval(() => { void run(); }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, intervalMs, markSynced, markSyncError]);

  return {
    online: browserOnline && serverReachable,
    lastSyncedAt,
    markSynced,
    markSyncError,
  };
}
