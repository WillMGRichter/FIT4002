import { Router, Request, Response } from 'express';
import { registerUser, loginUser, loginStudent, createOrganisation, listOrganisations } from '../services/authService';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { getErrorMessage } from '../utils/errors';
import { loginAccountRateLimiter, loginIpRateLimiter, signupRateLimiter } from '../middleware/rateLimiters';

const router = Router();

interface SignupRequest {
  username: string;
  password: string;
  organisationName?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

/** POST /signup/organisation — Create organisation and organisation admin account. Body: { username, password, organisationName }. Returns: { user, token }. */
router.post('/signup/organisation', signupRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, organisationName } = req.body as SignupRequest;

    if (!username || !password || !organisationName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create organisation first
    const organisationId = await createOrganisation(organisationName);

    // Create user as organisation admin
    const result = await registerUser(username, password, 'admin', organisationId);

    res.status(201).json(result);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** POST /signup — Register new user (teacher or student) for an existing organisation. Body: { username, password, role, organisationId }. Returns: { user, token }. */
router.post('/signup', signupRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password, role, organisationId } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const result = await registerUser(username, password, role, organisationId);

    res.status(201).json(result);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** GET /organisations — List all organisations. Requires auth. Returns: Organisation[]. */
router.get('/organisations', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const orgs = await listOrganisations();
    res.json(orgs);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** POST /login — Authenticate user and return JWT token. Body: { username, password }. Returns: { user, token }. */
router.post('/login', loginIpRateLimiter, loginAccountRateLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const result = await loginUser(username, password);

    res.json(result);
  } catch (error: unknown) {
    res.status(401).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /login/student — Authenticate a student within a specific project.
 * Student accounts are project-scoped (migration 005), so login is resolved by
 * (projectId, username). Body: { projectId, username, password }.
 * Returns: { user, token }.
 */
router.post('/login/student', loginIpRateLimiter, loginAccountRateLimiter, async (req: Request, res: Response) => {
  try {
    const { projectId, username, password } = req.body as {
      projectId?: string;
      username?: string;
      password?: string;
    };

    if (!projectId || !username || !password) {
      return res.status(400).json({ error: 'Missing projectId, username or password' });
    }

    const result = await loginStudent(projectId, username, password);

    res.json(result);
  } catch (error: unknown) {
    res.status(401).json({ error: getErrorMessage(error) });
  }
});

export default router;
