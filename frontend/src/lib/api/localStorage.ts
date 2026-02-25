// LocalStorage implementation of the API abstraction layer

import { Competition, Team, Swimmer, Referee, SwimSession, User, UserRole } from '@/types';
import { 
  DataApi, 
  AuthApi, 
  AdminApi, 
  LaneAssignment, 
  LapCount, 
  AdminConfig, 
  AuthResponse, 
  ApiStats 
} from './types';
import { loadSiteConfig, toAdminConfig, SiteConfigFile } from '@/lib/config/siteConfig';
import { hashPassword, verifyPassword } from '@/lib/utils/password';

const KEYS = {
  competitions: 'swimtrack_competitions',
  teams: 'swimtrack_teams',
  swimmers: 'swimtrack_swimmers',
  referees: 'swimtrack_referees',
  laneAssignments: 'swimtrack_lane_assignments',
  lapCounts: 'swimtrack_lap_counts',
  swimSessions: 'swimtrack_swim_sessions',
  users: 'swimtrack_users',
  auth: 'swimtrack_auth',
  adminConfig: 'swimtrack_admin_config',
  adminAuth: 'swimtrack_admin_auth',
};

// Generic storage functions
function getItems<T>(key: string): T[] {
  const items = localStorage.getItem(key);
  return items ? JSON.parse(items) : [];
}

function saveItems<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function getItem<T>(key: string): T | null {
  const item = localStorage.getItem(key);
  return item ? JSON.parse(item) : null;
}

function saveItem<T>(key: string, item: T) {
  localStorage.setItem(key, JSON.stringify(item));
}

// Human-friendly password generator
function generatePassword(): string {
  const adjectives = ['Swift', 'Blue', 'Fast', 'Cool', 'Wild', 'Aqua', 'Wave', 'Deep'];
  const nouns = ['Dolphin', 'Shark', 'Wave', 'Ocean', 'River', 'Pool', 'Stream', 'Tide'];
  const numbers = Math.floor(Math.random() * 99) + 1;
  
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  
  return `${adj}${noun}${numbers}`;
}

// Data API implementation
export class LocalStorageDataApi implements DataApi {
  // Competitions
  async getCompetitions(): Promise<Competition[]> {
    return getItems<Competition>(KEYS.competitions);
  }

  async getCompetitionById(id: string): Promise<Competition | undefined> {
    const competitions = await this.getCompetitions();
    return competitions.find(c => c.id === id);
  }

  async getCompetitionsByOrganizer(organizerId: string): Promise<Competition[]> {
    const competitions = await this.getCompetitions();
    return competitions.filter(c => c.organizerId === organizerId);
  }

  async saveCompetition(competition: Competition): Promise<void> {
    const competitions = await this.getCompetitions();
    const index = competitions.findIndex(c => c.id === competition.id);
    if (index !== -1) {
      competitions[index] = competition;
    } else {
      competitions.push(competition);
    }
    saveItems(KEYS.competitions, competitions);
  }

  async deleteCompetition(id: string): Promise<void> {
    // Cascade delete all related data
    // Delete teams
    const teams = await this.getTeamsByCompetition(id);
    for (const team of teams) {
      await this.deleteTeam(team.id);
    }
    
    // Delete swimmers
    const swimmers = await this.getSwimmersByCompetition(id);
    for (const swimmer of swimmers) {
      await this.deleteSwimmer(swimmer.id);
    }
    
    // Delete referees and their user accounts
    const referees = await this.getRefereesByCompetition(id);
    const authApi = new LocalStorageAuthApi();
    for (const referee of referees) {
      // Delete user account
      const users = await authApi.getUsers();
      const user = users.find(u => u.email === referee.userId);
      if (user) {
        await authApi.deleteUser(user.id);
      }
      await this.deleteReferee(referee.id);
    }
    
    // Delete lane assignments
    const assignments = await this.getLaneAssignmentsByCompetition(id);
    for (const assignment of assignments) {
      await this.deleteLaneAssignment(assignment.id);
    }
    
    // Delete lap counts
    const lapCounts = await this.getLapCountsByCompetition(id);
    for (const lap of lapCounts) {
      await this.deleteLapCount(lap.id);
    }
    
    // Delete swim sessions
    const sessions = await this.getSwimSessionsByCompetition(id);
    for (const session of sessions) {
      await this.deleteSwimSession(session.id);
    }
    
    // Finally delete the competition
    const competitions = (await this.getCompetitions()).filter(c => c.id !== id);
    saveItems(KEYS.competitions, competitions);
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    return getItems<Team>(KEYS.teams);
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const teams = await this.getTeams();
    return teams.find(t => t.id === id);
  }

