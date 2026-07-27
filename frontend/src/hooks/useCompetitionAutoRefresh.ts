import { useEffect } from 'react';
import { dataApi } from '@/lib/api';
import { isNetworkError } from '@/hooks/useConnectionStatus';
import { Competition, SwimSession } from '@/types';

/**
 * Poll the selected competition so the referee screen reacts to the organizer
 * pressing Start (or Pause/Finish) WITHOUT a manual page reload.
 *
 * The +1 lap button is gated on competition.status === 'active'. Previously the
 * referee had to reload the page to pick up the status change — and iPad Safari
 * can block that reload, leaving referees unable to count. This poll flips the
 * button to enabled within `intervalMs` of Start, and keeps active sessions in
 * sync (e.g. check-ins by other referees).
 *
 * Callbacks must be stable (useState setters / useCallback) so the polling
 * interval isn't torn down and recreated on every render.
 */
export function useCompetitionAutoRefresh(params: {
  competitionId: string | undefined;
  onCompetition: (competition: Competition) => void;
  onActiveSessions: (sessions: SwimSession[]) => void;
  onSynced?: () => void;
  onSyncError?: () => void;
  intervalMs?: number;
}): void {
  const {
    competitionId,
    onCompetition,
    onActiveSessions,
    onSynced,
    onSyncError,
    intervalMs = 5000,
  } = params;

  useEffect(() => {
    if (!competitionId) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const updated = await dataApi.getCompetitionById(competitionId);
        if (cancelled || !updated) return;
        onCompetition(updated);

        const sessions = await dataApi.getActiveSwimSessions(competitionId);
        if (cancelled) return;
        onActiveSessions(sessions.filter(s => s.isActive));
        onSynced?.();
      } catch (error) {
        // A server response (any HTTP status) still proves reachability; only a
        // genuine network failure should flag the connection as down.
        if (isNetworkError(error)) onSyncError?.();
      }
    };

    const id = setInterval(() => { void poll(); }, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [competitionId, onCompetition, onActiveSessions, onSynced, onSyncError, intervalMs]);
}
