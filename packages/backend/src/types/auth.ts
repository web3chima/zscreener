// Authentication types
export interface AuthCredentials {
  walletAddress?: string;
  signature?: string;
  viewingKey?: string;
}

export interface UserSession {
  userId: string;
  walletAddress?: string;
  viewingKeys: string[];
  privacyPreferences: PrivacySettings;
  createdAt: number;
}

export interface PrivacySettings {
  useNillion: boolean;
  encryptProofViews: boolean;
  shareAnalytics: boolean;
}

export interface SessionToken {
  token: string;
  expiresIn: string;
}

export interface JWTPayload {
  userId: string;
  walletAddress?: string;
  iat?: number;
  exp?: number;
}
