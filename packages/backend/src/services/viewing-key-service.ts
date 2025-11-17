import { pool } from '../config/database.js';
import crypto from 'crypto';

interface ViewingKeyAssociation {
  id: string;
  viewingKeyHash: string;
  transactionId: string;
  userId?: string;
  createdAt: Date;
}

interface TransactionMatch {
  txHash: string;
  blockHeight: number;
  timestamp: Date;
  shieldedInputs: number;
  shieldedOutputs: number;
  memoData?: string;
}

export class ViewingKeyServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ViewingKeyServiceError';
  }
}

export class ViewingKeyService {
  /**
   * Hash a viewing key for secure storage
   */
  hashViewingKey(viewingKey: string): string {
    return crypto
      .createHash('sha256')
      .update(viewingKey)
      .digest('hex');
  }

  /**
   * Validate viewing key format
   */
  validateViewingKey(viewingKey: string): boolean {
    // Basic validation - viewing keys should be hex strings of specific length
    // Zcash viewing keys are typically 64+ characters
    if (!viewingKey || typeof viewingKey !== 'string') {
      return false;
    }

    // Check if it's a valid hex string
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (!hexRegex.test(viewingKey)) {
      return false;
    }

    // Check minimum length (Zcash viewing keys are typically longer)
    if (viewingKey.length < 64) {
      return false;
    }

    return true;
  }

  /**
   * Decrypt shielded outputs with viewing key
   * Note: This is a placeholder implementation. In production, you would use
   * the actual Zcash cryptographic libraries to decrypt shielded outputs.
   */
  private async decryptShieldedOutput(
    _viewingKey: string,
    _encryptedOutput: any
  ): Promise<boolean> {
    // Placeholder: In a real implementation, this would:
    // 1. Use the viewing key to attempt decryption of the output
    // 2. Return true if decryption succeeds (meaning this output belongs to the viewing key owner)
    // 3. Return false if decryption fails
    
    // For now, we'll use a simplified approach based on the output structure
    // This should be replaced with actual Zcash cryptographic operations
    try {
      // Simulate decryption attempt
      // In reality, you'd use librustzcash or similar library
      return false; // Placeholder
    } catch (error) {
      return false;
    }
  }

