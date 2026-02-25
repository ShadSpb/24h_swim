// LocalStorage utilities for SwimTrack 24
// NOTE: This module is for LOCAL storage mode only.
// When Remote API mode is enabled, operations will throw an error.

import { Competition, Team, Swimmer, Referee, SwimSession } from '@/types';
import {getSiteConfig} from '@/lib/config/siteConfig'

// Re-export types that are defined in this file
export type { LaneAssignment, LapCount };

interface LaneAssignment {
  id: string;
  competitionId: string;
  laneNumber: number;
  refereeId: string | null;
  activeSwimmerId: string | null;
  registeredAt: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface LapCount {
  id: string;
  competitionId: string;
  laneNumber: number;
  teamId: string;
  swimmerId: string;
  refereeId: string;
  timestamp: string;
  lapNumber: number;
}

const KEYS = {
  competitions: 'swimtrack_competitions',
  teams: 'swimtrack_teams',
  swimmers: 'swimtrack_swimmers',
  referees: 'swimtrack_referees',
  laneAssignments: 'swimtrack_lane_assignments',
  lapCounts: 'swimtrack_lap_counts',
  swimSessions: 'swimtrack_swim_sessions',
};

// Check if remote API mode is enabled
function checkRemoteMode(): void {
  const config = getSiteConfig()
  if (config) {
    try {
      if (config.storage?.type === 'remote') {
        throw new Error('Remote API mode is enabled. Local storage operations are disabled. Please configure your remote API endpoints or switch back to local storage mode.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes('Remote API mode')) {
        throw e;
      }
    }
  }
}

// Generic storage functions
function getItems<T>(key: string): T[] {
  checkRemoteMode();
  const items = localStorage.getItem(key);
  return items ? JSON.parse(items) : [];
}

function saveItems<T>(key: string, items: T[]) {
  checkRemoteMode();
  localStorage.setItem(key, JSON.stringify(items));
}

// Competition functions
export const competitionStorage = {
  getAll: (): Competition[] => getItems(KEYS.competitions),
  getById: (id: string): Competition | undefined => 
    getItems<Competition>(KEYS.competitions).find(c => c.id === id),
  getByOrganizer: (organizerId: string): Competition[] =>
    getItems<Competition>(KEYS.competitions).filter(c => c.organizerId === organizerId),
  save: (competition: Competition) => {
    const competitions = getItems<Competition>(KEYS.competitions);
    const index = competitions.findIndex(c => c.id === competition.id);
    if (index !== -1) {
      competitions[index] = competition;
    } else {
      competitions.push(competition);
    }
    saveItems(KEYS.competitions, competitions);
  },
  delete: (id: string) => {
    const competitions = getItems<Competition>(KEYS.competitions).filter(c => c.id !== id);
    saveItems(KEYS.competitions, competitions);
  },
};

// Team functions
export const teamStorage = {
  getAll: (): Team[] => getItems(KEYS.teams),
  getById: (id: string): Team | undefined =>
    getItems<Team>(KEYS.teams).find(t => t.id === id),
  getByCompetition: (competitionId: string): Team[] =>
    getItems<Team>(KEYS.teams).filter(t => t.competitionId === competitionId),
  getByLane: (competitionId: string, laneNumber: number): Team[] =>
    getItems<Team>(KEYS.teams).filter(t => t.competitionId === competitionId && t.assignedLane === laneNumber),
  save: (team: Team) => {
    const teams = getItems<Team>(KEYS.teams);
    const index = teams.findIndex(t => t.id === team.id);
    if (index !== -1) {
      teams[index] = team;
    } else {
      teams.push(team);
    }
    saveItems(KEYS.teams, teams);
  },
  delete: (id: string) => {
    const teams = getItems<Team>(KEYS.teams).filter(t => t.id !== id);
    saveItems(KEYS.teams, teams);
  },
};

// Swimmer functions
export const swimmerStorage = {
  getAll: (): Swimmer[] => getItems(KEYS.swimmers),
  getById: (id: string): Swimmer | undefined =>
    getItems<Swimmer>(KEYS.swimmers).find(s => s.id === id),
  getByTeam: (teamId: string): Swimmer[] =>
    getItems<Swimmer>(KEYS.swimmers).filter(s => s.teamId === teamId),
  getByCompetition: (competitionId: string): Swimmer[] =>
    getItems<Swimmer>(KEYS.swimmers).filter(s => s.competitionId === competitionId),
  save: (swimmer: Swimmer) => {
    const swimmers = getItems<Swimmer>(KEYS.swimmers);
    const index = swimmers.findIndex(s => s.id === swimmer.id);
    if (index !== -1) {
      swimmers[index] = swimmer;
    } else {
      swimmers.push(swimmer);
    }
    saveItems(KEYS.swimmers, swimmers);
  },
  delete: (id: string) => {
    const swimmers = getItems<Swimmer>(KEYS.swimmers).filter(s => s.id !== id);
    saveItems(KEYS.swimmers, swimmers);
  },
};

// Referee functions
export const refereeStorage = {
  getAll: (): Referee[] => getItems(KEYS.referees),
  getById: (id: string): Referee | undefined =>
    getItems<Referee>(KEYS.referees).find(r => r.id === id),
  getByCompetition: (competitionId: string): Referee[] =>
    getItems<Referee>(KEYS.referees).filter(r => r.competitionId === competitionId),
  getByUserId: (userId: string): Referee[] =>
    getItems<Referee>(KEYS.referees).filter(r => r.userId === userId),
  save: (referee: Referee) => {
    const referees = getItems<Referee>(KEYS.referees);
    const index = referees.findIndex(r => r.id === referee.id);
    if (index !== -1) {
      referees[index] = referee;
    } else {
      referees.push(referee);
    }
    saveItems(KEYS.referees, referees);
  },
  delete: (id: string) => {
    const referees = getItems<Referee>(KEYS.referees).filter(r => r.id !== id);
    saveItems(KEYS.referees, referees);
  },
};

// Lane Assignment functions
export const laneAssignmentStorage = {
  getAll: (): LaneAssignment[] => getItems(KEYS.laneAssignments),
  getByCompetition: (competitionId: string): LaneAssignment[] =>
    getItems<LaneAssignment>(KEYS.laneAssignments).filter(la => la.competitionId === competitionId),
  getByLane: (competitionId: string, laneNumber: number): LaneAssignment | undefined =>
    getItems<LaneAssignment>(KEYS.laneAssignments).find(
      la => la.competitionId === competitionId && la.laneNumber === laneNumber
    ),
  getByReferee: (refereeId: string): LaneAssignment[] =>
    getItems<LaneAssignment>(KEYS.laneAssignments).filter(la => la.refereeId === refereeId),
  save: (assignment: LaneAssignment) => {
    const assignments = getItems<LaneAssignment>(KEYS.laneAssignments);
    const index = assignments.findIndex(a => a.id === assignment.id);
    if (index !== -1) {
      assignments[index] = assignment;
    } else {
      assignments.push(assignment);
    }
    saveItems(KEYS.laneAssignments, assignments);
  },
  delete: (id: string) => {
    const assignments = getItems<LaneAssignment>(KEYS.laneAssignments).filter(a => a.id !== id);
    saveItems(KEYS.laneAssignments, assignments);
  },
};

// Lap Count functions
export const lapCountStorage = {
  getAll: (): LapCount[] => getItems(KEYS.lapCounts),
  getByCompetition: (competitionId: string): LapCount[] =>
    getItems<LapCount>(KEYS.lapCounts).filter(lc => lc.competitionId === competitionId),
  getByTeam: (teamId: string): LapCount[] =>
    getItems<LapCount>(KEYS.lapCounts).filter(lc => lc.teamId === teamId),
  getBySwimmer: (swimmerId: string): LapCount[] =>
    getItems<LapCount>(KEYS.lapCounts).filter(lc => lc.swimmerId === swimmerId),
  getLastBySwimmer: (swimmerId: string): LapCount | undefined => {
    const laps = getItems<LapCount>(KEYS.lapCounts).filter(lc => lc.swimmerId === swimmerId);
    return laps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  },
  add: (lapCount: LapCount) => {
    const lapCounts = getItems<LapCount>(KEYS.lapCounts);
    lapCounts.push(lapCount);
    saveItems(KEYS.lapCounts, lapCounts);
  },
  delete: (id: string) => {
    const lapCounts = getItems<LapCount>(KEYS.lapCounts).filter(lc => lc.id !== id);
    saveItems(KEYS.lapCounts, lapCounts);
  },
};

// Swim Session functions
export const swimSessionStorage = {
  getAll: (): SwimSession[] => getItems(KEYS.swimSessions),
  getByCompetition: (competitionId: string): SwimSession[] =>
    getItems<SwimSession>(KEYS.swimSessions).filter(ss => ss.competitionId === competitionId),
  getActive: (competitionId: string): SwimSession[] =>
    getItems<SwimSession>(KEYS.swimSessions).filter(ss => ss.competitionId === competitionId && ss.isActive),
  getBySwimmer: (swimmerId: string): SwimSession[] =>
    getItems<SwimSession>(KEYS.swimSessions).filter(ss => ss.swimmerId === swimmerId),
  getActiveByTeam: (competitionId: string, teamId: string): SwimSession | undefined =>
    getItems<SwimSession>(KEYS.swimSessions).find(
      ss => ss.competitionId === competitionId && ss.teamId === teamId && ss.isActive
    ),
  getActiveByLane: (competitionId: string, laneNumber: number): SwimSession | undefined =>
    getItems<SwimSession>(KEYS.swimSessions).find(
      ss => ss.competitionId === competitionId && ss.laneNumber === laneNumber && ss.isActive
    ),
  save: (session: SwimSession) => {
    const sessions = getItems<SwimSession>(KEYS.swimSessions);
    const index = sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    saveItems(KEYS.swimSessions, sessions);
  },
  delete: (id: string) => {
    const sessions = getItems<SwimSession>(KEYS.swimSessions).filter(s => s.id !== id);
    saveItems(KEYS.swimSessions, sessions);
  },
};

// Utility to check for double count prevention (15 second rule)
export function canCountLap(swimmerId: string, minIntervalSeconds: number = 15): boolean {
  const lastLap = lapCountStorage.getLastBySwimmer(swimmerId);
  if (!lastLap) return true;
  
  const lastTime = new Date(lastLap.timestamp).getTime();
  const now = Date.now();
  return (now - lastTime) >= minIntervalSeconds * 1000;
}

// Get team statistics for leaderboard
export function getTeamStats(competitionId: string) {
  const teams = teamStorage.getByCompetition(competitionId);
  const lapCounts = lapCountStorage.getByCompetition(competitionId);
  const competition = competitionStorage.getById(competitionId);
  const laneLength = competition?.laneLength || 25;
  
  return teams.map(team => {
    const teamLaps = lapCounts.filter(lc => lc.teamId === team.id);
    const totalLaps = teamLaps.length;
    const totalMeters = totalLaps * laneLength * 2; // Each lap = 2 lengths
    
    // Calculate laps per hour
    if (teamLaps.length < 2) {
      return { team, totalLaps, totalMeters, lapsPerHour: 0, fastestLap: null, lateBirdLaps: 0, earlyBirdLaps: 0 };
    }
    
    const sortedLaps = [...teamLaps].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Calculate fastest lap (minimum time between consecutive laps)
    let fastestLap: number | null = null;
    for (let i = 1; i < sortedLaps.length; i++) {
      const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i-1].timestamp).getTime();
      if (fastestLap === null || diff < fastestLap) {
        fastestLap = diff;
      }
    }
    
    // Calculate laps per hour
    const firstLap = new Date(sortedLaps[0].timestamp).getTime();
    const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
    const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
    const lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;
    
    // Late Bird (midnight to 1AM) and Early Bird (5AM to 6AM)
    const lateBirdLaps = teamLaps.filter(lc => {
      const hour = new Date(lc.timestamp).getHours();
      return hour === 0;
    }).length;
    
    const earlyBirdLaps = teamLaps.filter(lc => {
      const hour = new Date(lc.timestamp).getHours();
      return hour === 5;
    }).length;
    
    return { team, totalLaps, totalMeters, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}

// Get swimmer statistics for leaderboard
export function getSwimmerStats(competitionId: string) {
  const swimmers = swimmerStorage.getByCompetition(competitionId);
  const teams = teamStorage.getByCompetition(competitionId);
  const lapCounts = lapCountStorage.getByCompetition(competitionId);
  const competition = competitionStorage.getById(competitionId);
  const laneLength = competition?.laneLength || 25;
  
  return swimmers.map(swimmer => {
    const team = teams.find(t => t.id === swimmer.teamId);
    const swimmerLaps = lapCounts.filter(lc => lc.swimmerId === swimmer.id);
    const totalLaps = swimmerLaps.length;
    const totalMeters = totalLaps * laneLength * 2;
    
    if (swimmerLaps.length < 2) {
      return { swimmer, team, totalLaps, totalMeters, lapsPerHour: 0, fastestLap: null, lateBirdLaps: 0, earlyBirdLaps: 0 };
    }
    
    const sortedLaps = [...swimmerLaps].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    let fastestLap: number | null = null;
    for (let i = 1; i < sortedLaps.length; i++) {
      const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i-1].timestamp).getTime();
      if (fastestLap === null || diff < fastestLap) {
        fastestLap = diff;
      }
    }
    
    const firstLap = new Date(sortedLaps[0].timestamp).getTime();
    const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
    const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
    const lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;
    
    const lateBirdLaps = swimmerLaps.filter(lc => {
      const hour = new Date(lc.timestamp).getHours();
      return hour === 0;
    }).length;
    
    const earlyBirdLaps = swimmerLaps.filter(lc => {
      const hour = new Date(lc.timestamp).getHours();
      return hour === 5;
    }).length;
    
    return { swimmer, team, totalLaps, totalMeters, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}
