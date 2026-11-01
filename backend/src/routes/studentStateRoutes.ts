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
import { getErrorMessage } from '../utils/errors';

const router = Router();

/** GET /:projectId/state — Get or create the student's simulation state for a project. Requires auth. Returns: StudentState. */
router.get('/:projectId/state', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const state = await getOrCreateState(req.params.projectId as string, req.userId!);
    res.json(state);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** PUT /:projectId/state/inputs — Update the student's input values for the simulation. Requires auth. Body: { stateId: string, inputValues: Record<string, any> }. Returns: StudentState. */
router.put('/:projectId/state/inputs', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, inputValues } = req.body;
    const state = await updateInputValues(stateId, inputValues);
    res.json(state);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** PUT /:projectId/state/page — Update the student's current page within the simulation. Requires auth. Body: { stateId: string, pageId: string }. Returns: StudentState. */
router.put('/:projectId/state/page', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, pageId } = req.body;
    const state = await updateCurrentPage(stateId, pageId);
    res.json(state);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** POST /:projectId/state/complete — Mark a simulation attempt as completed. Requires auth. Body: { stateId: string, inputValues: Record<string, any> }. Returns: { message }. */
router.post('/:projectId/state/complete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { stateId, inputValues } = req.body;
    await completeAttempt(stateId, req.params.projectId as string, req.userId!, inputValues);
    res.json({ message: 'Simulation completed' });
  } catch (error: unknown) {
    console.error('[complete] failed:', error);
    res.status(400).json({ error: getErrorMessage(error, 'Failed to complete attempt') });
  }
});

/** GET /:projectId/results — Get all student results for a project (teacher-only: verifies user is the project creator). Requires auth. Returns: StudentResult[]. */
router.get('/:projectId/results', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can view results' });
    }

    const results = await getStudentResults(req.params.projectId as string);
    res.json(results);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

export default router;
