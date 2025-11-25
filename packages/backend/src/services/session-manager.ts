import { redisClient } from '../config/redis.js';
import { UserSession } from '../types/auth.js';

const SESSION_PREFIX = 'session:';
const SESSION_INDEX_PREFIX = 'session_index:';
const DEFAULT_SESSION_TTL = 3600; // 1 hour in seconds

export class SessionManager {
  /**
   * Store session in Redis with TTL
   */
  async storeSession(
    userId: string,
    session: UserSession,
    ttl: number = DEFAULT_SESSION_TTL
  ): Promise<void> {
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const sessionData = JSON.stringify(session);

    // Store session with expiration
    await redisClient.setex(sessionKey, ttl, sessionData);

    // Create index by wallet address if present
    if (session.walletAddress) {
      const indexKey = `${SESSION_INDEX_PREFIX}${session.walletAddress}`;
      await redisClient.setex(indexKey, ttl, userId);
    }
  }

  /**
   * Retrieve session from Redis
   */
  async getSession(userId: string): Promise<UserSession | null> {
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const sessionData = await redisClient.get(sessionKey);

    if (!sessionData) {
      return null;
    }

    try {
      return JSON.parse(sessionData) as UserSession;
    } catch (error) {
      console.error('Failed to parse session data:', error);
      return null;
    }
  }

  /**
   * Get session by wallet address
   */
  async getSessionByWalletAddress(walletAddress: string): Promise<UserSession | null> {
    const indexKey = `${SESSION_INDEX_PREFIX}${walletAddress}`;
    const userId = await redisClient.get(indexKey);

    if (!userId) {
      return null;
    }

    return this.getSession(userId);
  }

  /**
   * Update session data
   */
  async updateSession(userId: string, updates: Partial<UserSession>): Promise<boolean> {
    const session = await this.getSession(userId);

    if (!session) {
      return false;
    }

    const updatedSession: UserSession = {
      ...session,
      ...updates,
    };

    // Get remaining TTL
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const ttl = await redisClient.ttl(sessionKey);

    // Store updated session with remaining TTL
    await this.storeSession(userId, updatedSession, ttl > 0 ? ttl : DEFAULT_SESSION_TTL);

    return true;
  }

  /**
   * Refresh session TTL (extend expiration)
   */
  async refreshSession(userId: string, ttl: number = DEFAULT_SESSION_TTL): Promise<boolean> {
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const exists = await redisClient.exists(sessionKey);

    if (!exists) {
      return false;
    }

    // Extend expiration
    await redisClient.expire(sessionKey, ttl);

    // Also refresh index if it exists
    const session = await this.getSession(userId);
    if (session?.walletAddress) {
      const indexKey = `${SESSION_INDEX_PREFIX}${session.walletAddress}`;
      const indexExists = await redisClient.exists(indexKey);
      if (indexExists) {
        await redisClient.expire(indexKey, ttl);
      }
    }

    return true;
  }

  /**
   * Delete session
   */
  async deleteSession(userId: string): Promise<boolean> {
    const session = await this.getSession(userId);

    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const deleted = await redisClient.del(sessionKey);

    // Also delete index
    if (session?.walletAddress) {
      const indexKey = `${SESSION_INDEX_PREFIX}${session.walletAddress}`;
      await redisClient.del(indexKey);
    }

    return deleted > 0;
  }

  /**
   * Check if session exists
   */
  async sessionExists(userId: string): Promise<boolean> {
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    const exists = await redisClient.exists(sessionKey);
    return exists === 1;
  }

  /**
   * Get session TTL (time to live in seconds)
   */
  async getSessionTTL(userId: string): Promise<number> {
    const sessionKey = `${SESSION_PREFIX}${userId}`;
    return await redisClient.ttl(sessionKey);
  }

  /**
   * Get all active sessions (for admin purposes)
   * Note: This can be expensive in production with many sessions
   */
  async getAllActiveSessions(): Promise<{ userId: string; session: UserSession }[]> {
    const pattern = `${SESSION_PREFIX}*`;
    const keys = await redisClient.keys(pattern);

    const sessions: { userId: string; session: UserSession }[] = [];

    for (const key of keys) {
      const userId = key.replace(SESSION_PREFIX, '');
      const session = await this.getSession(userId);

      if (session) {
        sessions.push({ userId, session });
      }
    }

    return sessions;
  }

  /**
   * Clean up expired sessions (manual cleanup if needed)
   * Redis automatically removes expired keys, but this can be used for manual cleanup
   */
  async cleanupExpiredSessions(): Promise<number> {
    const pattern = `${SESSION_PREFIX}*`;
    const keys = await redisClient.keys(pattern);

    let cleaned = 0;

    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl === -2) {
        // Key doesn't exist
        cleaned++;
      } else if (ttl === -1) {
        // Key exists but has no expiration (shouldn't happen)
        await redisClient.del(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Revoke all sessions for a user (useful for security purposes)
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.deleteSession(userId);
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalSessions: number;
    averageTTL: number;
  }> {
    const pattern = `${SESSION_PREFIX}*`;
    const keys = await redisClient.keys(pattern);

    if (keys.length === 0) {
      return { totalSessions: 0, averageTTL: 0 };
    }

    let totalTTL = 0;

    for (const key of keys) {
      const ttl = await redisClient.ttl(key);
      if (ttl > 0) {
        totalTTL += ttl;
      }
    }

    return {
      totalSessions: keys.length,
      averageTTL: Math.round(totalTTL / keys.length),
    };
  }
}

export const sessionManager = new SessionManager();
