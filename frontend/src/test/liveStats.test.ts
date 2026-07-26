import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTeamStats, getSwimmerStats, isRemoteMode } from '@/lib/api';

// Real server response shapes captured from /team-stats and /swimmer-stats.
const TEAM_STATS_RESPONSE = {
  data: [
    {
      team: { id: 't1', name: 'Die Hoggis', color: '#ffffff', assignedLane: 2 },
      totalLaps: 882, lapsPerHour: 37.09, fastestLapSec: 41.0,
      lateBirdLaps: 42, earlyBirdLaps: 45,
      activeSwimmer: { id: 's1', name: 'Moritz', laneNumber: 2 },
    },
  ],
};
const SWIMMER_STATS_RESPONSE = {
  data: [
    {
      swimmer: { id: 's1', name: 'Anton', teamId: 't1', teamName: 'Die Hoggis',
                 teamColor: '#ffffff', isUnder12: false },
      totalLaps: 277, lapsPerHour: 12.58, fastestLapSec: 53.0,
      lateBirdLaps: 0, earlyBirdLaps: 45, totalWaterSeconds: 24317,
    },
  ],
};

describe('live monitor stats (remote mode uses aggregate endpoints)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const body = url.includes('/team-stats') ? TEAM_STATS_RESPONSE
        : url.includes('/swimmer-stats') ? SWIMMER_STATS_RESPONSE
        : { data: [] };
      return { ok: true, status: 200, json: async () => body } as Response;
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('runs in remote mode (bundled config)', () => {
    expect(isRemoteMode()).toBe(true);
  });

  it('team stats: hits /team-stats and maps to the monitor shape', async () => {
    const stats = await getTeamStats('comp-1');
    const calledUrl = (fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/competitions/comp-1/team-stats');
    expect(stats).toHaveLength(1);
    const s = stats[0] as any;
    expect(s.team.color).toBe('#ffffff');
    expect(s.team.assignedLane).toBe(2);
    expect(s.totalLaps).toBe(882);
    expect(s.lapsPerHour).toBe(37.09);
    expect(s.fastestLap).toBe(41000); // seconds -> ms for formatTime()
    expect(s.lateBirdLaps).toBe(42);
  });

  it('swimmer stats: hits /swimmer-stats and maps team + lapsPerHour + fastestLap', async () => {
    const stats = await getSwimmerStats('comp-1');
    const calledUrl = (fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/competitions/comp-1/swimmer-stats');
    const s = stats[0] as any;
    expect(s.swimmer.name).toBe('Anton');
    expect(s.team.color).toBe('#ffffff');
    expect(s.team.name).toBe('Die Hoggis');
    expect(s.totalLaps).toBe(277);
    expect(s.lapsPerHour).toBe(12.58);
    expect(s.fastestLap).toBe(53000);
  });

  it('does NOT download the raw lap_counts table', async () => {
    await getTeamStats('comp-1');
    await getSwimmerStats('comp-1');
    const urls = (fetch as any).mock.calls.map((c: any[]) => c[0] as string);
    expect(urls.some(u => u.includes('/lap-counts'))).toBe(false);
  });
});
