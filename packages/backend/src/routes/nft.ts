import { Router, Request, Response, NextFunction } from 'express';
import { zsaParser } from '../services/zsa-parser.js';
import { zip231Parser } from '../services/zip231-parser.js';
import { redisClient } from '../config/redis.js';

const router = Router();

/**
 * GET /api/nft/assets
 * Get NFT assets with filtering and pagination
 */
router.get('/assets', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      isShielded,
      limit = '50',
      offset = '0',
    } = req.query;

    // Parse query parameters
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    // Validate parameters
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      res.status(400).json({
        error: {
          code: 'INVALID_LIMIT',
          message: 'Limit must be between 1 and 100',
        },
      });
      return;
    }

    if (isNaN(offsetNum) || offsetNum < 0) {
      res.status(400).json({
        error: {
          code: 'INVALID_OFFSET',
          message: 'Offset must be a non-negative number',
        },
      });
      return;
    }

    // Build cache key
    const cacheKey = `nft:assets:${isShielded}:${limitNum}:${offsetNum}`;
    
    // Check cache first
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Parse isShielded filter
    let isShieldedFilter: boolean | undefined;
    if (isShielded !== undefined) {
      if (isShielded === 'true') {
        isShieldedFilter = true;
      } else if (isShielded === 'false') {
        isShieldedFilter = false;
      }
    }

    // Get assets from ZSA parser
    const { assets, total } = await zsaParser.getAssets({
      isShielded: isShieldedFilter,
      limit: limitNum,
      offset: offsetNum,
    });

    // Enrich assets with memo data
    const enrichedAssets = await Promise.all(
      assets.map(async (asset) => {
        const memo = await zip231Parser.getMemoForAsset(asset.assetId);
        return {
          ...asset,
          memo: memo ? {
            type: memo.memoType,
            content: memo.parsedContent,
          } : null,
        };
      })
    );

    const response = {
      assets: enrichedAssets,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + enrichedAssets.length < total,
      },
      filters: {
        isShielded: isShieldedFilter,
      },
    };

    // Cache for 2 minutes
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
 * GET /api/nft/asset/:id
 * Get a specific NFT asset by ID
 */
router.get('/asset/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        error: {
          code: 'INVALID_ASSET_ID',
          message: 'Asset ID is required',
        },
      });
      return;
    }

    // Check cache first
    const cacheKey = `nft:asset:${id}`;
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Get asset from ZSA parser
    const asset = await zsaParser.getAssetById(id);

    if (!asset) {
      res.status(404).json({
        error: {
          code: 'ASSET_NOT_FOUND',
          message: 'NFT asset not found',
        },
      });
      return;
    }

    // Get memo data
    const memo = await zip231Parser.getMemoForAsset(id);

    const response = {
      asset: {
        ...asset,
        memo: memo ? {
          type: memo.memoType,
          content: memo.parsedContent,
          encoding: memo.encoding,
        } : null,
      },
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

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
 * GET /api/nft/stats
 * Get NFT statistics
 */
router.get('/stats', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Check cache first
    const cacheKey = 'nft:stats';
    const cached = await redisClient.get(cacheKey);

    if (cached) {
      res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
      });
      return;
    }

    // Get all assets to calculate stats
    const allAssets = await zsaParser.getAssets({ limit: 10000 });
    const shieldedAssets = await zsaParser.getAssets({ isShielded: true, limit: 10000 });
    const publicAssets = await zsaParser.getAssets({ isShielded: false, limit: 10000 });

    const response = {
      stats: {
        totalAssets: allAssets.total,
        shieldedAssets: shieldedAssets.total,
        publicAssets: publicAssets.total,
        shieldedPercentage: allAssets.total > 0 
          ? ((shieldedAssets.total / allAssets.total) * 100).toFixed(2)
          : '0.00',
      },
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(response));

    res.json({
      success: true,
      data: response,
      cached: false,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

