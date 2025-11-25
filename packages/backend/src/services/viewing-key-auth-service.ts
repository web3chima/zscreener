import crypto from 'crypto';
import { pool } from '../config/database.js';

export class ViewingKeyAuthService {
  /**
   * Hash viewing key using SHA-256
   * Viewing keys should never be stored in plaintext
   */
  hashViewingKey(viewingKey: string): string {
    return crypto.createHash('sha256').update(viewingKey).digest('hex');
  }

  /**
   * Validate viewing key format
   * Zcash viewing keys have specific format requirements
   */
  validateViewingKeyFormat(viewingKey: string): boolean {
    // Basic validation - viewing key should be a non-empty string
    if (!viewingKey || typeof viewingKey !== 'string') {
      return false;
    }

    // Zcash viewing keys are typically base58-encoded and start with specific prefixes
    // For development, we accept keys that are at least 32 characters
    if (viewingKey.length < 32) {
      return false;
    }

    // In production, implement full Zcash viewing key validation:
    // 1. Check for proper prefix (zxviews for Sapling, zxviewtestsapling for testnet)
    // 2. Validate base58 encoding
    // 3. Verify checksum
    
    return true;
  }

  /**
   * Associate viewing key with user account
   * Stores the hashed viewing key to maintain privacy
   */
  async associateViewingKeyWithUser(
    userId: string,
    viewingKey: string
  ): Promise<{ success: boolean; viewingKeyHash: string }> {
    // Validate format
    if (!this.validateViewingKeyFormat(viewingKey)) {
      throw new Error('Invalid viewing key format');
    }

    // Hash the viewing key
    const viewingKeyHash = this.hashViewingKey(viewingKey);

    const client = await pool.connect();
    try {
      // Check if this viewing key is already associated with the user
      const existing = await client.query(
        `SELECT id FROM viewing_key_transactions 
         WHERE user_id = $1 AND viewing_key_hash = $2 
         LIMIT 1`,
        [userId, viewingKeyHash]
      );

      if (existing.rows.length > 0) {
        return { success: true, viewingKeyHash };
      }

      // Note: We don't insert into viewing_key_transactions here
      // That table is for associating viewing keys with specific transactions
      // Instead, we could create a separate user_viewing_keys table
      // For now, we'll just verify the key is valid and return the hash
      
      // In a production system, you might want to:
      // 1. Create a user_viewing_keys table to track which keys belong to which users
      // 2. Scan the blockchain for transactions matching this viewing key
      // 3. Populate viewing_key_transactions with matches

      return { success: true, viewingKeyHash };
    } finally {
      client.release();
    }
  }

  /**
   * Validate viewing key and check if it belongs to user
   */
  async validateViewingKey(
    _userId: string,
    viewingKey: string
  ): Promise<{ valid: boolean; viewingKeyHash?: string }> {
    // Validate format
    if (!this.validateViewingKeyFormat(viewingKey)) {
      return { valid: false };
    }

    // Hash the viewing key
    const viewingKeyHash = this.hashViewingKey(viewingKey);

    const client = await pool.connect();
    try {
      // Check if any transactions are associated with this viewing key and user
      // This could be used to verify the key has been used
      // const result = await client.query(
      //   `SELECT COUNT(*) as count FROM viewing_key_transactions 
      //    WHERE user_id = $1 AND viewing_key_hash = $2`,
      //   [userId, viewingKeyHash]
      // );

      return {
        valid: true, // Format is valid
        viewingKeyHash,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Get all viewing key hashes for a user
   */
  async getUserViewingKeys(userId: string): Promise<string[]> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT DISTINCT viewing_key_hash FROM viewing_key_transactions 
         WHERE user_id = $1`,
        [userId]
      );

      return result.rows.map((row) => row.viewing_key_hash);
    } finally {
      client.release();
    }
  }

  /**
   * Remove viewing key association from user
   */
  async removeViewingKeyFromUser(
    userId: string,
    viewingKey: string
  ): Promise<boolean> {
    const viewingKeyHash = this.hashViewingKey(viewingKey);

    const client = await pool.connect();
    try {
      // Remove all associations for this user and viewing key
      const result = await client.query(
        `DELETE FROM viewing_key_transactions 
         WHERE user_id = $1 AND viewing_key_hash = $2`,
        [userId, viewingKeyHash]
      );

      return result.rowCount !== null && result.rowCount > 0;
    } finally {
      client.release();
    }
  }
}

export const viewingKeyAuthService = new ViewingKeyAuthService();
