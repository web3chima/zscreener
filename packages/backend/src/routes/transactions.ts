import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { viewingKeyService } from '../services/viewing-key-service.js';
import { redisClient } from '../config/redis.js';

const router = Router();

/**
 * GET /api/transactions
 * Get shielded transactions with filtering and pagination
 */
router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      startBlock,
      endBlock,
      startDate,
      endDate,
      minShieldedInputs,
      minShieldedOutputs,
      limit = '50',
      offset = '0',
    } = req.query;

    // Build query with filters
    let query = `
      SELECT 
        id,
        tx_hash,
        block_height,
        timestamp,
        shielded_inputs,
        shielded_outputs,
        proof_data,
        memo_data,
        indexed_at
      FROM shielded_transactions
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 0;

    // Apply filters
    if (startBlock) {
      paramCount++;
      params.push(parseInt(startBlock as string));
      query += ` AND block_height >= $${paramCount}`;
    }

    if (endBlock) {
      paramCount++;
      params.push(parseInt(endBlock as string));
      query += ` AND block_height <= $${paramCount}`;
    }

    if (startDate) {
      paramCount++;
      params.push(new Date(startDate as string));
      query += ` AND timestamp >= $${paramCount}`;
    }

    if (endDate) {
      paramCount++;
      params.push(new Date(endDate as string));
      query += ` AND timestamp <= $${paramCount}`;
    }

    if (minShieldedInputs) {
      paramCount++;
      params.push(parseInt(minShieldedInputs as string));
      query += ` AND shielded_inputs >= $${paramCount}`;
    }

    if (minShieldedOutputs) {
      paramCount++;
      params.push(parseInt(minShieldedOutputs as string));
      query += ` AND shielded_outputs >= $${paramCount}`;
    }

    // Add ordering and pagination
    query += ` ORDER BY timestamp DESC`;
    
    paramCount++;
    params.push(parseInt(limit as string));
    query += ` LIMIT $${paramCount}`;
    
    paramCount++;
    params.push(parseInt(offset as string));
    query += ` OFFSET $${paramCount}`;

    // Execute query
    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM shielded_transactions
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamCount = 0;

    if (startBlock) {
      countParamCount++;
      countParams.push(parseInt(startBlock as string));
      countQuery += ` AND block_height >= $${countParamCount}`;
    }

    if (endBlock) {
      countParamCount++;
      countParams.push(parseInt(endBlock as string));
      countQuery += ` AND block_height <= $${countParamCount}`;
    }

    if (startDate) {
      countParamCount++;
      countParams.push(new Date(startDate as string));
      countQuery += ` AND timestamp >= $${countParamCount}`;
    }

    if (endDate) {
      countParamCount++;
      countParams.push(new Date(endDate as string));
      countQuery += ` AND timestamp <= $${countParamCount}`;
    }

    if (minShieldedInputs) {
      countParamCount++;
      countParams.push(parseInt(minShieldedInputs as string));
      countQuery += ` AND shielded_inputs >= $${countParamCount}`;
    }

    if (minShieldedOutputs) {
      countParamCount++;
      countParams.push(parseInt(minShieldedOutputs as string));
      countQuery += ` AND shielded_outputs >= $${countParamCount}`;
    }

    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        transactions: result.rows.map(row => ({
          id: row.id,
          txHash: row.tx_hash,
          blockHeight: row.block_height,
          timestamp: row.timestamp,
          shieldedInputs: row.shielded_inputs,
          shieldedOutputs: row.shielded_outputs,
          proofData: row.proof_data,
          memoData: row.memo_data,
          indexedAt: row.indexed_at,
        })),
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          hasMore: parseInt(offset as string) + result.rows.length < total,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transactions/:hash
 * Get a specific transaction by hash
 */
router.get('/:hash', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      res.status(400).json({
        error: {
          code: 'INVALID_HASH',
          message: 'Invalid transaction hash format',
        },
      });
      return;
    }

    // Check cache first
    const cacheKey = `tx:${hash}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Query database
    const result = await pool.query(
      `SELECT 
        id,
        tx_hash,
        block_height,
        timestamp,
        shielded_inputs,
        shielded_outputs,
        proof_data,
        memo_data,
        indexed_at
      FROM shielded_transactions
      WHERE tx_hash = $1`,
      [hash]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        error: {
          code: 'TRANSACTION_NOT_FOUND',
          message: 'Transaction not found',
        },
      });
      return;
    }

    const transaction = {
      id: result.rows[0].id,
      txHash: result.rows[0].tx_hash,
      blockHeight: result.rows[0].block_height,
      timestamp: result.rows[0].timestamp,
      shieldedInputs: result.rows[0].shielded_inputs,
      shieldedOutputs: result.rows[0].shielded_outputs,
      proofData: result.rows[0].proof_data,
      memoData: result.rows[0].memo_data,
      indexedAt: result.rows[0].indexed_at,
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(transaction));

    res.json({
      success: true,
      data: transaction,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transactions/by-viewing-key
 * Get transactions associated with a viewing key
 */
router.get('/by-viewing-key', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { viewingKey, limit = '50', offset = '0' } = req.query;

    if (!viewingKey || typeof viewingKey !== 'string') {
      res.status(400).json({
        error: {
          code: 'INVALID_REQUEST',
          message: 'Viewing key is required',
        },
      });
      return;
    }

    // Validate viewing key format
    if (!viewingKeyService.validateViewingKey(viewingKey)) {
      res.status(400).json({
        error: {
          code: 'INVALID_VIEWING_KEY',
          message: 'Invalid viewing key format',
        },
      });
      return;
    }

    // Check cache first
    const viewingKeyHash = viewingKeyService.hashViewingKey(viewingKey);
    const cacheKey = `vk:${viewingKeyHash}:${limit}:${offset}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Find transactions by viewing key
    const transactions = await viewingKeyService.findTransactionsByViewingKey(viewingKey);

    // Apply pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const paginatedTransactions = transactions.slice(offsetNum, offsetNum + limitNum);

    const response = {
      transactions: paginatedTransactions,
      pagination: {
        total: transactions.length,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + paginatedTransactions.length < transactions.length,
      },
      stats: await viewingKeyService.getViewingKeyStats(viewingKey),
    };

    // Cache for 1 minute (shorter cache for viewing key queries)
    await redisClient.setex(cacheKey, 60, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid viewing key')) {
      res.status(400).json({
        error: {
          code: 'INVALID_VIEWING_KEY',
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
});

export default router;
