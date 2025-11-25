import { Router, Request, Response, NextFunction } from 'express';
import { crossChainService, DefiPosition, BridgeActivity } from '../services/cross-chain-service.js';
import { redisClient } from '../config/redis.js';
import { pool } from '../config/database.js';

const router = Router();

/**
 * GET /api/cross-chain/defi
 * Get DeFi positions and metrics across NEAR protocol
 * Query params:
 *   - zcashAddress: Zcash address to correlate (optional)
 *   - nearAddress: NEAR address to query (optional)
 *   - refresh: Force refresh cache (optional, default: false)
 */
router.get('/defi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress, refresh } = req.query;

    // Validate that at least one address is provided
    if (!zcashAddress && !nearAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESS',
          message: 'Either zcashAddress or nearAddress must be provided',
        },
      });
      return;
    }

    // Build cache key
    const cacheKey = `cross-chain:defi:${zcashAddress || nearAddress}`;
    
    // Check cache unless refresh is requested
    if (refresh !== 'true') {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
        return;
      }
    }

    let defiPositions: DefiPosition[] = [];
    let correlatedAddress: string | undefined;

    if (zcashAddress) {
      // Fetch cross-chain data using Zcash address
      const crossChainData = await crossChainService.fetchCrossChainData(
        zcashAddress as string,
        nearAddress as string | undefined
      );
      defiPositions = crossChainData.defiPositions;
      correlatedAddress = crossChainData.nearAddress;
    } else if (nearAddress) {
      // Fetch DeFi positions directly using NEAR address
      defiPositions = await crossChainService.fetchDefiPositions(nearAddress as string);
      correlatedAddress = nearAddress as string;
    }

    // Calculate aggregate metrics
    const totalPositions = defiPositions.length;
    const positionsByProtocol = defiPositions.reduce((acc, pos) => {
      acc[pos.protocol] = (acc[pos.protocol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const positionsByType = defiPositions.reduce((acc, pos) => {
      acc[pos.positionType] = (acc[pos.positionType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total value if available
    const totalValueUSD = defiPositions.reduce((sum, pos) => {
      return sum + (pos.valueUSD || 0);
    }, 0);

    const response = {
      zcashAddress: zcashAddress || null,
      nearAddress: correlatedAddress || null,
      defiPositions,
      metrics: {
        totalPositions,
        positionsByProtocol,
        positionsByType,
        totalValueUSD: totalValueUSD > 0 ? totalValueUSD : null,
      },
      lastUpdated: Date.now(),
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching DeFi data:', error);
    next(error);
  }
});

/**
 * GET /api/cross-chain/bridge-activity
 * Get bridge activity between NEAR and other chains
 * Query params:
 *   - zcashAddress: Zcash address to correlate (optional)
 *   - nearAddress: NEAR address to query (optional)
 *   - refresh: Force refresh cache (optional, default: false)
 *   - limit: Number of activities to return (optional, default: 50)
 */
router.get('/bridge-activity', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress, refresh, limit = '50' } = req.query;

    // Validate that at least one address is provided
    if (!zcashAddress && !nearAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESS',
          message: 'Either zcashAddress or nearAddress must be provided',
        },
      });
      return;
    }

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    // Build cache key
    const cacheKey = `cross-chain:bridge:${zcashAddress || nearAddress}:${limitNum}`;
    
    // Check cache unless refresh is requested
    if (refresh !== 'true') {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.json({
          success: true,
          data: JSON.parse(cached),
          cached: true,
        });
        return;
      }
    }

    let bridgeActivity: BridgeActivity[] = [];
    let correlatedAddress: string | undefined;

    if (zcashAddress) {
      // Fetch cross-chain data using Zcash address
      const crossChainData = await crossChainService.fetchCrossChainData(
        zcashAddress as string,
        nearAddress as string | undefined
      );
      bridgeActivity = crossChainData.bridgeActivity;
      correlatedAddress = crossChainData.nearAddress;
    } else if (nearAddress) {
      // Fetch bridge activity directly using NEAR address
      bridgeActivity = await crossChainService.fetchBridgeActivity(nearAddress as string);
      correlatedAddress = nearAddress as string;
    }

    // Limit results
    const limitedActivity = bridgeActivity.slice(0, limitNum);

    // Calculate aggregate metrics
    const totalActivity = limitedActivity.length;
    const activityByDirection = limitedActivity.reduce((acc, activity) => {
      acc[activity.direction] = (acc[activity.direction] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activityByStatus = limitedActivity.reduce((acc, activity) => {
      acc[activity.status] = (acc[activity.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const activityByToken = limitedActivity.reduce((acc, activity) => {
      acc[activity.tokenSymbol] = (acc[activity.tokenSymbol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get unique bridge contracts
    const uniqueBridges = [...new Set(limitedActivity.map(a => a.bridgeContract))];

    const response = {
      zcashAddress: zcashAddress || null,
      nearAddress: correlatedAddress || null,
      bridgeActivity: limitedActivity,
      metrics: {
        totalActivity,
        activityByDirection,
        activityByStatus,
        activityByToken,
        uniqueBridges,
      },
      lastUpdated: Date.now(),
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching bridge activity:', error);
    next(error);
  }
});

/**
 * GET /api/cross-chain/correlation
 * Get correlation data between Zcash and NEAR addresses
 * This endpoint implements the correlation logic between addresses
 * Query params:
 *   - zcashAddress: Zcash address (required)
 *   - nearAddress: NEAR address to correlate (optional)
 */
router.get('/correlation', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.query;

    if (!zcashAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ZCASH_ADDRESS',
          message: 'zcashAddress is required',
        },
      });
      return;
    }

    // Build cache key
    const cacheKey = `cross-chain:correlation:${zcashAddress}:${nearAddress || 'auto'}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Fetch full cross-chain data
    const crossChainData = await crossChainService.fetchCrossChainData(
      zcashAddress as string,
      nearAddress as string | undefined
    );

    // Check if we have a stored correlation in the database
    const correlationResult = await pool.query(
      'SELECT * FROM cross_chain_data WHERE zcash_address = $1',
      [zcashAddress]
    );

    const hasStoredCorrelation = correlationResult.rows.length > 0;
    const storedNearAddress = hasStoredCorrelation 
      ? correlationResult.rows[0].near_data?.nearAddress 
      : null;

    // Correlation strength heuristics
    let correlationStrength: 'none' | 'weak' | 'moderate' | 'strong' = 'none';
    const correlationFactors: string[] = [];

    if (crossChainData.nearAddress) {
      // Check if there's activity
      const hasDefiActivity = crossChainData.defiPositions.length > 0;
      const hasBridgeActivity = crossChainData.bridgeActivity.length > 0;
      const hasTransactions = crossChainData.transactions.length > 0;

      if (hasDefiActivity) {
        correlationFactors.push('DeFi positions found');
      }
      if (hasBridgeActivity) {
        correlationFactors.push('Bridge activity detected');
      }
      if (hasTransactions) {
        correlationFactors.push('NEAR transactions found');
      }

      // Calculate correlation strength
      const activityScore = 
        (hasDefiActivity ? 1 : 0) + 
        (hasBridgeActivity ? 1 : 0) + 
        (hasTransactions ? 1 : 0);

      if (activityScore === 0) {
        correlationStrength = 'weak';
        correlationFactors.push('Addresses provided but no activity found');
      } else if (activityScore === 1) {
        correlationStrength = 'moderate';
      } else {
        correlationStrength = 'strong';
      }
    }

    const response = {
      zcashAddress: zcashAddress as string,
      nearAddress: crossChainData.nearAddress || storedNearAddress || null,
      correlationStrength,
      correlationFactors,
      hasStoredCorrelation,
      activitySummary: {
        defiPositions: crossChainData.defiPositions.length,
        bridgeActivity: crossChainData.bridgeActivity.length,
        transactions: crossChainData.transactions.length,
      },
      lastUpdated: crossChainData.lastUpdated,
    };

    // Cache for 10 minutes
    await redisClient.setex(cacheKey, 600, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching correlation data:', error);
    next(error);
  }
});

/**
 * POST /api/cross-chain/link-addresses
 * Manually link a Zcash address with a NEAR address
 * Body:
 *   - zcashAddress: Zcash address (required)
 *   - nearAddress: NEAR address (required)
 */
router.post('/link-addresses', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.body;

    if (!zcashAddress || !nearAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESSES',
          message: 'Both zcashAddress and nearAddress are required',
        },
      });
      return;
    }

    // Fetch and store cross-chain data with the linked addresses
    const crossChainData = await crossChainService.fetchCrossChainData(
      zcashAddress,
      nearAddress
    );

    // Invalidate relevant caches
    const cacheKeys = [
      `cross-chain:defi:${zcashAddress}`,
      `cross-chain:bridge:${zcashAddress}`,
      `cross-chain:correlation:${zcashAddress}:${nearAddress}`,
      `cross-chain:correlation:${zcashAddress}:auto`,
    ];

    for (const key of cacheKeys) {
      await redisClient.del(key);
    }

    res.json({
      success: true,
      data: {
        zcashAddress,
        nearAddress,
        linked: true,
        activitySummary: {
          defiPositions: crossChainData.defiPositions.length,
          bridgeActivity: crossChainData.bridgeActivity.length,
          transactions: crossChainData.transactions.length,
        },
      },
    });
  } catch (error) {
    console.error('Error linking addresses:', error);
    next(error);
  }
});

/**
 * GET /api/cross-chain/summary
 * Get a summary of all cross-chain data for an address
 * Query params:
 *   - zcashAddress: Zcash address (optional)
 *   - nearAddress: NEAR address (optional)
 */
router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.query;

    if (!zcashAddress && !nearAddress) {
      res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_ADDRESS',
          message: 'Either zcashAddress or nearAddress must be provided',
        },
      });
      return;
    }

    // Build cache key
    const cacheKey = `cross-chain:summary:${zcashAddress || nearAddress}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Fetch complete cross-chain data
    let crossChainData;
    if (zcashAddress) {
      crossChainData = await crossChainService.fetchCrossChainData(
        zcashAddress as string,
        nearAddress as string | undefined
      );
    } else {
      // If only NEAR address provided, fetch data directly
      const [defiPositions, bridgeActivity, transactions] = await Promise.all([
        crossChainService.fetchDefiPositions(nearAddress as string),
        crossChainService.fetchBridgeActivity(nearAddress as string),
        crossChainService.fetchNEARTransactions(nearAddress as string),
      ]);

      crossChainData = {
        zcashAddress: null,
        nearAddress: nearAddress as string,
        defiPositions,
        bridgeActivity,
        transactions,
        lastUpdated: Date.now(),
      };
    }

    // Build comprehensive summary
    const summary = {
      addresses: {
        zcash: crossChainData.zcashAddress,
        near: crossChainData.nearAddress,
      },
      defi: {
        totalPositions: crossChainData.defiPositions.length,
        protocols: [...new Set(crossChainData.defiPositions.map(p => p.protocol))],
        positionTypes: [...new Set(crossChainData.defiPositions.map(p => p.positionType))],
      },
      bridge: {
        totalActivity: crossChainData.bridgeActivity.length,
        uniqueBridges: [...new Set(crossChainData.bridgeActivity.map(a => a.bridgeContract))],
        directions: {
          toNear: crossChainData.bridgeActivity.filter(a => a.direction === 'to_near').length,
          fromNear: crossChainData.bridgeActivity.filter(a => a.direction === 'from_near').length,
        },
      },
      transactions: {
        total: crossChainData.transactions.length,
        successful: crossChainData.transactions.filter(t => t.status === 'success').length,
        failed: crossChainData.transactions.filter(t => t.status === 'failure').length,
      },
      lastUpdated: crossChainData.lastUpdated,
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(summary));

    res.json({
      success: true,
      data: summary,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching cross-chain summary:', error);
    next(error);
  }
});

export default router;
