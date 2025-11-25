import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth-service.js';
import { viewingKeyAuthService } from '../services/viewing-key-auth-service.js';
import { authenticate } from '../middleware/auth.js';
import { AuthCredentials } from '../types/auth.js';

const router = Router();

/**
 * POST /api/auth/signin
 * Sign in with wallet signature
 */
router.post('/signin', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const credentials: AuthCredentials = req.body;

    if (!credentials.walletAddress || !credentials.signature) {
      res.status(400).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Wallet address and signature are required',
        },
      });
      return;
    }

    const { session, token } = await authService.signIn(credentials);

    res.json({
      success: true,
      data: {
        session,
        token: token.token,
        expiresIn: token.expiresIn,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_FAILED',
          message: error.message,
        },
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/auth/signout
 * Sign out and revoke session
 */
router.post('/signout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId; // Set by auth middleware

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    await authService.revokeSession(userId);

    res.json({
      success: true,
      message: 'Signed out successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/session
 * Get current session information
 */
router.get('/session', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = (req as any).userId; // Set by auth middleware

    if (!userId) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        },
      });
      return;
    }

    const session = await authService.getSession(userId);

    if (!session) {
      res.status(404).json({
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session not found or expired',
        },
      });
      return;
    }

    // Refresh session TTL
    await authService.refreshSession(userId);

    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/validate-viewing-key
 * Validate and associate viewing key with user account
 */
router.post(
  '/validate-viewing-key',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const { viewingKey } = req.body;

      if (!viewingKey) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Viewing key is required',
          },
        });
        return;
      }

      // Validate viewing key format
      const isValidFormat = viewingKeyAuthService.validateViewingKeyFormat(viewingKey);

      if (!isValidFormat) {
        res.status(400).json({
          error: {
            code: 'INVALID_VIEWING_KEY',
            message: 'Invalid viewing key format',
          },
        });
        return;
      }

      // Associate viewing key with user
      const result = await viewingKeyAuthService.associateViewingKeyWithUser(
        userId,
        viewingKey
      );

      // Update session with new viewing key
      const session = await authService.getSession(userId);
      if (session && !session.viewingKeys.includes(result.viewingKeyHash)) {
        session.viewingKeys.push(result.viewingKeyHash);
        await authService.createSession(userId, session.walletAddress);
      }

      res.json({
        success: true,
        data: {
          viewingKeyHash: result.viewingKeyHash,
          message: 'Viewing key validated and associated with account',
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_FAILED',
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
 * GET /api/auth/viewing-keys
 * Get all viewing keys associated with user
 */
router.get(
  '/viewing-keys',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;

      const viewingKeys = await viewingKeyAuthService.getUserViewingKeys(userId);

      res.json({
        success: true,
        data: {
          viewingKeys,
          count: viewingKeys.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/auth/viewing-key
 * Remove viewing key association from user
 */
router.delete(
  '/viewing-key',
  authenticate,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).userId;
      const { viewingKey } = req.body;

      if (!viewingKey) {
        res.status(400).json({
          error: {
            code: 'INVALID_REQUEST',
            message: 'Viewing key is required',
          },
        });
        return;
      }

      const removed = await viewingKeyAuthService.removeViewingKeyFromUser(
        userId,
        viewingKey
      );

      if (!removed) {
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Viewing key not found for this user',
          },
        });
        return;
      }

      // Update session
      await authService.createSession(userId, (req as any).walletAddress);

      res.json({
        success: true,
        message: 'Viewing key removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
