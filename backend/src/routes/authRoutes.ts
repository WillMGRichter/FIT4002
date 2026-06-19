import { Router, Request, Response } from 'express';
import { registerUser, loginUser, createOrganisation } from '../services/authService';

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

// Create organisation and organisation admin account
router.post('/signup/organisation', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Register new user (teacher or student) for existing organisation
router.post('/signup', async (req: Request, res: Response) => {
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
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const result = await loginUser(username, password);

    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
});

export default router;
