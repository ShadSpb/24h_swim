// API abstraction layer - main export file
// Configuration is bundled at build time from src/config/config.json

export type { 
  DataApi, 
  AuthApi, 
  AdminApi, 
  LaneAssignment, 
  LapCount, 
  AdminConfig, 
  AuthResponse, 
  ApiStats,
  StorageConfig
} from './types';

export { 
  LocalStorageDataApi, 
  LocalStorageAuthApi, 
  LocalStorageAdminApi,
} from './localStorage';

export { RemoteDataApi, RemoteAuthApi, RemoteApiError } from './remoteApi';
export { setSessionToken, getSessionToken, clearSessionToken, hasSessionToken } from './sessionManager';

import { DataApi, AuthApi, AdminApi, StorageConfig } from './types';
import { LocalStorageDataApi, LocalStorageAuthApi, LocalStorageAdminApi } from './localStorage';
import { RemoteDataApi, RemoteAuthApi } from './remoteApi';
import { 
  getStorageConfig, 
  isRemoteMode,
  loadSiteConfig,
  getStorageConfigAsync,
  isRemoteModeAsync
} from '@/lib/config/siteConfig';

// Factory function to get the appropriate Data API
function createDataApi(): DataApi {
  const config = getStorageConfig();
  if (config?.type === 'remote') {
    return new RemoteDataApi(config);
  }
  return new LocalStorageDataApi();
}

// Factory function to get the appropriate Auth API
function createAuthApi(): AuthApi {
  const config = getStorageConfig();
  if (config?.type === 'remote') {
    return new RemoteAuthApi(config);
  }
  return new LocalStorageAuthApi();
}

// Proxy that dynamically routes to the correct API based on config
class DynamicDataApi implements DataApi {
  private getApi(): DataApi {
    return createDataApi();
  }

  async getCompetitions() { return this.getApi().getCompetitions(); }
  async getCompetitionById(id: string) { return this.getApi().getCompetitionById(id); }
  async getCompetitionsByOrganizer(organizerId: string) { return this.getApi().getCompetitionsByOrganizer(organizerId); }
  async saveCompetition(competition: any) { return this.getApi().saveCompetition(competition); }
  async deleteCompetition(id: string) { return this.getApi().deleteCompetition(id); }
  async anonymizeCompetition(id: string) { return this.getApi().anonymizeCompetition(id); }
  async getTeams() { return this.getApi().getTeams(); }
  async getTeamById(id: string) { return this.getApi().getTeamById(id); }
  async getTeamsByCompetition(competitionId: string) { return this.getApi().getTeamsByCompetition(competitionId); }
  async getTeamsByLane(competitionId: string, laneNumber: number) { return this.getApi().getTeamsByLane(competitionId, laneNumber); }
  async saveTeam(team: any) { return this.getApi().saveTeam(team); }
  async deleteTeam(id: string) { return this.getApi().deleteTeam(id); }
  async getSwimmers() { return this.getApi().getSwimmers(); }
  async getSwimmerById(id: string) { return this.getApi().getSwimmerById(id); }
  async getSwimmersByTeam(teamId: string) { return this.getApi().getSwimmersByTeam(teamId); }
  async getSwimmersByCompetition(competitionId: string) { return this.getApi().getSwimmersByCompetition(competitionId); }
  async saveSwimmer(swimmer: any) { return this.getApi().saveSwimmer(swimmer); }
  async deleteSwimmer(id: string) { return this.getApi().deleteSwimmer(id); }
  async getReferees() { return this.getApi().getReferees(); }
  async getRefereeById(id: string) { return this.getApi().getRefereeById(id); }
  async getRefereesByCompetition(competitionId: string) { return this.getApi().getRefereesByCompetition(competitionId); }
  async getRefereesByUserId(userId: string) { return this.getApi().getRefereesByUserId(userId); }
  async saveReferee(referee: any) { return this.getApi().saveReferee(referee); }
  async deleteReferee(id: string) { return this.getApi().deleteReferee(id); }
  async getLaneAssignments() { return this.getApi().getLaneAssignments(); }
  async getLaneAssignmentsByCompetition(competitionId: string) { return this.getApi().getLaneAssignmentsByCompetition(competitionId); }
  async getLaneAssignment(competitionId: string, laneNumber: number) { return this.getApi().getLaneAssignment(competitionId, laneNumber); }
  async getLaneAssignmentsByReferee(refereeId: string) { return this.getApi().getLaneAssignmentsByReferee(refereeId); }
  async saveLaneAssignment(assignment: any) { return this.getApi().saveLaneAssignment(assignment); }
  async deleteLaneAssignment(id: string) { return this.getApi().deleteLaneAssignment(id); }
  async getLapCounts() { return this.getApi().getLapCounts(); }
  async getLapCountsByCompetition(competitionId: string) { return this.getApi().getLapCountsByCompetition(competitionId); }
  async getLapCountsByTeam(teamId: string) { return this.getApi().getLapCountsByTeam(teamId); }
  async getLapCountsBySwimmer(swimmerId: string) { return this.getApi().getLapCountsBySwimmer(swimmerId); }
  async getLastLapBySwimmer(swimmerId: string) { return this.getApi().getLastLapBySwimmer(swimmerId); }
  async addLapCount(lapCount: any) { return this.getApi().addLapCount(lapCount); }
  async deleteLapCount(id: string) { return this.getApi().deleteLapCount(id); }
  async getSwimSessions() { return this.getApi().getSwimSessions(); }
  async getSwimSessionsByCompetition(competitionId: string) { return this.getApi().getSwimSessionsByCompetition(competitionId); }
  async getActiveSwimSessions(competitionId: string) { return this.getApi().getActiveSwimSessions(competitionId); }
  async getSwimSessionsBySwimmer(swimmerId: string) { return this.getApi().getSwimSessionsBySwimmer(swimmerId); }
  async getActiveSwimSessionByTeam(competitionId: string, teamId: string) { return this.getApi().getActiveSwimSessionByTeam(competitionId, teamId); }
  async getActiveSwimSessionByLane(competitionId: string, laneNumber: number) { return this.getApi().getActiveSwimSessionByLane(competitionId, laneNumber); }
  async saveSwimSession(session: any) { return this.getApi().saveSwimSession(session); }
  async deleteSwimSession(id: string) { return this.getApi().deleteSwimSession(id); }
}

