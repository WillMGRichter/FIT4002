import { Router, Response } from 'express';
import { createExcelUpload } from '../config/upload';
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
import { getErrorMessage } from '../utils/errors';

/** One student row as sent by the create-project form (all fields optional: it is user input). */
interface StudentInput {
  username?: string;
  password?: string;
  maxAttempts?: number;
}

const router = Router();
const upload = createExcelUpload();

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

    // Create student accounts and add as participants. Collect per-student
    // outcomes so the client can tell the teacher which rows failed (e.g. a
    // duplicate username) instead of failing silently.
    let students: StudentInput[] = [];
    try {
      students = JSON.parse(req.body.students || '[]');
    } catch { /* ignore parse errors */ }

    const studentResults: { username: string; ok: boolean; error?: string }[] = [];
    const seenUsernames = new Set<string>();

    for (const student of students) {
      const username = (student.username || '').trim();
      if (!username) continue;

      // Reject duplicate usernames within the same submission up front, so the
      // teacher gets a clear message rather than a confusing DB error.
      const key = username.toLowerCase();
      if (seenUsernames.has(key)) {
        studentResults.push({ username, ok: false, error: 'Duplicate username in this list' });
        continue;
      }
      seenUsernames.add(key);

      try {
        const { user: newUser } = await registerUser(
          username,
          student.password || 'password123',
          'student',
          user.organisation_id,
          project.id
        );
        await addProjectParticipant(
          project.id,
          newUser.id,
          'student',
          student.maxAttempts || 1
        );
        studentResults.push({ username, ok: true });
      } catch (err: unknown) {
        console.error(`Failed to create student ${username}:`, getErrorMessage(err));
        studentResults.push({ username, ok: false, error: getErrorMessage(err, 'Could not create student') });
      }
    }

    res.status(201).json({ ...project, studentResults });
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** GET /:projectId — Get project by ID. Requires auth. Returns: Project. */
router.get('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    res.json(project);
  } catch {
    res.status(404).json({ error: 'Project not found' });
  }
});

/** GET /teacher/projects — Get all projects created by the authenticated teacher. Requires auth. Returns: Project[]. */
router.get('/teacher/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getProjectsByTeacher(req.userId!);
    res.json(projects);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** GET /student/projects — Get all projects the authenticated student is a participant of. Requires auth. Returns: Project[]. */
router.get('/student/projects', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await getStudentProjects(req.userId!);
    res.json(projects);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
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
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/**
 * POST /:projectId/students — Create a project-scoped student account AND enrol
 * it in the project in one step. Only the creator may add. Requires auth.
 * Body: { username, password?, maxAttempts? }. Returns the created participant.
 *
 * This mirrors the student-creation logic in POST / (project create) so students
 * added later via the edit screen are also project-scoped (users.project_id set)
 * and can log in through the project-scoped student login. Using the generic
 * /auth/signup here would create a global (project_id = NULL) account that the
 * student login cannot resolve.
 */
router.post('/:projectId/students', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.projectId as string;
    const { username: rawUsername, password, maxAttempts } = req.body;
    const username = (rawUsername || '').trim();

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const project = await getProjectById(projectId);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can add students' });
    }

    const creator = await getUserById(req.userId!);

    const { user: newUser } = await registerUser(
      username,
      password || 'password123',
      'student',
      creator.organisation_id,
      projectId
    );
    const participant = await addProjectParticipant(projectId, newUser.id, 'student', maxAttempts || 1);

    res.status(201).json({ participant, user: { id: newUser.id, username: newUser.username } });
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** GET /:projectId/participants — List all participants of a project. Requires auth. Returns: Participant[]. */
router.get('/:projectId/participants/with-usernames', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipantsWithUsernames(req.params.projectId as string);
    res.json(participants);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
  }
});

/** GET /:projectId/participants — List all participants of a project. Requires auth. Returns: Participant[]. */
router.get('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipants(req.params.projectId as string);
    res.json(participants);
  } catch (error: unknown) {
    res.status(400).json({ error: getErrorMessage(error) });
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
    } catch (error: unknown) {
      res.status(400).json({ error: getErrorMessage(error) });
    }
  }
);

export default router;
