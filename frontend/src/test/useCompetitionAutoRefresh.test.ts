import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useCompetitionAutoRefresh } from '@/hooks/useCompetitionAutoRefresh';

vi.mock('@/lib/api', () => ({
  dataApi: {
    getCompetitionById: vi.fn(),
    getActiveSwimSessions: vi.fn(),
  },
}));
import { dataApi } from '@/lib/api';

const getCompetitionById = dataApi.getCompetitionById as unknown as ReturnType<typeof vi.fn>;
const getActiveSwimSessions = dataApi.getActiveSwimSessions as unknown as ReturnType<typeof vi.fn>;

describe('useCompetitionAutoRefresh', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it('polls and pushes the status change when the organizer presses Start', async () => {
    // Simulates the organizer flipping upcoming -> active between polls.
    let status = 'upcoming';
    getCompetitionById.mockImplementation(async () => ({ id: 'c1', status }));
    getActiveSwimSessions.mockResolvedValue([{ id: 's1', isActive: true }]);

    const onCompetition = vi.fn();
    const onActiveSessions = vi.fn();
    renderHook(() =>
      useCompetitionAutoRefresh({ competitionId: 'c1', onCompetition, onActiveSessions, intervalMs: 1000 }),
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(getCompetitionById).toHaveBeenCalledWith('c1');
    expect(onCompetition).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'upcoming' }));

    // Organizer presses Start; the next poll must surface 'active'.
    status = 'active';
    await vi.advanceTimersByTimeAsync(1000);
    expect(onCompetition).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'active' }));
    expect(onActiveSessions).toHaveBeenCalledWith([{ id: 's1', isActive: true }]);
  });

  it('filters out inactive sessions', async () => {
    getCompetitionById.mockResolvedValue({ id: 'c1', status: 'active' });
    getActiveSwimSessions.mockResolvedValue([
      { id: 'a', isActive: true },
      { id: 'b', isActive: false },
    ]);
    const onActiveSessions = vi.fn();
    renderHook(() =>
      useCompetitionAutoRefresh({ competitionId: 'c1', onCompetition: vi.fn(), onActiveSessions, intervalMs: 1000 }),
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(onActiveSessions).toHaveBeenCalledWith([{ id: 'a', isActive: true }]);
  });

  it('does not poll when no competition is selected', async () => {
    renderHook(() =>
      useCompetitionAutoRefresh({ competitionId: undefined, onCompetition: vi.fn(), onActiveSessions: vi.fn() }),
    );
    await vi.advanceTimersByTimeAsync(6000);
    expect(getCompetitionById).not.toHaveBeenCalled();
  });

  it('flags a network failure but not a server (HTTP) error', async () => {
    const onSyncError = vi.fn();
    // No numeric `status` => treated as a network failure.
    getCompetitionById.mockRejectedValueOnce({});
    const { rerender } = renderHook(
      (props: { id: string }) =>
        useCompetitionAutoRefresh({
          competitionId: props.id, onCompetition: vi.fn(), onActiveSessions: vi.fn(),
          onSyncError, intervalMs: 1000,
        }),
      { initialProps: { id: 'c1' } },
    );
    await vi.advanceTimersByTimeAsync(1000);
    expect(onSyncError).toHaveBeenCalledTimes(1);

    // A server response (numeric status) must NOT flag the connection as down.
    onSyncError.mockClear();
    getCompetitionById.mockRejectedValue({ status: 422 });
    rerender({ id: 'c1' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(onSyncError).not.toHaveBeenCalled();
  });
});
