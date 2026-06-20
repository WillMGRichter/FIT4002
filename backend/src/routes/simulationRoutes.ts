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

/** POST /:projectId/progress — Save a student's simulation progress state. Requires auth. Body: { state: any }. Returns: SimulationProgress. */
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

/** GET /:projectId/progress — Retrieve the authenticated user's saved simulation progress for a project. Requires auth. Returns: SimulationProgress | null. */
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

/** POST /:projectId/complete — Mark a simulation as completed with final state. Requires auth. Body: { finalState: any }. Returns: SimulationResult. */
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

/** GET /:projectId/results — Get aggregated results for a project (teacher-only: verifies user is the project creator). Requires auth. Returns: SimulationResult[]. */
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

/** GET /:projectId/results/user — Get the authenticated user's own results for a project. Requires auth. Returns: SimulationResult[]. */
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
