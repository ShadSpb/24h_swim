// API abstraction layer types
// This allows switching between local storage and backend API

import { Competition, Team, Swimmer, Referee, SwimSession, User, UserRole } from '@/types';

export interface LaneAssignment {
  id: string;
  competitionId: string;
  laneNumber: number;
  refereeId: string | null;
  activeSwimmerId: string | null;
  registeredAt: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface LapCount {
  id: string;
  competitionId: string;
  laneNumber: number;
  teamId: string;
  swimmerId: string;
  refereeId: string;
  timestamp: string;
  lapNumber: number;
}

// Simplified endpoint configuration - one base URL per resource
// HTTP methods are determined by RESTful conventions:
// GET /resource - list all, GET /resource/:id - get one
// POST /resource - create, PUT /resource/:id - update
// DELETE /resource/:id - delete

export interface StorageConfig {
  type: 'local' | 'remote';
  baseUrl: string;
  endpoints: {
    // Resource base URLs (RESTful)
    competitions: string;
    teams: string;
    swimmers: string;
    referees: string;
    lapCounts: string;
    swimSessions: string;
    // Auth endpoints (specific paths)
    login: string;
    register: string;
  };
}

export interface AdminConfig {
  siteDomain: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
  authType: 'builtin' | 'external';
  backendUrl: string;
  maintenanceMode: boolean;
  emailNotifications: {
    organizerRegistration: boolean;
    passwordReset: boolean;
    competitionResult: boolean;
    faqFeedback: boolean;
  };
  storage: StorageConfig;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  role?: UserRole;
  competitionIds?: string[];
  sessionToken?: string; // Unique API key returned by backend for this session
  error?: string;
}

export interface ApiStats {
  activeOrganizers: number;
  activeReferees: number;
  plannedCompetitions: number;
  completedCompetitions: number;
}

// API interface that can be implemented by local storage or backend
export interface DataApi {
  // Competitions
  getCompetitions(): Promise<Competition[]>;
  getCompetitionById(id: string): Promise<Competition | undefined>;
  getCompetitionsByOrganizer(organizerId: string): Promise<Competition[]>;
  saveCompetition(competition: Competition): Promise<void>;
  deleteCompetition(id: string): Promise<void>;

  // Teams
  getTeams(): Promise<Team[]>;
  getTeamById(id: string): Promise<Team | undefined>;
  getTeamsByCompetition(competitionId: string): Promise<Team[]>;
  getTeamsByLane(competitionId: string, laneNumber: number): Promise<Team[]>;
  saveTeam(team: Team): Promise<void>;
  deleteTeam(id: string): Promise<void>;

  // Swimmers
  getSwimmers(): Promise<Swimmer[]>;
  getSwimmerById(id: string): Promise<Swimmer | undefined>;
  getSwimmersByTeam(teamId: string): Promise<Swimmer[]>;
  getSwimmersByCompetition(competitionId: string): Promise<Swimmer[]>;
  saveSwimmer(swimmer: Swimmer): Promise<void>;
  deleteSwimmer(id: string): Promise<void>;

  // Referees
  getReferees(): Promise<Referee[]>;
  getRefereeById(id: string): Promise<Referee | undefined>;
  getRefereesByCompetition(competitionId: string): Promise<Referee[]>;
  getRefereesByUserId(userId: string): Promise<Referee[]>;
  saveReferee(referee: Referee): Promise<void>;
  deleteReferee(id: string): Promise<void>;

  // Lane Assignments
  getLaneAssignments(): Promise<LaneAssignment[]>;
  getLaneAssignmentsByCompetition(competitionId: string): Promise<LaneAssignment[]>;
  getLaneAssignment(competitionId: string, laneNumber: number): Promise<LaneAssignment | undefined>;
  getLaneAssignmentsByReferee(refereeId: string): Promise<LaneAssignment[]>;
  saveLaneAssignment(assignment: LaneAssignment): Promise<void>;
  deleteLaneAssignment(id: string): Promise<void>;

  // Lap Counts
  getLapCounts(): Promise<LapCount[]>;
  getLapCountsByCompetition(competitionId: string): Promise<LapCount[]>;
  getLapCountsByTeam(teamId: string): Promise<LapCount[]>;
  getLapCountsBySwimmer(swimmerId: string): Promise<LapCount[]>;
  getLastLapBySwimmer(swimmerId: string): Promise<LapCount | undefined>;
  addLapCount(lapCount: LapCount): Promise<void>;
  deleteLapCount(id: string): Promise<void>;

  // Swim Sessions
  getSwimSessions(): Promise<SwimSession[]>;
  getSwimSessionsByCompetition(competitionId: string): Promise<SwimSession[]>;
  getActiveSwimSessions(competitionId: string): Promise<SwimSession[]>;
  getSwimSessionsBySwimmer(swimmerId: string): Promise<SwimSession[]>;
  getActiveSwimSessionByTeam(competitionId: string, teamId: string): Promise<SwimSession | undefined>;
  getActiveSwimSessionByLane(competitionId: string, laneNumber: number): Promise<SwimSession | undefined>;
  saveSwimSession(session: SwimSession): Promise<void>;
  deleteSwimSession(id: string): Promise<void>;
}

// Auth API interface
export interface AuthApi {
  login(email: string, password: string): Promise<AuthResponse>;
  register(email: string, password: string, name: string, role: UserRole): Promise<AuthResponse>;
  logout(): Promise<void>;
  resetPassword(userId: string, sendEmailFn?: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>): Promise<{ success: boolean; newPassword?: string; emailSent?: boolean; error?: string }>;
  changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean>;
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
  saveUser(user: User): Promise<void>;
  deleteUser(id: string): Promise<void>;
}

// Admin API interface
export interface AdminApi {
  getConfig(): Promise<AdminConfig>;
  saveConfig(config: AdminConfig): Promise<void>;
  getStats(): Promise<ApiStats>;
  sendTestEmail(to: string): Promise<boolean>;
  adminLogin(username: string, password: string): Promise<boolean>;
  changeAdminPassword(oldPassword: string, newPassword: string): Promise<boolean>;
}
