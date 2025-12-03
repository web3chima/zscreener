import { Router, Request, Response, NextFunction } from 'express';
import { pool } from '../config/database.js';
import { redisClient } from '../config/redis.js';
import { zcashRPCClient } from '../services/zcash-rpc-client.js';

const router = Router();

interface NetworkStats {
  totalShieldedTransactions: number;
  totalShieldedValue: number;
  averageTransactionSize: number;
  shieldedPoolSize: number;
  last24hVolume: number;
  last24hTransactions: number;
  networkHashrate?: number; // Added for live stats
}

interface ShieldedPoolMetrics {
  totalInputs: number;
  totalOutputs: number;
  inputOutputRatio: number;
  averageInputsPerTx: number;
  averageOutputsPerTx: number;
  transactionsByType: {
    spendOnly: number;
    outputOnly: number;
    mixed: number;
  };
}

interface VolumeData {
  timestamp: Date;
  transactionCount: number;
  totalInputs: number;
  totalOutputs: number;
}

/**
 * GET /api/analytics/network-stats
 * Get overall network statistics
 */
router.get('/network-stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check cache first
    const cacheKey = 'analytics:network-stats';
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Get live Network Hashrate from Zcash Node
    let networkHashrate = 0;
    try {
      // Try getnetworksolps first
      networkHashrate = await zcashRPCClient.call<number>('getnetworksolps', []);
    } catch (e) {
      console.warn('Failed to fetch getnetworksolps:', e);
      try {
        // Fallback to getmininginfo if available
        const miningInfo = await zcashRPCClient.call<any>('getmininginfo', []);
        networkHashrate = miningInfo.networksolps || 0;
      } catch (e2) {
        console.warn('Failed to fetch mining info:', e2);
      }
    }

    // Get total shielded transactions
    const totalTxResult = await pool.query(
      'SELECT COUNT(*) as total FROM shielded_transactions'
    );
    const totalShieldedTransactions = parseInt(totalTxResult.rows[0].total);

    // Get average transaction size
    const avgSizeResult = await pool.query(
      `SELECT 
        AVG(shielded_inputs + shielded_outputs) as avg_size
      FROM shielded_transactions`
    );
    const averageTransactionSize = parseFloat(avgSizeResult.rows[0].avg_size) || 0;

    // Get shielded pool size (total outputs - total inputs)
    const poolSizeResult = await pool.query(
      `SELECT 
        SUM(shielded_outputs) as total_outputs,
        SUM(shielded_inputs) as total_inputs
      FROM shielded_transactions`
    );
    const totalOutputs = parseInt(poolSizeResult.rows[0].total_outputs) || 0;
    const totalInputs = parseInt(poolSizeResult.rows[0].total_inputs) || 0;
    const shieldedPoolSize = totalOutputs - totalInputs;

    // Get last 24h volume
    const last24hResult = await pool.query(
      `SELECT 
        COUNT(*) as tx_count,
        SUM(shielded_inputs + shielded_outputs) as volume
      FROM shielded_transactions
      WHERE timestamp >= NOW() - INTERVAL '24 hours'`
    );
    const last24hTransactions = parseInt(last24hResult.rows[0].tx_count) || 0;
    const last24hVolume = parseInt(last24hResult.rows[0].volume) || 0;

    // Get latest block height for additional context
    const latestBlockResult = await pool.query(
      'SELECT MAX(block_height) as latest_block FROM shielded_transactions'
    );
    const latestBlock = parseInt(latestBlockResult.rows[0].latest_block) || 0;

    const stats: NetworkStats & { latestBlock: number } = {
      totalShieldedTransactions,
      totalShieldedValue: totalOutputs, // Using total outputs as proxy for value
      averageTransactionSize: Math.round(averageTransactionSize * 100) / 100,
      shieldedPoolSize,
      last24hVolume,
      last24hTransactions,
      latestBlock,
      networkHashrate,
    };

    // Cache for 2 minutes (lower cache time for live hashrate)
    await redisClient.setex(cacheKey, 120, JSON.stringify(stats));

    res.json({
      success: true,
      data: stats,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/shielded-pool
 * Get shielded pool metrics
 */
router.get('/shielded-pool', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check cache first
    const cacheKey = 'analytics:shielded-pool';
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Get total inputs and outputs
    const totalsResult = await pool.query(
      `SELECT 
        SUM(shielded_inputs) as total_inputs,
        SUM(shielded_outputs) as total_outputs,
        COUNT(*) as total_transactions
      FROM shielded_transactions`
    );

    const totalInputs = parseInt(totalsResult.rows[0].total_inputs) || 0;
    const totalOutputs = parseInt(totalsResult.rows[0].total_outputs) || 0;
    const totalTransactions = parseInt(totalsResult.rows[0].total_transactions) || 1;

    // Get transaction type breakdown
    const typeBreakdownResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE shielded_inputs > 0 AND shielded_outputs = 0) as spend_only,
        COUNT(*) FILTER (WHERE shielded_inputs = 0 AND shielded_outputs > 0) as output_only,
        COUNT(*) FILTER (WHERE shielded_inputs > 0 AND shielded_outputs > 0) as mixed
      FROM shielded_transactions`
    );

    const metrics: ShieldedPoolMetrics = {
      totalInputs,
      totalOutputs,
      inputOutputRatio: totalInputs > 0 ? totalOutputs / totalInputs : 0,
      averageInputsPerTx: totalInputs / totalTransactions,
      averageOutputsPerTx: totalOutputs / totalTransactions,
      transactionsByType: {
        spendOnly: parseInt(typeBreakdownResult.rows[0].spend_only) || 0,
        outputOnly: parseInt(typeBreakdownResult.rows[0].output_only) || 0,
        mixed: parseInt(typeBreakdownResult.rows[0].mixed) || 0,
      },
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(metrics));

    res.json({
      success: true,
      data: metrics,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/volume
 * Get transaction volume over time with time range support
 */
router.get('/volume', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      timeRange = '24h',
      interval = 'hour',
      startDate,
      endDate,
    } = req.query;

    // Build cache key
    const cacheKey = `analytics:volume:${timeRange}:${interval}:${startDate || ''}:${endDate || ''}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Determine time range
    let timeCondition = '';
    let intervalTrunc = '';

    if (startDate && endDate) {
      timeCondition = `WHERE timestamp >= '${startDate}' AND timestamp <= '${endDate}'`;
    } else {
      switch (timeRange) {
        case '1h':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '1 hour'";
          break;
        case '24h':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '24 hours'";
          break;
        case '7d':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '7 days'";
          break;
        case '30d':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '30 days'";
          break;
        case '90d':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '90 days'";
          break;
        case '1y':
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '1 year'";
          break;
        default:
          timeCondition = "WHERE timestamp >= NOW() - INTERVAL '24 hours'";
      }
    }

    // Determine interval truncation
    switch (interval) {
      case 'minute':
        intervalTrunc = "date_trunc('minute', timestamp)";
        break;
      case 'hour':
        intervalTrunc = "date_trunc('hour', timestamp)";
        break;
      case 'day':
        intervalTrunc = "date_trunc('day', timestamp)";
        break;
      case 'week':
        intervalTrunc = "date_trunc('week', timestamp)";
        break;
      case 'month':
        intervalTrunc = "date_trunc('month', timestamp)";
        break;
      default:
        intervalTrunc = "date_trunc('hour', timestamp)";
    }

    // Query volume data
    const volumeResult = await pool.query(
      `SELECT 
        ${intervalTrunc} as time_bucket,
        COUNT(*) as transaction_count,
        SUM(shielded_inputs) as total_inputs,
        SUM(shielded_outputs) as total_outputs
      FROM shielded_transactions
      ${timeCondition}
      GROUP BY time_bucket
      ORDER BY time_bucket ASC`
    );

    const volumeData: VolumeData[] = volumeResult.rows.map(row => ({
      timestamp: row.time_bucket,
      transactionCount: parseInt(row.transaction_count),
      totalInputs: parseInt(row.total_inputs) || 0,
      totalOutputs: parseInt(row.total_outputs) || 0,
    }));

    // Calculate summary statistics
    const totalTransactions = volumeData.reduce((sum, d) => sum + d.transactionCount, 0);
    const totalInputs = volumeData.reduce((sum, d) => sum + d.totalInputs, 0);
    const totalOutputs = volumeData.reduce((sum, d) => sum + d.totalOutputs, 0);
    const averagePerInterval = volumeData.length > 0 ? totalTransactions / volumeData.length : 0;

    const response = {
      volumeData,
      summary: {
        totalTransactions,
        totalInputs,
        totalOutputs,
        averagePerInterval: Math.round(averagePerInterval * 100) / 100,
        dataPoints: volumeData.length,
      },
      query: {
        timeRange,
        interval,
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };

    // Cache for 2 minutes (shorter for volume data)
    await redisClient.setex(cacheKey, 120, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/analytics/recent-activity
 * Get recent transaction activity summary
 */
router.get('/recent-activity', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { hours = '24' } = req.query;
    const hoursNum = parseInt(hours as string);

    // Check cache
    const cacheKey = `analytics:recent-activity:${hours}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Get hourly breakdown
    const activityResult = await pool.query(
      `SELECT 
        date_trunc('hour', timestamp) as hour,
        COUNT(*) as tx_count,
        SUM(shielded_inputs) as inputs,
        SUM(shielded_outputs) as outputs,
        AVG(shielded_inputs + shielded_outputs) as avg_size
      FROM shielded_transactions
      WHERE timestamp >= NOW() - INTERVAL '${hoursNum} hours'
      GROUP BY hour
      ORDER BY hour DESC`
    );

    const activity = activityResult.rows.map(row => ({
      hour: row.hour,
      transactionCount: parseInt(row.tx_count),
      inputs: parseInt(row.inputs) || 0,
      outputs: parseInt(row.outputs) || 0,
      averageSize: parseFloat(row.avg_size) || 0,
    }));

    // Cache for 3 minutes
    await redisClient.setex(cacheKey, 180, JSON.stringify(activity));

    res.json({
      success: true,
      data: activity,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