class DynamicAuthApi implements AuthApi {
  private getApi(): AuthApi {
    return createAuthApi();
  }

  async login(email: string, password: string) { return this.getApi().login(email, password); }
  async register(email: string, password: string, name: string, role: any, language?: string) { return this.getApi().register(email, password, name, role, language); }
  async logout() { return this.getApi().logout(); }
  async resetPassword(userId: string) { return this.getApi().resetPassword(userId); }
  async forgotPassword(email: string) { return this.getApi().forgotPassword(email); }
  async changePassword(userId: string, currentPassword: string, newPassword: string) { return this.getApi().changePassword(userId, currentPassword, newPassword); }
  async getUsers() { return this.getApi().getUsers(); }
  async getUserById(id: string) { return this.getApi().getUserById(id); }
  async saveUser(user: any) { return this.getApi().saveUser(user); }
  async deleteUser(id: string) { return this.getApi().deleteUser(id); }
}

// Create singleton instances that dynamically route based on config
export const dataApi: DataApi = new DynamicDataApi();
export const authApi: AuthApi = new DynamicAuthApi();
export const adminApi: AdminApi = new LocalStorageAdminApi();

// Re-export utilities
export { isRemoteMode, getStorageConfig };
export { isRemoteModeAsync, getStorageConfigAsync, loadSiteConfig };

export const api = {
  data: dataApi,
  auth: authApi,
  admin: adminApi,
};

export async function canCountLap(swimmerId: string, minIntervalSeconds: number = 15): Promise<boolean> {
  const lastLap = await dataApi.getLastLapBySwimmer(swimmerId);
  if (!lastLap) return true;

  const lastTime = new Date(lastLap.timestamp).getTime();
  const now = Date.now();
  return (now - lastTime) >= minIntervalSeconds * 1000;
}

// Competition local timezone for early/late bird bucketing. Must match
// stats.py's COMPETITION_TIMEZONE so that backend and client compute the
// same buckets. Using a fixed timezone (rather than the browser's local
// time) is what prevents a referee from cheating by changing their device
// clock — Intl.DateTimeFormat doesn't read the system clock, only the
// timestamp string returned by the server.
const COMP_TZ = 'Europe/Berlin';

const _birdHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: COMP_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
});

function _localMinuteOfDay(isoTimestamp: string): number | null {
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return null;
  const parts = _birdHourFormatter.formatToParts(d);
  let h = 0, m = 0;
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    else if (p.type === 'minute') m = parseInt(p.value, 10);
  }
  // Intl renders 24:00 instead of 00:00 in some locales/engines; normalize.
  if (h === 24) h = 0;
  return h * 60 + m;
}

