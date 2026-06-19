import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import {
  saveSimulationProgress,
  getSimulationProgress,
  completeSimulation,
  getProjectResults,
  getUserProjectResults,
} from '../services/simulationService';
import { getProjectById } from '../services/projectService';

const router = Router();

// Save simulation progress
router.post('/:projectId/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const { state } = req.body;
    const userId = req.userId!;

    if (!state) {
      return res.status(400).json({ error: 'State is required' });
    }

    const progress = await saveSimulationProgress(projectId, userId, state);
    res.json(progress);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get simulation progress
router.get('/:projectId/progress', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const userId = req.userId!;

    const progress = await getSimulationProgress(projectId, userId);
    res.json(progress);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Complete simulation
router.post('/:projectId/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const { finalState } = req.body;
    const userId = req.userId!;

    if (!finalState) {
      return res.status(400).json({ error: 'Final state is required' });
    }

    const result = await completeSimulation(projectId, userId, finalState);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get project results (for teachers)
router.get('/:projectId/results', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const userId = req.userId!;

    // Verify user is the project creator (teacher)
    const project = await getProjectById(projectId);
    if (project.created_by !== userId) {
      return res.status(403).json({ error: 'Unauthorized to view these results' });
    }

    const results = await getProjectResults(projectId as string);
    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get user's results for a project
router.get('/:projectId/results/user', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const userId = req.userId!;

    const results = await getUserProjectResults(projectId, userId);
    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
