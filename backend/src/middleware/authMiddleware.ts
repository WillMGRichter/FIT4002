import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

/** Extends Express Request to include authenticated userId */
export interface AuthRequest extends Request {
  userId?: string;
}

/**
 * JWT authentication middleware.
 * Extracts Bearer token from Authorization header, verifies it,
 * and attaches the userId to the request object.
 * Returns 401 if token is missing, invalid, or expired.
 */
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);
  const userId = verifyToken(token);

  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = userId;
  next();
}
