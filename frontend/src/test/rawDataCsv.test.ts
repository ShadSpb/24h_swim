import { describe, it, expect } from 'vitest';
import { generateCompetitionRawDataCSV } from '@/lib/utils/pdfGenerator';
import type { Competition, Team, Swimmer, Referee, SwimSession } from '@/types';
import type { LapCount } from '@/lib/api/types';

function decode(dataUri: string): string {
  const comma = dataUri.indexOf(',');
  return decodeURIComponent(dataUri.slice(comma + 1)).replace(/^﻿/, '');
}

const competition = {
  id: 'comp-1', slug: 'berlin', name: 'City 24h', description: 'desc', date: '2026-08-01',
  startTime: '10:00', endTime: '', location: 'Pool', numberOfLanes: 2, laneLength: 50,
  doubleCountTimeout: 15, organizerId: 'org-1', status: 'completed', autoStart: false,
  autoFinish: false, earlyBirdHour: 5, lateBirdHour: 0, birdWindowMinutes: 60,
  actualStartTime: '2026-08-01T10:00:00Z', actualEndTime: '2026-08-02T10:00:00Z', createdAt: 'x',
} as Competition;

const teams: Team[] = [
  { id: 't1', name: 'Sharks', color: '#000', competitionId: 'comp-1', assignedLane: 1, createdAt: 'a' },
];
const swimmers: Swimmer[] = [
  { id: 'sw1', name: 'Alice', teamId: 't1', competitionId: 'comp-1', dateOfBirth: '2010-05-01', isUnder12: false, parentName: 'Bob', parentContact: 'bob@x.com', createdAt: 'a' },
  // Zero-lap swimmer: must still appear in the raw export.
  { id: 'sw2', name: 'Zoe NoLaps', teamId: 't1', competitionId: 'comp-1', dateOfBirth: null, isUnder12: true, createdAt: 'b' },
];
const referees: Referee[] = [
  { id: 'r1', userId: 'ref_123', name: 'Ref One', email: 'r@x.com', passwordHash: 'HASH', competitionId: 'comp-1', createdAt: 'a' },
];
const sessions: SwimSession[] = [
  { id: 'se1', competitionId: 'comp-1', swimmerId: 'sw1', teamId: 't1', laneNumber: 1, startTime: '2026-08-01T10:01:00Z', endTime: '2026-08-01T10:30:00Z', lapCount: 1, isActive: false },
];
const lapCounts: LapCount[] = [
  { id: 'lap1', competitionId: 'comp-1', laneNumber: 1, teamId: 't1', swimmerId: 'sw1', refereeId: 'r1', lapNumber: 1, timestamp: '2026-08-01T10:05:00Z' },
];

describe('generateCompetitionRawDataCSV', () => {
  const csv = decode(generateCompetitionRawDataCSV(competition, teams, swimmers, referees, sessions, lapCounts));

  it('contains every raw section', () => {
    for (const section of ['# COMPETITION', '# TEAMS', '# SWIMMERS', '# REFEREES', '# SWIM SESSIONS', '# LAP COUNTS (raw event log)']) {
      expect(csv).toContain(section);
    }
  });

  it('includes competition metadata (lane length, times, status)', () => {
    expect(csv).toContain('comp-1');
    expect(csv).toContain('City 24h');
    expect(csv).toContain('50'); // laneLength
    expect(csv).toContain('2026-08-02T10:00:00Z'); // actualEndTime
  });

  it('includes swimmers with zero laps and their raw fields + ids', () => {
    expect(csv).toContain('Zoe NoLaps');   // 0-lap swimmer present
    expect(csv).toContain('sw2');
    expect(csv).toContain('2010-05-01');    // DOB preserved
    expect(csv).toContain('bob@x.com');     // parent contact (organizer's own data)
  });

  it('includes referees and swim sessions', () => {
    expect(csv).toContain('ref_123');
    expect(csv).toContain('se1');
  });

  it('includes the raw lap event log with ids', () => {
    expect(csv).toContain('lap1');
    expect(csv).toContain('2026-08-01T10:05:00Z');
  });

  it('does NOT leak referee password hashes', () => {
    expect(csv).not.toContain('HASH');
  });
});
