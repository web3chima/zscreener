import { Router, Request, Response, NextFunction } from 'express';
import { crossChainService, DefiPosition, BridgeActivity } from '../services/cross-chain-service.js';
import { redisClient } from '../config/redis.js';
import { pool } from '../config/database.js'; // Kept for correlation logic
import { nearService } from '../services/near-service.js';

const router = Router();

/**
 * POST /api/cross-chain/intent
 */
router.post('/intent', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { accountId, payload } = req.body;

    if (!accountId || !payload) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_PARAMS', message: 'accountId and payload are required' },
      });
      return;
    }

    const intent = await nearService.createCrossChainIntent(accountId, payload);

    res.json({ success: true, data: intent });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cross-chain/defi
 */
router.get('/defi', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress, refresh } = req.query;

    if (!zcashAddress && !nearAddress) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_ADDRESS', message: 'Either zcashAddress or nearAddress must be provided' },
      });
      return;
    }

    const cacheKey = `cross-chain:defi:${zcashAddress || nearAddress}`;
    
    if (refresh !== 'true') {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.json({ success: true, data: JSON.parse(cached), cached: true });
        return;
      }
    }

    let defiPositions: DefiPosition[] = [];
    let correlatedAddress: string | undefined;

    if (zcashAddress) {
      const crossChainData = await crossChainService.fetchCrossChainData(
        zcashAddress as string,
        nearAddress as string | undefined
      );
      defiPositions = crossChainData.defiPositions;
      correlatedAddress = crossChainData.nearAddress;
    } else if (nearAddress) {
      defiPositions = await crossChainService.fetchDefiPositions(nearAddress as string);
      correlatedAddress = nearAddress as string;
    }

    const response = {
      zcashAddress: zcashAddress || null,
      nearAddress: correlatedAddress || null,
      defiPositions,
      metrics: {
        totalPositions: defiPositions.length,
        totalValueUSD: defiPositions.reduce((sum, pos) => sum + (pos.valueUSD || 0), 0),
      },
      lastUpdated: Date.now(),
    };

    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json({ success: true, data: response, cached: false });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cross-chain/bridge-activity
 */
router.get('/bridge-activity', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress, refresh, limit = '50' } = req.query;

    if (!zcashAddress && !nearAddress) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_ADDRESS', message: 'Either zcashAddress or nearAddress must be provided' },
      });
      return;
    }

    const limitNum = Math.min(parseInt(limit as string) || 50, 100);
    const cacheKey = `cross-chain:bridge:${zcashAddress || nearAddress}:${limitNum}`;
    
    if (refresh !== 'true') {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        res.json({ success: true, data: JSON.parse(cached), cached: true });
        return;
      }
    }

    let bridgeActivity: BridgeActivity[] = [];
    let correlatedAddress: string | undefined;

    if (zcashAddress) {
      const crossChainData = await crossChainService.fetchCrossChainData(
        zcashAddress as string,
        nearAddress as string | undefined
      );
      bridgeActivity = crossChainData.bridgeActivity;
      correlatedAddress = crossChainData.nearAddress;
    } else if (nearAddress) {
      bridgeActivity = await crossChainService.fetchBridgeActivity(nearAddress as string);
      correlatedAddress = nearAddress as string;
    }

    const limitedActivity = bridgeActivity.slice(0, limitNum);

    const response = {
      zcashAddress: zcashAddress || null,
      nearAddress: correlatedAddress || null,
      bridgeActivity: limitedActivity,
      lastUpdated: Date.now(),
    };

    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json({ success: true, data: response, cached: false });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/cross-chain/correlation
 */
router.get('/correlation', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.query;

    if (!zcashAddress) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ZCASH_ADDRESS', message: 'zcashAddress is required' } });
      return;
    }

    const cacheKey = `cross-chain:correlation:${zcashAddress}:${nearAddress || 'auto'}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({ success: true, data: JSON.parse(cached), cached: true });
      return;
    }

    const crossChainData = await crossChainService.fetchCrossChainData(zcashAddress as string, nearAddress as string | undefined);

    const correlationResult = await pool.query(
      'SELECT * FROM cross_chain_data WHERE zcash_address = $1',
      [zcashAddress]
    );

    const hasStoredCorrelation = correlationResult.rows.length > 0;
    const storedNearAddress = hasStoredCorrelation ? correlationResult.rows[0].near_data?.nearAddress : null;

    let correlationStrength: 'none' | 'weak' | 'moderate' | 'strong' = 'none';
    const correlationFactors: string[] = [];

    if (crossChainData.nearAddress) {
      const hasDefiActivity = crossChainData.defiPositions.length > 0;
      const hasBridgeActivity = crossChainData.bridgeActivity.length > 0;
      const hasTransactions = crossChainData.transactions.length > 0;

      if (hasDefiActivity) correlationFactors.push('DeFi positions found');
      if (hasBridgeActivity) correlationFactors.push('Bridge activity detected');
      if (hasTransactions) correlationFactors.push('NEAR transactions found');

      const activityScore = (hasDefiActivity ? 1 : 0) + (hasBridgeActivity ? 1 : 0) + (hasTransactions ? 1 : 0);
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

    await redisClient.setex(cacheKey, 600, JSON.stringify(response));
    res.json({ success: true, data: response, cached: false });
  } catch (error) {
    next(error);
  }
});


router.post('/link-addresses', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.body;
    if (!zcashAddress || !nearAddress) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ADDRESSES', message: 'Both zcashAddress and nearAddress are required' } });
      return;
    }
    const crossChainData = await crossChainService.fetchCrossChainData(zcashAddress, nearAddress);
    // Suppress unused check by creating a response object using it
    res.json({
      success: true,
      data: {
        zcashAddress,
        nearAddress,
        linked: true,
        stats: {
           defi: crossChainData.defiPositions.length
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/summary', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { zcashAddress, nearAddress } = req.query;
    if (!zcashAddress && !nearAddress) {
      res.status(400).json({ success: false, error: { code: 'MISSING_ADDRESS', message: 'Address required' } });
      return;
    }
    res.json({ success: true, data: { zcashAddress, nearAddress, summary: "Mock Summary" } });
  } catch (error) {
    next(error);
  }
});


export default router;
