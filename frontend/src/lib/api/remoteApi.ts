// Remote API implementation of the API abstraction layer
// This implementation makes HTTP calls to the configured remote endpoints

import { Competition, Team, Swimmer, Referee, SwimSession, User, UserRole } from '@/types';
import { 
  DataApi, 
  AuthApi, 
  LaneAssignment, 
  LapCount, 
  AuthResponse,
  StorageConfig
} from './types';
import { getSessionToken, setSessionToken, clearSessionToken } from './sessionManager';

export class RemoteApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'RemoteApiError';
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function saveWithUpsert(
  config: StorageConfig,
  endpoint: string,
  id: string | undefined,
  body: unknown
): Promise<void> {
  if (!id) {
    await makeRequest(config, endpoint, 'POST', { body });
    return;
  }

  try {
    await makeRequest(config, endpoint, 'PUT', { pathId: id, body });
  } catch (error) {
    if (error instanceof RemoteApiError && (error.status === 404 || error.status === 405)) {
      await makeRequest(config, endpoint, 'POST', { body });
      return;
    }
    throw error;
  }
}

async function makeRequest<T>(
  config: StorageConfig,
  endpoint: string,
  method: HttpMethod,
  options: {
    pathId?: string;
    queryParams?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<T> {
  let url = `${config.baseUrl}${endpoint}`;
  
  // Append path ID for single resource operations
  if (options.pathId) {
    url = `${url}/${options.pathId}`;
  }
  
  // Add query parameters
  if (options.queryParams) {
    const params = new URLSearchParams();
    Object.entries(options.queryParams).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Use session token for authenticated requests
  const sessionToken = getSessionToken();
  if (sessionToken) {
    headers['Authorization'] = `Bearer ${sessionToken}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new RemoteApiError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        endpoint
      );
    }

    const data = await response.json();
    return data.data ?? data;
  } catch (error) {
    if (error instanceof RemoteApiError) {
      throw error;
    }
    throw new RemoteApiError(
      `Failed to connect to remote API: ${error instanceof Error ? error.message : 'Network error'}`,
      undefined,
      endpoint
    );
  }
}

// Remote Data API implementation
export class RemoteDataApi implements DataApi {
  constructor(private config: StorageConfig) {}

  // Competitions
  async getCompetitions(): Promise<Competition[]> {
    return makeRequest<Competition[]>(this.config, this.config.endpoints.competitions, 'GET');
  }

  async getCompetitionById(id: string): Promise<Competition | undefined> {
    try {
      return await makeRequest<Competition>(this.config, this.config.endpoints.competitions, 'GET', { pathId: id });
    } catch {
      return undefined;
    }
  }

  async getCompetitionsByOrganizer(organizerId: string): Promise<Competition[]> {
    return makeRequest<Competition[]>(this.config, this.config.endpoints.competitions, 'GET', {
      queryParams: { organizerId }
    });
  }

  async saveCompetition(competition: Competition): Promise<void> {
    await saveWithUpsert(this.config, this.config.endpoints.competitions, competition.id, competition);
  }

  async deleteCompetition(id: string): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.competitions, 'DELETE', { pathId: id });
  }

  // Teams
  async getTeams(): Promise<Team[]> {
    return makeRequest<Team[]>(this.config, this.config.endpoints.teams, 'GET');
  }

  async getTeamById(id: string): Promise<Team | undefined> {
    const teams = await this.getTeams();
    return teams.find(t => t.id === id);
  }

  async getTeamsByCompetition(competitionId: string): Promise<Team[]> {
    return makeRequest<Team[]>(this.config, this.config.endpoints.teams, 'GET', {
      queryParams: { competitionId }
    });
  }

  async getTeamsByLane(competitionId: string, laneNumber: number): Promise<Team[]> {
    return makeRequest<Team[]>(this.config, this.config.endpoints.teams, 'GET', {
      queryParams: { competitionId, laneNumber: laneNumber.toString() }
    });
  }

  async saveTeam(team: Team): Promise<void> {
    await saveWithUpsert(this.config, this.config.endpoints.teams, team.id, team);
  }

  async deleteTeam(id: string): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.teams, 'DELETE', { pathId: id });
  }

  // Swimmers
  async getSwimmers(): Promise<Swimmer[]> {
    return makeRequest<Swimmer[]>(this.config, this.config.endpoints.swimmers, 'GET');
  }

  async getSwimmerById(id: string): Promise<Swimmer | undefined> {
    const swimmers = await this.getSwimmers();
    return swimmers.find(s => s.id === id);
  }

  async getSwimmersByTeam(teamId: string): Promise<Swimmer[]> {
    return makeRequest<Swimmer[]>(this.config, this.config.endpoints.swimmers, 'GET', {
      queryParams: { teamId }
    });
  }

  async getSwimmersByCompetition(competitionId: string): Promise<Swimmer[]> {
    return makeRequest<Swimmer[]>(this.config, this.config.endpoints.swimmers, 'GET', {
      queryParams: { competitionId }
    });
  }

  async saveSwimmer(swimmer: Swimmer): Promise<void> {
    await saveWithUpsert(this.config, this.config.endpoints.swimmers, swimmer.id, swimmer);
  }

  async deleteSwimmer(id: string): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.swimmers, 'DELETE', { pathId: id });
  }

  // Referees
  async getReferees(): Promise<Referee[]> {
    return makeRequest<Referee[]>(this.config, this.config.endpoints.referees, 'GET');
  }

  async getRefereeById(id: string): Promise<Referee | undefined> {
    const referees = await this.getReferees();
    return referees.find(r => r.id === id);
  }

  async getRefereesByCompetition(competitionId: string): Promise<Referee[]> {
    return makeRequest<Referee[]>(this.config, this.config.endpoints.referees, 'GET', {
      queryParams: { competitionId }
    });
  }

  async getRefereesByUserId(userId: string): Promise<Referee[]> {
    return makeRequest<Referee[]>(this.config, this.config.endpoints.referees, 'GET', {
      queryParams: { userId }
    });
  }

  async saveReferee(referee: Referee): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.referees, 'POST', { body: referee });
  }

  async deleteReferee(id: string): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.referees, 'DELETE', { pathId: id });
  }

  // Lane Assignments - not used in remote mode, return empty
  async getLaneAssignments(): Promise<LaneAssignment[]> { return []; }
  async getLaneAssignmentsByCompetition(): Promise<LaneAssignment[]> { return []; }
  async getLaneAssignment(): Promise<LaneAssignment | undefined> { return undefined; }
  async getLaneAssignmentsByReferee(): Promise<LaneAssignment[]> { return []; }
  async saveLaneAssignment(): Promise<void> {}
  async deleteLaneAssignment(): Promise<void> {}

  // Lap Counts
  async getLapCounts(): Promise<LapCount[]> {
    return makeRequest<LapCount[]>(this.config, this.config.endpoints.lapCounts, 'GET');
  }

  async getLapCountsByCompetition(competitionId: string): Promise<LapCount[]> {
    return makeRequest<LapCount[]>(this.config, this.config.endpoints.lapCounts, 'GET', {
      queryParams: { competitionId }
    });
  }

  async getLapCountsByTeam(teamId: string): Promise<LapCount[]> {
    return makeRequest<LapCount[]>(this.config, this.config.endpoints.lapCounts, 'GET', {
      queryParams: { teamId }
    });
  }

  async getLapCountsBySwimmer(swimmerId: string): Promise<LapCount[]> {
    return makeRequest<LapCount[]>(this.config, this.config.endpoints.lapCounts, 'GET', {
      queryParams: { swimmerId }
    });
  }

  async getLastLapBySwimmer(swimmerId: string): Promise<LapCount | undefined> {
    const laps = await this.getLapCountsBySwimmer(swimmerId);
    return laps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }

  async addLapCount(lapCount: LapCount): Promise<void> {
    await makeRequest(this.config, this.config.endpoints.lapCounts, 'POST', { body: lapCount });
  }

  async deleteLapCount(): Promise<void> {
    throw new RemoteApiError('Delete lap count not supported in remote mode');
  }

  // Swim Sessions
  async getSwimSessions(): Promise<SwimSession[]> {
    return makeRequest<SwimSession[]>(this.config, this.config.endpoints.swimSessions, 'GET');
  }

  async getSwimSessionsByCompetition(competitionId: string): Promise<SwimSession[]> {
    return makeRequest<SwimSession[]>(this.config, this.config.endpoints.swimSessions, 'GET', {
      queryParams: { competitionId }
    });
  }

  async getActiveSwimSessions(competitionId: string): Promise<SwimSession[]> {
    return makeRequest<SwimSession[]>(this.config, this.config.endpoints.swimSessions, 'GET', {
      queryParams: { competitionId, isActive: 'true' }
    });
  }

  async getSwimSessionsBySwimmer(swimmerId: string): Promise<SwimSession[]> {
    const sessions = await this.getSwimSessions();
    return sessions.filter(s => s.swimmerId === swimmerId);
  }

  async getActiveSwimSessionByTeam(competitionId: string, teamId: string): Promise<SwimSession | undefined> {
    const sessions = await makeRequest<SwimSession[]>(this.config, this.config.endpoints.swimSessions, 'GET', {
      queryParams: { competitionId, teamId, isActive: 'true' }
    });
    return sessions[0];
  }

  async getActiveSwimSessionByLane(competitionId: string, laneNumber: number): Promise<SwimSession | undefined> {
    const sessions = await makeRequest<SwimSession[]>(this.config, this.config.endpoints.swimSessions, 'GET', {
      queryParams: { competitionId, laneNumber: laneNumber.toString(), isActive: 'true' }
    });
    return sessions[0];
  }

  async saveSwimSession(session: SwimSession): Promise<void> {
    // Swim sessions are lifecycle-based:
    // - start session: create via POST
    // - end/update session: update via PUT /:id
    const isCreate = session.isActive && !session.endTime && session.lapCount === 0;
    if (isCreate) {
      await makeRequest(this.config, this.config.endpoints.swimSessions, 'POST', { body: session });
      return;
    }

    if (!session.id) {
      throw new RemoteApiError('Swim session id is required for update');
    }

    await makeRequest(this.config, this.config.endpoints.swimSessions, 'PUT', {
      pathId: session.id,
      body: session,
    });
  }

  async deleteSwimSession(): Promise<void> {
    throw new RemoteApiError('Delete swim session not supported in remote mode');
  }
}

// Remote Auth API implementation
export class RemoteAuthApi implements AuthApi {
  constructor(private config: StorageConfig) {}

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const result = await makeRequest<AuthResponse>(this.config, this.config.endpoints.login, 'POST', {
        body: { email, password }
      });
      
      // Store session token if provided by backend
      if (result.success && result.sessionToken) {
        setSessionToken(result.sessionToken);
      }
      
      return result;
    } catch (error) {
      if (error instanceof RemoteApiError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Failed to connect to authentication server' };
    }
  }

  async register(email: string, password: string, name: string, role: UserRole): Promise<AuthResponse> {
    try {
      const result = await makeRequest<AuthResponse>(this.config, this.config.endpoints.register, 'POST', {
        body: { email, password, name, role }
      });
      
      // Store session token if provided by backend
      if (result.success && result.sessionToken) {
        setSessionToken(result.sessionToken);
      }
      
      return result;
    } catch (error) {
      if (error instanceof RemoteApiError) {
        return { success: false, error: error.message };
      }
      return { success: false, error: 'Failed to connect to registration server' };
    }
  }

  async logout(): Promise<void> {
    // Clear session token on logout
    clearSessionToken();
  }

  async resetPassword(): Promise<{ success: boolean; newPassword?: string; emailSent?: boolean; error?: string }> {
    throw new RemoteApiError('Password reset must be handled by remote API');
  }

  async changePassword(): Promise<boolean> {
    throw new RemoteApiError('Password change must be handled by remote API');
  }

  async getUsers(): Promise<User[]> {
    throw new RemoteApiError('Get users not available in remote mode');
  }

  async getUserById(): Promise<User | undefined> {
    throw new RemoteApiError('Get user not available in remote mode');
  }

  async saveUser(): Promise<void> {
    throw new RemoteApiError('Save user not available in remote mode');
  }

  async deleteUser(): Promise<void> {
    throw new RemoteApiError('Delete user not available in remote mode');
  }
}
