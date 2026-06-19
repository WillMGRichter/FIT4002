import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import {
  getOrCreateState,
  updateInputValues,
  updateCurrentPage,
  completeAttempt,
  getStudentResults,
} from '../services/studentStateService';
import { getProjectById } from '../services/projectService';

const router = Router();

router.get('/:projectId/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const state = await getOrCreateState(req.params.projectId as string, req.userId!);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:projectId/state/inputs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, inputValues } = req.body;
    const state = await updateInputValues(stateId, inputValues);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:projectId/state/page', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, pageId } = req.body;
    const state = await updateCurrentPage(stateId, pageId);
    res.json(state);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:projectId/state/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, inputValues } = req.body;
    await completeAttempt(stateId, req.params.projectId as string, req.userId!, inputValues);
    res.json({ message: 'Simulation completed' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:projectId/results', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can view results' });
    }

    const results = await getStudentResults(req.params.projectId as string);
    res.json(results);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
