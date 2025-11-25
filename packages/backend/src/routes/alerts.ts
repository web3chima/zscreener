import { Router, Request, Response, NextFunction } from 'express';
import { alertService } from '../services/alert-service.js';
import { authenticate } from '../middleware/auth.js';
import { CreateAlertRequest } from '../types/alert.js';

const router = Router();

/**
 * POST /api/alerts
 * Create a new alert
 */
router.post(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const alertConfig: CreateAlertRequest = req.body;

      if (!alertConfig.type || !alertConfig.conditions || !alertConfig.notificationMethod) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Alert type, conditions, and notification method are required',
          },
        });
        return;
      }

      // Create alert
      const alert = await alertService.createAlert(userId, alertConfig);

      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('validation failed')) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: error.message,
          },
        });
        return;
      }
      next(error);
    }
  }
);

/**
 * GET /api/alerts
 * Get all alerts for the authenticated user
 */
router.get(
  '/',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const activeOnly = req.query.active === 'true';

      const alerts = await alertService.getUserAlerts(userId, activeOnly);

      res.json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/alerts/:id
 * Get a specific alert by ID
 */
router.get(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const alertId = req.params.id;

      const alert = await alertService.getAlertById(alertId, userId);

      if (!alert) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: alert,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/alerts/:id
 * Delete an alert
 */
router.delete(
  '/:id',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const alertId = req.params.id;

      const deleted = await alertService.deleteAlert(alertId, userId);

      if (!deleted) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found or already deleted',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Alert deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PATCH /api/alerts/:id/status
 * Update alert active status
 */
router.patch(
  '/:id/status',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const alertId = req.params.id;
      const { isActive } = req.body;

      if (typeof isActive !== 'boolean') {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'isActive must be a boolean value',
          },
        });
        return;
      }

      const updated = await alertService.updateAlertStatus(alertId, userId, isActive);

      if (!updated) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: `Alert ${isActive ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/alerts/notifications
 * Get alert notifications for the authenticated user
 */
router.get(
  '/notifications/history',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const limit = parseInt(req.query.limit as string) || 50;

      if (limit < 1 || limit > 100) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Limit must be between 1 and 100',
          },
        });
        return;
      }

      const notifications = await alertService.getUserAlertNotifications(userId, limit);

      res.json({
        success: true,
        data: {
          notifications,
          count: notifications.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/alerts/:id/test
 * Test an alert by manually triggering it
 */
router.post(
  '/:id/test',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const alertId = req.params.id;

      // Verify alert belongs to user
      const alert = await alertService.getAlertById(alertId, userId);

      if (!alert) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Alert not found',
          },
        });
        return;
      }

      // Create test notification
      const notification = await alertService.storeAlertNotification(
        alertId,
        'Test alert notification',
        {
          test: true,
          alertType: alert.alertType,
          conditions: alert.conditions,
        }
      );

      // Deliver notification
      const { notificationService } = await import('../services/notification-service.js');
      await notificationService.deliverNotification(alertId, notification);

      res.json({
        success: true,
        message: 'Test notification sent',
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
