// Core types for SwimTrack 24

export type UserRole = 'organizer' | 'referee' | 'monitor';

export interface User {
  id: string;
  email: string;
  password: string; // In real app, this would be hashed
  role: UserRole;
  name: string;
  createdAt: string;
}

export interface Competition {
  id: string;
  name: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  numberOfLanes: number;
  laneLength: number; // in meters
  doubleCountTimeout: number; // timeout in seconds to prevent double counting
  organizerId: string;
  status: 'upcoming' | 'active' | 'paused' | 'completed' | 'stopped';
  autoStart: boolean;
  autoFinish: boolean;
  actualStartTime: string | null;
  actualEndTime: string | null;
  createdAt: string;
  resultsPdf?: string; // Base64 PDF data URL for completed competitions
}

export interface Team {
  id: string;
  name: string;
  color: string;
  logo?: string;
  competitionId: string;
  assignedLane: number;
  createdAt: string;
}

export interface Swimmer {
  id: string;
  name: string;
  teamId: string;
  competitionId: string;
  isUnder12: boolean;
  parentName?: string;
  parentContact?: string;
  parentPresent?: boolean;
  createdAt: string;
}

export interface Referee {
  id: string;
  userId: string; // Generated login ID (ref_#####)
  name: string;
  email?: string; // Optional email
  password: string; // Generated human-friendly password
  competitionId: string;
  createdAt: string;
}

export interface SwimSession {
  id: string;
  competitionId: string;
  swimmerId: string;
  teamId: string;
  laneNumber: number;
  startTime: string;
  endTime: string | null;
  lapCount: number;
  isActive: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
}
