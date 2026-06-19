import { Router, Response } from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
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
import { getUserById, registerUser } from '../services/authService';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Create a new project (multipart: file + fields)
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
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const cells: Record<string, any> = {};

      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        for (const cellAddress in sheet) {
          if (cellAddress[0] === '!' || cellAddress.startsWith('!')) continue;
          const cell = sheet[cellAddress];
          cells[cellAddress] = {
            value: cell.v !== undefined ? cell.v : null,
            formula: cell.f || null,
            type: cell.t || null,
          };
        }
      });

      excelData = { cells, sheets: workbook.SheetNames };
    }

    const project = await createProject(name, userId, user.organisation_id, description, excelData);

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

// Get project by ID
router.get('/:projectId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
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

// Delete project
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

// Add participant to project
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

// Get project participants
router.get('/:projectId/participants', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const participants = await getProjectParticipants(req.params.projectId as string);
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
