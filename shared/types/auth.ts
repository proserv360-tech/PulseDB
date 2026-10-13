/**
 * Authentication & User types
 */

// ── User Roles ──────────────────────────────────────────────────────────────
export type UserRole = 'super_admin' | 'admin' | 'analyst' | 'viewer' | 'demo';
export type AccessLevel = 'read' | 'write';
export type UserStatus = 'active' | 'suspended' | 'locked';
export type DataAccess = 'internal' | 'restricted' | 'public';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// ── User (as returned to frontend) ──────────────────────────────────────────
export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  accessLevel: AccessLevel;
  allowedScreens: string[];
  dataAccess: DataAccess;
  department: string | null;
  location: string | null;
  mfa: boolean;
  apiAccess: boolean;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
  loginActivity: number[];
  failedLogins: number;
  riskScore: number;
  sessions: number;
}

// ── User (raw DB row — internal, never sent to client) ──────────────────────
export interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  name: string;
  email: string;
  role: UserRole;
  access_level: AccessLevel;
  allowed_screens: string[];
  data_access: DataAccess;
  department: string | null;
  location: string | null;
  mfa_enabled: boolean;
  api_access: boolean;
  status: UserStatus;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  deleted_at: string | null;
  login_activity?: number[];
  failed_logins?: number;
  risk_score?: number;
  session_count?: number;
}

// ── Create User ─────────────────────────────────────────────────────────────
export interface CreateUserInput {
  username: string;
  password: string;
  name: string;
  email: string;
  role: UserRole;
  allowedScreens?: string[];
  status?: UserStatus;
  department?: string | null;
  location?: string | null;
  mfa?: boolean;
  apiAccess?: boolean;
  dataAccess?: DataAccess;
}

// ── Update User ─────────────────────────────────────────────────────────────
export interface UpdateUserInput {
  name?: string;
  email?: string;
  role?: UserRole;
  allowedScreens?: string[];
  status?: UserStatus;
  department?: string | null;
  location?: string | null;
  mfa?: boolean;
  apiAccess?: boolean;
  dataAccess?: DataAccess;
}

// ── JWT Payload ─────────────────────────────────────────────────────────────
export interface JwtPayload {
  id: number;
  username: string;
  role: UserRole;
  allowedScreens: string[];
  accessLevel: AccessLevel;
  sid?: string;  // session ID for revocation
  iat?: number;
  exp?: number;
}

// ── Login ───────────────────────────────────────────────────────────────────
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ── Session ─────────────────────────────────────────────────────────────────
export interface Session {
  id: string;
  userId: number;
  user: string;
  ip: string;
  device: string;
  location: string;
  risk: RiskLevel;
  active: boolean;
  expiresAt: string;
  createdAt: string;
}

// ── API Key ─────────────────────────────────────────────────────────────────
export interface ApiKey {
  id: number;
  userId: number;
  name: string;
  prefix: string;
  scope: string;
  totalCalls: number;
  lastUsedAt: string | null;
  status: 'active' | 'revoked';
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scope?: string;
}

export interface CreateApiKeyResponse {
  key: string;     // full plaintext — shown ONCE
  record: ApiKey;
}
