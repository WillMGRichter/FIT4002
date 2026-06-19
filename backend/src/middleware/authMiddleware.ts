import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService';

export interface AuthRequest extends Request {
  userId?: string;
}

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
