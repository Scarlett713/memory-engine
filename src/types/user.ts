export interface User {
  id: string;
  email: string;
  passwordHash: string;
  userType: 'personal' | 'org';
  orgName?: string;
  createdAt: string;
  lastLoginAt: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  userType: 'personal' | 'org';
  orgName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  userType: 'personal' | 'org';
}

export interface UserProfile {
  id: string;
  email: string;
  userType: 'personal' | 'org';
  orgName?: string;
  createdAt: string;
  lastLoginAt: string;
}
