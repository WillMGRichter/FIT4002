import { Router, Response } from 'express';
import multer from 'multer';
import { buildExcelData } from '../excel/excelDataBuilder';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import {
  createProject,
  getProjectById,
  getProjectsByTeacher,
  updateProject,
  deleteProject,
  addProjectParticipant,
  getProjectParticipants,
  getProjectParticipantsWithUsernames,
  removeProjectParticipant,
  getStudentProjects,
} from '../services/projectService';
import { getUserById, registerUser } from '../services/authService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

/** POST / — Create a new project with optional Excel upload. Multipart: file + fields (title, description, students JSON). Requires auth. Returns: Project. */
router.post('/', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const name = req.body.title || req.body.name;
    const description = req.body.description;
    const userId = req.userId!;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const user = await getUserById(userId);
    if (!user.organisation_id) {
      return res.status(400).json({ error: 'User must be part of an organisation' });
    }

    // Parse the Excel file if provided
    let excelData = null;
    if (req.file) {
      excelData = buildExcelData(req.file.buffer);
    }

    const project = await createProject(name, userId, user.organisation_id, description, excelData, parseInt(req.body.defaultMaxAttempts, 10) || 1);

    // Create student accounts and add as participants
    let students: any[] = [];
    try {
      students = JSON.parse(req.body.students || '[]');
    } catch { /* ignore parse errors */ }

    for (const student of students) {
      if (!student.username) continue;
      try {
        const { user: newUser } = await registerUser(
          student.username,
          student.password || 'password123',
          'student',
          user.organisation_id
        );
        await addProjectParticipant(
          project.id,
          newUser.id,
          'student',
          student.maxAttempts || 1
        );
      } catch (err: any) {
        console.error(`Failed to create student ${student.username}:`, err.message);
      }
    }

    res.status(201).json(project);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /:projectId — Get project by ID. Requires auth. Returns: Project. */
router.get('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    res.json(project);
  } catch (error: any) {
    res.status(404).json({ error: 'Project not found' });
  }
});

/** GET /teacher/projects — Get all projects created by the authenticated teacher. Requires auth. Returns: Project[]. */
router.get('/teacher/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getProjectsByTeacher(req.userId!);
    res.json(projects);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /student/projects — Get all projects the authenticated student is a participant of. Requires auth. Returns: Project[]. */
router.get('/student/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getStudentProjects(req.userId!);
    res.json(projects);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** PUT /:projectId — Update project metadata. Only the creator may update. Requires auth. Body: partial Project fields. Returns: Project. */
router.put('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);

    // Check authorization - only creator or admins can update
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Unauthorized to update this project' });
    }

    const updated = await updateProject(req.params.projectId as string, req.body);
    res.json(updated);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** DELETE /:projectId — Delete a project. Only the creator may delete. Requires auth. Returns: { message }. */
router.delete('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);

    // Check authorization
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Unauthorized to delete this project' });
    }

    await deleteProject(req.params.projectId as string);
    res.json({ message: 'Project deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** POST /:projectId/participants — Add a participant (student/teacher) to a project. Only the creator may add. Requires auth. Body: { userId, role, maxAttempts? }. Returns: Participant. */
router.post('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, role, maxAttempts } = req.body;
    const project = await getProjectById(req.params.projectId as string);

    // Check authorization
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can add participants' });
    }

    const participant = await addProjectParticipant(req.params.projectId as string, userId, role, maxAttempts);
    res.status(201).json(participant);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /:projectId/participants — List all participants of a project. Requires auth. Returns: Participant[]. */
router.get('/:projectId/participants/with-usernames', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipantsWithUsernames(req.params.projectId as string);
    res.json(participants);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** GET /:projectId/participants — List all participants of a project. Requires auth. Returns: Participant[]. */
router.get('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipants(req.params.projectId as string);
    res.json(participants);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

/** DELETE /:projectId/participants/:userId — Remove a participant from a project. Only the creator may remove. Requires auth. Returns: { message }. */
router.delete(
  '/:projectId/participants/:userId',
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const project = await getProjectById(req.params.projectId as string);

      // Check authorization
      if (project.created_by !== req.userId!) {
        return res.status(403).json({ error: 'Only project creator can remove participants' });
      }

      await removeProjectParticipant(req.params.projectId as string, req.params.userId as string);
      res.json({ message: 'Participant removed' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

export default router;