  /**
   * Find transactions associated with a viewing key
   * This scans shielded transactions and attempts to decrypt outputs
   */
  async findTransactionsByViewingKey(
    viewingKey: string,
    _userId?: string
  ): Promise<TransactionMatch[]> {
    if (!this.validateViewingKey(viewingKey)) {
      throw new ViewingKeyServiceError(
        'Invalid viewing key format',
        'INVALID_VIEWING_KEY'
      );
    }

    const viewingKeyHash = this.hashViewingKey(viewingKey);

    try {
      // First, check if we have cached associations
      const cachedResult = await pool.query(
        `SELECT st.tx_hash, st.block_height, st.timestamp, 
                st.shielded_inputs, st.shielded_outputs, st.memo_data
         FROM viewing_key_transactions vkt
         JOIN shielded_transactions st ON vkt.transaction_id = st.id
         WHERE vkt.viewing_key_hash = $1
         ORDER BY st.timestamp DESC`,
        [viewingKeyHash]
      );

      if (cachedResult.rows.length > 0) {
        return cachedResult.rows.map(row => ({
          txHash: row.tx_hash,
          blockHeight: row.block_height,
          timestamp: row.timestamp,
          shieldedInputs: row.shielded_inputs,
          shieldedOutputs: row.shielded_outputs,
          memoData: row.memo_data,
        }));
      }

      // If no cached results, we need to scan transactions
      // In a production system, this would be done by the indexer worker
      // For now, return empty array and let the worker handle it
      return [];
    } catch (error: any) {
      throw new ViewingKeyServiceError(
        `Failed to find transactions: ${error.message}`,
        'FIND_TRANSACTIONS_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Associate a transaction with a viewing key
   */
  async associateTransaction(
    viewingKey: string,
    transactionId: string,
    userId?: string
  ): Promise<ViewingKeyAssociation> {
    if (!this.validateViewingKey(viewingKey)) {
      throw new ViewingKeyServiceError(
        'Invalid viewing key format',
        'INVALID_VIEWING_KEY'
      );
    }

    const viewingKeyHash = this.hashViewingKey(viewingKey);

    try {
      const result = await pool.query(
        `INSERT INTO viewing_key_transactions 
         (viewing_key_hash, transaction_id, user_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (viewing_key_hash, transaction_id) DO UPDATE SET
           user_id = COALESCE(EXCLUDED.user_id, viewing_key_transactions.user_id)
         RETURNING id, viewing_key_hash, transaction_id, user_id, created_at`,
        [viewingKeyHash, transactionId, userId || null]
      );

      return {
        id: result.rows[0].id,
        viewingKeyHash: result.rows[0].viewing_key_hash,
        transactionId: result.rows[0].transaction_id,
        userId: result.rows[0].user_id,
        createdAt: result.rows[0].created_at,
      };
    } catch (error: any) {
      throw new ViewingKeyServiceError(
        `Failed to associate transaction: ${error.message}`,
        'ASSOCIATE_TRANSACTION_ERROR',
        { transactionId, error: error.message }
      );
    }
  }

  /**
   * Batch associate multiple transactions with a viewing key
   */
  async batchAssociateTransactions(
    viewingKey: string,
    transactionIds: string[],
    userId?: string
  ): Promise<number> {
    if (!this.validateViewingKey(viewingKey)) {
      throw new ViewingKeyServiceError(
        'Invalid viewing key format',
        'INVALID_VIEWING_KEY'
      );
    }

    const viewingKeyHash = this.hashViewingKey(viewingKey);
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let associatedCount = 0;

      for (const transactionId of transactionIds) {
        try {
          await client.query(
            `INSERT INTO viewing_key_transactions 
             (viewing_key_hash, transaction_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (viewing_key_hash, transaction_id) DO NOTHING`,
            [viewingKeyHash, transactionId, userId || null]
          );
          associatedCount++;
        } catch (error) {
          // Log but continue with other transactions
          console.error(`Failed to associate transaction ${transactionId}:`, error);
        }
      }

      await client.query('COMMIT');
      return associatedCount;
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw new ViewingKeyServiceError(
        `Failed to batch associate transactions: ${error.message}`,
        'BATCH_ASSOCIATE_ERROR',
        { count: transactionIds.length, error: error.message }
      );
    } finally {
      client.release();
    }
  }

  /**
   * Scan and associate transactions for a viewing key
   * This is typically called by a background worker
   */
  async scanAndAssociate(
    viewingKey: string,
    userId?: string,
    startBlock?: number,
    endBlock?: number
  ): Promise<number> {
    if (!this.validateViewingKey(viewingKey)) {
      throw new ViewingKeyServiceError(
        'Invalid viewing key format',
        'INVALID_VIEWING_KEY'
      );
    }

    try {
      // Build query to get transactions in range
      let query = `
        SELECT id, tx_hash, proof_data
        FROM shielded_transactions
        WHERE shielded_outputs > 0
      `;
      const params: any[] = [];

      if (startBlock !== undefined) {
        params.push(startBlock);
        query += ` AND block_height >= $${params.length}`;
      }

      if (endBlock !== undefined) {
        params.push(endBlock);
        query += ` AND block_height <= $${params.length}`;
      }

      query += ' ORDER BY block_height ASC';

      const result = await pool.query(query, params);
      const matchedTransactionIds: string[] = [];

      // Attempt to decrypt each transaction's outputs
      for (const row of result.rows) {
        try {
          const proofData = JSON.parse(row.proof_data);
          
          // Check if any outputs can be decrypted with this viewing key
          if (proofData.outputProofs && proofData.outputProofs.length > 0) {
            for (const output of proofData.outputProofs) {
              const canDecrypt = await this.decryptShieldedOutput(viewingKey, output);
              if (canDecrypt) {
                matchedTransactionIds.push(row.id);
                break; // Found a match, no need to check other outputs
              }
            }
          }
        } catch (error) {
          console.error(`Error processing transaction ${row.tx_hash}:`, error);
        }
      }

      // Batch associate matched transactions
      if (matchedTransactionIds.length > 0) {
        return await this.batchAssociateTransactions(
          viewingKey,
          matchedTransactionIds,
          userId
        );
      }

      return 0;
    } catch (error: any) {
      throw new ViewingKeyServiceError(
        `Failed to scan and associate: ${error.message}`,
        'SCAN_ASSOCIATE_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Remove viewing key associations for a user
   */
  async removeAssociations(viewingKey: string, userId?: string): Promise<number> {
    const viewingKeyHash = this.hashViewingKey(viewingKey);

    try {
      let query = 'DELETE FROM viewing_key_transactions WHERE viewing_key_hash = $1';
      const params: any[] = [viewingKeyHash];

      if (userId) {
        params.push(userId);
        query += ` AND user_id = $${params.length}`;
      }

      const result = await pool.query(query, params);
      return result.rowCount || 0;
    } catch (error: any) {
      throw new ViewingKeyServiceError(
        `Failed to remove associations: ${error.message}`,
        'REMOVE_ASSOCIATIONS_ERROR',
        { error: error.message }
      );
    }
  }

  /**
   * Get statistics for a viewing key
   */
  async getViewingKeyStats(viewingKey: string): Promise<{
    totalTransactions: number;
    totalShieldedInputs: number;
    totalShieldedOutputs: number;
    firstTransaction?: Date;
    lastTransaction?: Date;
  }> {
    const viewingKeyHash = this.hashViewingKey(viewingKey);

    try {
      const result = await pool.query(
        `SELECT 
           COUNT(*) as total_transactions,
           SUM(st.shielded_inputs) as total_inputs,
           SUM(st.shielded_outputs) as total_outputs,
           MIN(st.timestamp) as first_tx,
           MAX(st.timestamp) as last_tx
         FROM viewing_key_transactions vkt
         JOIN shielded_transactions st ON vkt.transaction_id = st.id
         WHERE vkt.viewing_key_hash = $1`,
        [viewingKeyHash]
      );

      const row = result.rows[0];

      return {
        totalTransactions: parseInt(row.total_transactions) || 0,
        totalShieldedInputs: parseInt(row.total_inputs) || 0,
        totalShieldedOutputs: parseInt(row.total_outputs) || 0,
        firstTransaction: row.first_tx || undefined,
        lastTransaction: row.last_tx || undefined,
      };
    } catch (error: any) {
      throw new ViewingKeyServiceError(
        `Failed to get viewing key stats: ${error.message}`,
        'GET_STATS_ERROR',
        { error: error.message }
      );
    }
  }
}

// Export singleton instance
export const viewingKeyService = new ViewingKeyService();