  async getTeamsByCompetition(competitionId: string): Promise<Team[]> {
    const teams = await this.getTeams();
    return teams.filter(t => t.competitionId === competitionId);
  }

  async getTeamsByLane(competitionId: string, laneNumber: number): Promise<Team[]> {
    const teams = await this.getTeams();
    return teams.filter(t => t.competitionId === competitionId && t.assignedLane === laneNumber);
  }

  async saveTeam(team: Team): Promise<void> {
    const teams = await this.getTeams();
    const index = teams.findIndex(t => t.id === team.id);
    if (index !== -1) {
      teams[index] = team;
    } else {
      teams.push(team);
    }
    saveItems(KEYS.teams, teams);
  }

  async deleteTeam(id: string): Promise<void> {
    const teams = (await this.getTeams()).filter(t => t.id !== id);
    saveItems(KEYS.teams, teams);
  }

  // Swimmers
  async getSwimmers(): Promise<Swimmer[]> {
    return getItems<Swimmer>(KEYS.swimmers);
  }

  async getSwimmerById(id: string): Promise<Swimmer | undefined> {
    const swimmers = await this.getSwimmers();
    return swimmers.find(s => s.id === id);
  }

  async getSwimmersByTeam(teamId: string): Promise<Swimmer[]> {
    const swimmers = await this.getSwimmers();
    return swimmers.filter(s => s.teamId === teamId);
  }

  async getSwimmersByCompetition(competitionId: string): Promise<Swimmer[]> {
    const swimmers = await this.getSwimmers();
    return swimmers.filter(s => s.competitionId === competitionId);
  }

  async saveSwimmer(swimmer: Swimmer): Promise<void> {
    const swimmers = await this.getSwimmers();
    const index = swimmers.findIndex(s => s.id === swimmer.id);
    if (index !== -1) {
      swimmers[index] = swimmer;
    } else {
      swimmers.push(swimmer);
    }
    saveItems(KEYS.swimmers, swimmers);
  }

  async deleteSwimmer(id: string): Promise<void> {
    const swimmers = (await this.getSwimmers()).filter(s => s.id !== id);
    saveItems(KEYS.swimmers, swimmers);
  }

  // Referees
  async getReferees(): Promise<Referee[]> {
    return getItems<Referee>(KEYS.referees);
  }

  async getRefereeById(id: string): Promise<Referee | undefined> {
    const referees = await this.getReferees();
    return referees.find(r => r.id === id);
  }

  async getRefereesByCompetition(competitionId: string): Promise<Referee[]> {
    const referees = await this.getReferees();
    return referees.filter(r => r.competitionId === competitionId);
  }

  async getRefereesByUserId(userId: string): Promise<Referee[]> {
    const referees = await this.getReferees();
    return referees.filter(r => r.userId === userId);
  }

  async saveReferee(referee: Referee): Promise<void> {
    const referees = await this.getReferees();
    const index = referees.findIndex(r => r.id === referee.id);
    if (index !== -1) {
      referees[index] = referee;
    } else {
      referees.push(referee);
    }
    saveItems(KEYS.referees, referees);
  }

  async deleteReferee(id: string): Promise<void> {
    const referees = (await this.getReferees()).filter(r => r.id !== id);
    saveItems(KEYS.referees, referees);
  }

  // Lane Assignments
  async getLaneAssignments(): Promise<LaneAssignment[]> {
    return getItems<LaneAssignment>(KEYS.laneAssignments);
  }

  async getLaneAssignmentsByCompetition(competitionId: string): Promise<LaneAssignment[]> {
    const assignments = await this.getLaneAssignments();
    return assignments.filter(a => a.competitionId === competitionId);
  }

  async getLaneAssignment(competitionId: string, laneNumber: number): Promise<LaneAssignment | undefined> {
    const assignments = await this.getLaneAssignments();
    return assignments.find(a => a.competitionId === competitionId && a.laneNumber === laneNumber);
  }

