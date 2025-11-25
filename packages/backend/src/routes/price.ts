import { Router, Request, Response, NextFunction } from 'express';
import { priceService } from '../services/price-service.js';

const router = Router();

/**
 * GET /api/price/zec
 * Get current ZEC price with caching
 */
router.get('/zec', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const priceData = await priceService.getPrice();

    res.json({
      success: true,
      data: priceData,
      cached: Date.now() - priceData.cached_at < 60000, // Consider cached if less than 1 minute old
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/price/zec/historical
 * Get historical ZEC price data
 */
router.get('/zec/historical', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { days = '7' } = req.query;
    const daysNum = parseInt(days as string);

    if (isNaN(daysNum) || daysNum < 1 || daysNum > 365) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_DAYS',
          message: 'Days parameter must be between 1 and 365',
        },
      });
      return;
    }

    const historicalData = await priceService.getHistoricalPrice(daysNum);

    res.json({
      success: true,
      data: historicalData,
      query: {
        days: daysNum,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/price/health
 * Health check for price service
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Try to fetch price to verify service is working
    await priceService.getPrice();

    res.json({
      success: true,
      status: 'operational',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'degraded',
      error: 'Price service unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

