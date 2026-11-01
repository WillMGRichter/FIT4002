import { Router, Request, Response } from 'express';
import { joinProjectAsStudent } from '../services/studentJoinService';
import { joinRateLimiter } from '../middleware/rateLimiters';

/**
 * PUBLIC routes (no authentication) for the anonymous student join flow.
 *
 * Deliberately minimal: the ONLY unauthenticated action is joining a project by
 * its id, which mints a short-lived student identity + token. After joining, the
 * student is an ordinary authenticated student and uses the normal
 * /projects and /student-state routes with that token.
 */
const router = Router();

/**
 * POST /public/projects/:projectId/join
 * Rate limited per client IP (see middleware/rateLimiters.ts): this endpoint is
 * unauthenticated and every successful call creates database rows.
 * Body: { displayName: string, email: string }
 * Returns: { token, userId, displayName, email, maxAttempts }
 */
router.post('/projects/:projectId/join', joinRateLimiter, async (req: Request, res: Response) => {
  try {
    const { displayName, email } = req.body;
    const result = await joinProjectAsStudent(req.params.projectId as string, displayName, email);
    res.status(201).json(result);
  } catch (error: any) {
    const msg = error?.message || 'Could not join project';
    const status = msg === 'Project not found' ? 404 : 400;
    res.status(status).json({ error: msg });
  }
});

export default router;