  async getLaneAssignmentsByReferee(refereeId: string): Promise<LaneAssignment[]> {
    const assignments = await this.getLaneAssignments();
    return assignments.filter(a => a.refereeId === refereeId);
  }

  async saveLaneAssignment(assignment: LaneAssignment): Promise<void> {
    const assignments = await this.getLaneAssignments();
    const index = assignments.findIndex(a => a.id === assignment.id);
    if (index !== -1) {
      assignments[index] = assignment;
    } else {
      assignments.push(assignment);
    }
    saveItems(KEYS.laneAssignments, assignments);
  }

  async deleteLaneAssignment(id: string): Promise<void> {
    const assignments = (await this.getLaneAssignments()).filter(a => a.id !== id);
    saveItems(KEYS.laneAssignments, assignments);
  }

  // Lap Counts
  async getLapCounts(): Promise<LapCount[]> {
    return getItems<LapCount>(KEYS.lapCounts);
  }

  async getLapCountsByCompetition(competitionId: string): Promise<LapCount[]> {
    const lapCounts = await this.getLapCounts();
    return lapCounts.filter(lc => lc.competitionId === competitionId);
  }

  async getLapCountsByTeam(teamId: string): Promise<LapCount[]> {
    const lapCounts = await this.getLapCounts();
    return lapCounts.filter(lc => lc.teamId === teamId);
  }

  async getLapCountsBySwimmer(swimmerId: string): Promise<LapCount[]> {
    const lapCounts = await this.getLapCounts();
    return lapCounts.filter(lc => lc.swimmerId === swimmerId);
  }

  async getLastLapBySwimmer(swimmerId: string): Promise<LapCount | undefined> {
    const laps = await this.getLapCountsBySwimmer(swimmerId);
    return laps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  async addLapCount(lapCount: LapCount): Promise<void> {
    const lapCounts = await this.getLapCounts();
    lapCounts.push(lapCount);
    saveItems(KEYS.lapCounts, lapCounts);
  }

  async deleteLapCount(id: string): Promise<void> {
    const lapCounts = (await this.getLapCounts()).filter(lc => lc.id !== id);
    saveItems(KEYS.lapCounts, lapCounts);
  }

  // Swim Sessions
  async getSwimSessions(): Promise<SwimSession[]> {
    return getItems<SwimSession>(KEYS.swimSessions);
  }

  async getSwimSessionsByCompetition(competitionId: string): Promise<SwimSession[]> {
    const sessions = await this.getSwimSessions();
    return sessions.filter(s => s.competitionId === competitionId);
  }

  async getActiveSwimSessions(competitionId: string): Promise<SwimSession[]> {
    const sessions = await this.getSwimSessions();
    return sessions.filter(s => s.competitionId === competitionId && s.isActive);
  }

  async getSwimSessionsBySwimmer(swimmerId: string): Promise<SwimSession[]> {
    const sessions = await this.getSwimSessions();
    return sessions.filter(s => s.swimmerId === swimmerId);
  }

  async getActiveSwimSessionByTeam(competitionId: string, teamId: string): Promise<SwimSession | undefined> {
    const sessions = await this.getSwimSessions();
    return sessions.find(s => s.competitionId === competitionId && s.teamId === teamId && s.isActive);
  }

  async getActiveSwimSessionByLane(competitionId: string, laneNumber: number): Promise<SwimSession | undefined> {
    const sessions = await this.getSwimSessions();
    return sessions.find(s => s.competitionId === competitionId && s.laneNumber === laneNumber && s.isActive);
  }

  async saveSwimSession(session: SwimSession): Promise<void> {
    const sessions = await this.getSwimSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    saveItems(KEYS.swimSessions, sessions);
  }

  async deleteSwimSession(id: string): Promise<void> {
    const sessions = (await this.getSwimSessions()).filter(s => s.id !== id);
    saveItems(KEYS.swimSessions, sessions);
  }
}

// Auth API implementation
export class LocalStorageAuthApi implements AuthApi {
  async login(email: string, password: string): Promise<AuthResponse> {
    const users = await this.getUsers();
    const passwordHash = await hashPassword(password);
    
    // Find user and verify password hash
    const user = users.find(u => (u.email === email || u.id === email) && u.passwordHash === passwordHash);
    
    if (user) {
      saveItem(KEYS.auth, { isAuthenticated: true, user });
      return { success: true, user, role: user.role };
    }
    return { success: false, error: 'Invalid credentials' };
  }

