import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import {
  createProject,
  getProjectById,
  getProjectsByTeacher,
  updateProject,
  deleteProject,
  addProjectParticipant,
  getProjectParticipants,
  removeProjectParticipant,
  getStudentProjects,
} from '../services/projectService';
import { getUserById } from '../services/authService';

const router = Router();

// Create a new project
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, excelData } = req.body;
    const userId = req.userId!;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    // Get user to verify role and organisation
    const user = await getUserById(userId);
    if (!user.organisation_id) {
      return res.status(400).json({ error: 'User must be part of an organisation' });
    }

    const project = await createProject(name, userId, user.organisation_id, description, excelData);
    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get project by ID
router.get('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId);
    res.json(project);
  } catch (error: any) {
    res.status(404).json({ error: 'Project not found' });
  }
});

// Get teacher's projects
router.get('/teacher/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getProjectsByTeacher(req.userId!);
    res.json(projects);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get student's projects
router.get('/student/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getStudentProjects(req.userId!);
    res.json(projects);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update project
router.put('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId);

    // Check authorization - only creator or admins can update
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Unauthorized to update this project' });
    }

    const updated = await updateProject(req.params.projectId, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete project
router.delete('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId);

    // Check authorization
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Unauthorized to delete this project' });
    }

    await deleteProject(req.params.projectId);
    res.json({ message: 'Project deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Add participant to project
router.post('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role } = req.body;
    const project = await getProjectById(req.params.projectId);

    // Check authorization
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can add participants' });
    }

    const participant = await addProjectParticipant(req.params.projectId, userId, role);
    res.status(201).json(participant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get project participants
router.get('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipants(req.params.projectId);
    res.json(participants);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Remove participant from project
router.delete(
  '/:projectId/participants/:userId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await getProjectById(req.params.projectId);

      // Check authorization
      if (project.created_by !== req.userId!) {
        return res.status(403).json({ error: 'Only project creator can remove participants' });
      }

      await removeProjectParticipant(req.params.projectId, req.params.userId);
      res.json({ message: 'Participant removed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
