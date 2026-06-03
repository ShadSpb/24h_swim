import { useState, useEffect, useCallback, useRef } from 'react';

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
      } catch {
        if (!cancelled) markSyncError();
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