  async register(email: string, password: string, name: string, role: UserRole): Promise<AuthResponse> {
    const users = await this.getUsers();
    
    if (users.find(u => u.email === email)) {
      return { success: false, error: 'Email already exists' };
    }

    const passwordHash = await hashPassword(password);
    const newUser: User = {
      id: crypto.randomUUID(),
      email,
      passwordHash,
      name,
      role,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    saveItems(KEYS.users, users);
    saveItem(KEYS.auth, { isAuthenticated: true, user: newUser });
    
    return { success: true, user: newUser, role };
  }

  async logout(): Promise<void> {
    localStorage.removeItem(KEYS.auth);
  }

  async resetPassword(userId: string, sendEmailFn?: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>): Promise<{ success: boolean; newPassword?: string; emailSent?: boolean; error?: string }> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === userId || u.email === userId);
    
    if (index === -1) {
      return { success: false, error: 'User not found' };
    }

    const user = users[index];
    const newPassword = generatePassword();
    const newPasswordHash = await hashPassword(newPassword);
    users[index].passwordHash = newPasswordHash;
    saveItems(KEYS.users, users);
    
    // If email function provided, send the password via email
    if (sendEmailFn) {
      const emailResult = await sendEmailFn(user.email, newPassword, user.name);
      if (!emailResult.success) {
        return { success: true, newPassword, emailSent: false, error: emailResult.error };
      }
      return { success: true, emailSent: true };
    }
    
    // Fallback: return password (for backward compatibility)
    return { success: true, newPassword };
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const users = await this.getUsers();
    const oldPasswordHash = await hashPassword(oldPassword);
    const index = users.findIndex(u => u.id === userId && u.passwordHash === oldPasswordHash);
    
    if (index === -1) {
      return false;
    }

    const newPasswordHash = await hashPassword(newPassword);
    users[index].passwordHash = newPasswordHash;
    saveItems(KEYS.users, users);
    return true;
  }

  async getUsers(): Promise<User[]> {
    return getItems<User>(KEYS.users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const users = await this.getUsers();
    return users.find(u => u.id === id);
  }

  async saveUser(user: User): Promise<void> {
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index !== -1) {
      users[index] = user;
    } else {
      users.push(user);
    }
    saveItems(KEYS.users, users);
  }

  async deleteUser(id: string): Promise<void> {
    const users = (await this.getUsers()).filter(u => u.id !== id);
    saveItems(KEYS.users, users);
  }
}

// Default storage endpoints configuration
const defaultStorageConfig = {
  type: 'local' as const,
  baseUrl: '',
  apiKey: '',
  endpoints: {
    getCompetitions: { url: '/competitions', method: 'GET' as const },
    getCompetition: { url: '/competitions/:id', method: 'GET' as const },
    saveCompetition: { url: '/competitions', method: 'POST' as const },
    deleteCompetition: { url: '/competitions/:id', method: 'DELETE' as const },
    getTeams: { url: '/teams', method: 'GET' as const },
    saveTeam: { url: '/teams', method: 'POST' as const },
    deleteTeam: { url: '/teams/:id', method: 'DELETE' as const },
    getSwimmers: { url: '/swimmers', method: 'GET' as const },
    saveSwimmer: { url: '/swimmers', method: 'POST' as const },
    deleteSwimmer: { url: '/swimmers/:id', method: 'DELETE' as const },
    getReferees: { url: '/referees', method: 'GET' as const },
    saveReferee: { url: '/referees', method: 'POST' as const },
    deleteReferee: { url: '/referees/:id', method: 'DELETE' as const },
    getLapCounts: { url: '/lap-counts', method: 'GET' as const },
    addLapCount: { url: '/lap-counts', method: 'POST' as const },
    getSwimSessions: { url: '/swim-sessions', method: 'GET' as const },
    saveSwimSession: { url: '/swim-sessions', method: 'POST' as const },
    login: { url: '/auth/login', method: 'POST' as const },
    register: { url: '/auth/register', method: 'POST' as const },
  },
};

