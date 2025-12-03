import { Router, Request, Response, NextFunction } from 'express';
import { getNilDBService } from '../services/nil-db-service.js';
// import { getNilccService } from '../services/nilcc-service.js'; // Unused

const router = Router();
const nilDBService = getNilDBService();
// const nilccService = getNilccService(); // Unused

// ... existing code ...
/**
 * GET /api/privacy/status
 */
router.get('/status', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({
      success: true,
      data: {
        nilDB: 'operational',
        nilCC: 'operational',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/privacy/store
 */
router.post('/store', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { schema, data } = req.body;

    if (!schema || !data) {
      res.status(400).json({
        error: {
          code: 'MISSING_PARAMS',
          message: 'Schema and data are required',
        },
      });
      return;
    }

    const userId = req.body.userId || 'anonymous';
    
    const result = await nilDBService.storeData(data, {
       userId: userId,
       metadata: { schema }
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/privacy/query
 */
router.post('/query', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { schema } = req.body;

    if (!schema) {
      res.status(400).json({
        error: {
          code: 'MISSING_SCHEMA',
          message: 'Schema is required',
        },
      });
      return;
    }

    res.json({
      success: true,
      data: [],
      message: "Query functionality limited in demo"
    });
  } catch (error) {
    next(error);
  }
});

export default router;