function _inBirdWindow(isoTimestamp: string, startHour: number, windowMinutes: number): boolean {
  const m = _localMinuteOfDay(isoTimestamp);
  if (m === null || windowMinutes <= 0) return false;
  const start = ((startHour % 24) + 24) % 24 * 60;
  const end = (start + windowMinutes) % (24 * 60);
  return start <= end ? (m >= start && m < end) : (m >= start || m < end);
}

async function _birdConfig(competitionId: string): Promise<{ early: number; late: number; window: number }> {
  const comp = await dataApi.getCompetitionById(competitionId);
  return {
    early: comp?.earlyBirdHour ?? 5,
    late: comp?.lateBirdHour ?? 0,
    window: comp?.birdWindowMinutes ?? 60,
  };
}

export async function getTeamStats(competitionId: string) {
  // Remote mode: use the backend's pre-aggregated, cached standings instead of
  // downloading the full lap_counts table and aggregating in the browser.
  if (isRemoteMode()) {
    const config = getStorageConfig();
    if (config?.type === 'remote') {
      return new RemoteDataApi(config).getTeamStatsAggregated(competitionId);
    }
  }

  const [teams, lapCounts, bird] = await Promise.all([
    dataApi.getTeamsByCompetition(competitionId),
    dataApi.getLapCountsByCompetition(competitionId),
    _birdConfig(competitionId),
  ]);

  return teams.map(team => {
    const teamLaps = lapCounts.filter(lc => lc.teamId === team.id);
    const totalLaps = teamLaps.length;

    const lateBirdLaps = teamLaps.filter(lc => _inBirdWindow(lc.timestamp, bird.late, bird.window)).length;
    const earlyBirdLaps = teamLaps.filter(lc => _inBirdWindow(lc.timestamp, bird.early, bird.window)).length;

    if (teamLaps.length < 2) {
      return { team, totalLaps, lapsPerHour: 0, fastestLap: null, lateBirdLaps, earlyBirdLaps };
    }

    const sortedLaps = [...teamLaps].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let fastestLap: number | null = null;
    for (let i = 1; i < sortedLaps.length; i++) {
      const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i - 1].timestamp).getTime();
      if (fastestLap === null || diff < fastestLap) {
        fastestLap = diff;
      }
    }

    const firstLap = new Date(sortedLaps[0].timestamp).getTime();
    const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
    const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
    const lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;

    return { team, totalLaps, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}

export async function getSwimmerStats(competitionId: string) {
  // Remote mode: use the backend's pre-aggregated, cached standings.
  if (isRemoteMode()) {
    const config = getStorageConfig();
    if (config?.type === 'remote') {
      return new RemoteDataApi(config).getSwimmerStatsAggregated(competitionId);
    }
  }

  const [swimmers, teams, lapCounts, bird] = await Promise.all([
    dataApi.getSwimmersByCompetition(competitionId),
    dataApi.getTeamsByCompetition(competitionId),
    dataApi.getLapCountsByCompetition(competitionId),
    _birdConfig(competitionId),
  ]);

  return swimmers.map(swimmer => {
    const team = teams.find(t => t.id === swimmer.teamId);
    const swimmerLaps = lapCounts.filter(lc => lc.swimmerId === swimmer.id);
    const totalLaps = swimmerLaps.length;

    const lateBirdLaps = swimmerLaps.filter(lc => _inBirdWindow(lc.timestamp, bird.late, bird.window)).length;
    const earlyBirdLaps = swimmerLaps.filter(lc => _inBirdWindow(lc.timestamp, bird.early, bird.window)).length;

    if (swimmerLaps.length < 2) {
      return { swimmer, team, totalLaps, lapsPerHour: 0, fastestLap: null, lateBirdLaps, earlyBirdLaps };
    }

    const sortedLaps = [...swimmerLaps].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let fastestLap: number | null = null;
    for (let i = 1; i < sortedLaps.length; i++) {
      const diff = new Date(sortedLaps[i].timestamp).getTime() - new Date(sortedLaps[i - 1].timestamp).getTime();
      if (fastestLap === null || diff < fastestLap) {
        fastestLap = diff;
      }
    }

    const firstLap = new Date(sortedLaps[0].timestamp).getTime();
    const lastLap = new Date(sortedLaps[sortedLaps.length - 1].timestamp).getTime();
    const durationHours = (lastLap - firstLap) / (1000 * 60 * 60);
    const lapsPerHour = durationHours > 0 ? totalLaps / durationHours : 0;

    return { swimmer, team, totalLaps, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}