// Admin API implementation
// NOTE: Site configuration is now loaded from public/config.json file
// This file persists across restarts and site migrations
export class LocalStorageAdminApi implements AdminApi {
  async getConfig(): Promise<AdminConfig> {
    // Load config from public/config.json file
    const siteConfig = await loadSiteConfig();
    return toAdminConfig(siteConfig);
  }

  async saveConfig(config: AdminConfig): Promise<void> {
    // In file-based mode, config cannot be saved from the UI
    // The config file must be edited directly on the server
    console.warn('Config save attempted - in file-based mode, edit public/config.json directly');
    throw new Error('Configuration is read-only. Edit public/config.json on the server to change settings.');
  }

  async getStats(): Promise<ApiStats> {
    const auth = getItem<{ isAuthenticated: boolean; user: User }>(KEYS.auth);
    const competitions = getItems<Competition>(KEYS.competitions);
    
    // In a real implementation, this would track active sessions
    return {
      activeOrganizers: auth?.user?.role === 'organizer' ? 1 : 0,
      activeReferees: auth?.user?.role === 'referee' ? 1 : 0,
      plannedCompetitions: competitions.filter(c => c.status === 'upcoming').length,
      completedCompetitions: competitions.filter(c => c.status === 'completed').length,
    };
  }

  async sendTestEmail(to: string): Promise<boolean> {
    // In file-based config mode, just simulate success
    console.log(`Test email would be sent to: ${to}`);
    return true;
  }

  async adminLogin(username: string, password: string): Promise<boolean> {
    // Load admin password hash from config file
    const siteConfig = await loadSiteConfig();
    const storedHash = siteConfig.admin.passwordHash;
    
    // Hash the provided password and compare
    const passwordHash = await hashPassword(password);
    return username === 'admin' && passwordHash === storedHash;
  }

  async changeAdminPassword(oldPassword: string, newPassword: string): Promise<boolean> {
    // In file-based mode, password cannot be changed from UI
    console.warn('Password change attempted - in file-based mode, edit public/config.json directly');
    throw new Error('Admin password is read-only. Edit public/config.json on the server to change it.');
  }
}

// Export utility function for double-count prevention (15 second rule)
export async function canCountLap(swimmerId: string, minIntervalSeconds: number = 15): Promise<boolean> {
  const dataApi = new LocalStorageDataApi();
  const lastLap = await dataApi.getLastLapBySwimmer(swimmerId);
  if (!lastLap) return true;
  
  const lastTime = new Date(lastLap.timestamp).getTime();
  const now = Date.now();
  return (now - lastTime) >= minIntervalSeconds * 1000;
}

// Export utility function for team statistics
export async function getTeamStats(competitionId: string) {
  const dataApi = new LocalStorageDataApi();
  const teams = await dataApi.getTeamsByCompetition(competitionId);
  const lapCounts = await dataApi.getLapCountsByCompetition(competitionId);
  
  return teams.map(team => {
    const teamLaps = lapCounts.filter(lc => lc.teamId === team.id);
    const totalLaps = teamLaps.length;
    
    // Calculate laps per hour
    if (teamLaps.length < 2) {
      return { team, totalLaps, lapsPerHour: 0, fastestLap: null, lateBirdLaps: 0, earlyBirdLaps: 0 };
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
    
    return { team, totalLaps, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}

// Export utility function for swimmer statistics
export async function getSwimmerStats(competitionId: string) {
  const dataApi = new LocalStorageDataApi();
  const swimmers = await dataApi.getSwimmersByCompetition(competitionId);
  const teams = await dataApi.getTeamsByCompetition(competitionId);
  const lapCounts = await dataApi.getLapCountsByCompetition(competitionId);
  
  return swimmers.map(swimmer => {
    const team = teams.find(t => t.id === swimmer.teamId);
    const swimmerLaps = lapCounts.filter(lc => lc.swimmerId === swimmer.id);
    const totalLaps = swimmerLaps.length;
    
    if (swimmerLaps.length < 2) {
      return { swimmer, team, totalLaps, lapsPerHour: 0, fastestLap: null, lateBirdLaps: 0, earlyBirdLaps: 0 };
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
    
    return { swimmer, team, totalLaps, lapsPerHour, fastestLap, lateBirdLaps, earlyBirdLaps };
  }).sort((a, b) => b.totalLaps - a.totalLaps);
}
