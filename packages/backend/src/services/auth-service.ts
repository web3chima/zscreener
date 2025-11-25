import jwt from 'jsonwebtoken';
import { pool } from '../config/database.js';
import { sessionManager } from './session-manager.js';
import {
  AuthCredentials,
  UserSession,
  SessionToken,
  JWTPayload,
  PrivacySettings,
} from '../types/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';
const SESSION_TTL = 3600; // 1 hour in seconds

export class AuthenticationService {
  /**
   * Sign in user with wallet signature
   * Verifies the signature and creates a session
   */
  async signIn(credentials: AuthCredentials): Promise<{ session: UserSession; token: SessionToken }> {
    if (!credentials.walletAddress || !credentials.signature) {
      throw new Error('Wallet address and signature are required');
    }

    // Verify the signature
    const isValid = await this.verifyWalletSignature(
      credentials.walletAddress,
      credentials.signature
    );

    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // Find or create user
    const userId = await this.findOrCreateUser(credentials.walletAddress);

    // Create session
    const session = await this.createSession(userId, credentials.walletAddress);

    // Generate JWT token
    const token = this.generateJWT(userId, credentials.walletAddress);

    return { session, token };
  }

  /**
   * Verify wallet signature
   * In production, this should verify the actual cryptographic signature
   * For now, we implement a basic validation
   */
  private async verifyWalletSignature(
    _walletAddress: string,
    signature: string
  ): Promise<boolean> {
    // Basic validation - check if signature is not empty and has reasonable length
    if (!signature || signature.length < 64) {
      return false;
    }

    // In production, implement actual signature verification:
    // 1. Reconstruct the message that was signed
    // 2. Verify the signature using the wallet's public key
    // 3. Ensure the signature matches the wallet address
    
    // For development, we accept any signature with proper format
    return true;
  }

  /**
   * Find existing user or create new one
   */
  private async findOrCreateUser(walletAddress: string): Promise<string> {
    const client = await pool.connect();
    try {
      // Check if user exists
      const existingUser = await client.query(
        'SELECT id FROM users WHERE wallet_address = $1',
        [walletAddress]
      );

      if (existingUser.rows.length > 0) {
        return existingUser.rows[0].id;
      }

      // Create new user with default privacy preferences
      const defaultPreferences: PrivacySettings = {
        useNillion: false,
        encryptProofViews: false,
        shareAnalytics: true,
      };

      const newUser = await client.query(
        `INSERT INTO users (wallet_address, privacy_preferences, nillion_enabled)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [walletAddress, JSON.stringify(defaultPreferences), false]
      );

      return newUser.rows[0].id;
    } finally {
      client.release();
    }
  }

  /**
   * Create user session and store in Redis
   */
  async createSession(userId: string, walletAddress?: string): Promise<UserSession> {
    const client = await pool.connect();
    try {
      // Get user data
      const userResult = await client.query(
        'SELECT privacy_preferences FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const privacyPreferences = userResult.rows[0].privacy_preferences || {
        useNillion: false,
        encryptProofViews: false,
        shareAnalytics: true,
      };

      // Get viewing keys for this user
      const viewingKeysResult = await client.query(
        'SELECT DISTINCT viewing_key_hash FROM viewing_key_transactions WHERE user_id = $1',
        [userId]
      );

      const viewingKeys = viewingKeysResult.rows.map((row) => row.viewing_key_hash);

      const session: UserSession = {
        userId,
        walletAddress,
        viewingKeys,
        privacyPreferences,
        createdAt: Date.now(),
      };

      // Store session in Redis using SessionManager
      await sessionManager.storeSession(userId, session, SESSION_TTL);

      return session;
    } finally {
      client.release();
    }
  }

  /**
   * Generate JWT token for authenticated session
   */
  generateJWT(userId: string, walletAddress?: string): SessionToken {
    const payload: JWTPayload = {
      userId,
      walletAddress,
    };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN as string,
    } as jwt.SignOptions);

    return {
      token,
      expiresIn: JWT_EXPIRES_IN,
    };
  }

  /**
   * Verify JWT token and return payload
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Get session from Redis
   */
  async getSession(userId: string): Promise<UserSession | null> {
    return sessionManager.getSession(userId);
  }

  /**
   * Refresh session TTL
   */
  async refreshSession(userId: string): Promise<void> {
    await sessionManager.refreshSession(userId, SESSION_TTL);
  }

  /**
   * Revoke session
   */
  async revokeSession(userId: string): Promise<void> {
    await sessionManager.deleteSession(userId);
  }

  /**
   * Update session data
   */
  async updateSession(userId: string, updates: Partial<UserSession>): Promise<boolean> {
    return sessionManager.updateSession(userId, updates);
  }

  /**
   * Get session by wallet address
   */
  async getSessionByWalletAddress(walletAddress: string): Promise<UserSession | null> {
    return sessionManager.getSessionByWalletAddress(walletAddress);
  }
}

export const authService = new AuthenticationService();
