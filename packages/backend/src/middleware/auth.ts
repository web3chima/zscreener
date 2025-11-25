import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth-service.js';

/**
 * Authentication middleware
 * Verifies JWT token and attaches userId to request
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided',
        },
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const payload = authService.verifyJWT(token);

    // Check if session exists in Redis
    const session = await authService.getSession(payload.userId);

    if (!session) {
      res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
        },
      });
      return;
    }

    // Attach user info to request
    (req as any).userId = payload.userId;
    (req as any).walletAddress = payload.walletAddress;
    (req as any).session = session;

    next();
  } catch (error) {
    res.status(401).json({
      error: {
        code: 'INVALID_TOKEN',
        message: error instanceof Error ? error.message : 'Invalid authentication token',
      },
    });
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't require it
 */
export const optionalAuth = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = authService.verifyJWT(token);
      const session = await authService.getSession(payload.userId);

      if (session) {
        (req as any).userId = payload.userId;
        (req as any).walletAddress = payload.walletAddress;
        (req as any).session = session;
      }
    }

    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};
