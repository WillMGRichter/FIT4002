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
      const inputCells: { ref: string; value: any; title: string | null }[] = [];
      const outputCells: { ref: string; value: any; formula: string; title: string | null; dependencies: Record<string, number> }[] = [];

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

      // First pass: read all cells
      for (const cellAddress in firstSheet) {
        if (cellAddress[0] === '!' || cellAddress.startsWith('!')) continue;
        const cell = firstSheet[cellAddress];
        cells[cellAddress] = {
          value: cell.v !== undefined ? cell.v : null,
          formula: cell.f || null,
          type: cell.t || null,
        };
      }

      const colToIndex = (col: string): number => {
        let index = 0;
        for (let i = 0; i < col.length; i++) {
          index = index * 26 + col.charCodeAt(i) - 64;
        }
        return index;
      };

      const indexToCol = (index: number): string => {
        let col = '';
        while (index > 0) {
          const remainder = (index - 1) % 26;
          col = String.fromCharCode(65 + remainder) + col;
          index = Math.floor((index - 1) / 26);
        }
        return col;
      };

      const prevCol = (col: string): string | null => {
        const colIdx = colToIndex(col);
        if (colIdx <= 1) return null;
        return indexToCol(colIdx - 1);
      };

      // Find title by checking left cell then above cell for text labels
      const findTitle = (ref: string): string | null => {
        const match = ref.match(/^([A-Z]+)(\d+)$/);
        if (!match) return null;
        const col = match[1];
        const row = parseInt(match[2], 10);

        // Check cell to the left (label column)
        const leftCol = prevCol(col);
        if (leftCol) {
          const leftRef = `${leftCol}${row}`;
          const leftCell = cells[leftRef];
          if (leftCell && (leftCell.type === 's' || typeof leftCell.value === 'string') && leftCell.value !== null && leftCell.value !== undefined) {
            return String(leftCell.value);
          }
        }

        // Check cell above (header row)
        if (row > 1) {
          const aboveRef = `${col}${row - 1}`;
          const aboveCell = cells[aboveRef];
          if (aboveCell && (aboveCell.type === 's' || typeof aboveCell.value === 'string') && aboveCell.value !== null && aboveCell.value !== undefined) {
            return String(aboveCell.value);
          }
        }

        return null;
      };

      // Extract cell references and their coefficients from a formula (cell.f — no leading '=')
      const extractDependencies = (formula: string): Record<string, number> => {
        const deps: Record<string, number> = {};
        if (!formula) return deps;
        let expr = formula;

        // Expand range functions: SUM(A1:A5) -> A1+A2+A3+A4+A5
        expr = expr.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT|PRODUCT)\(([^)]+)\)/gi, (_m: string, _func: string, range: string) => {
          if (range.includes(':')) {
            const parts = range.split(':');
            if (parts.length === 2) {
              const s = parts[0].match(/^([A-Z]+)(\d+)$/i);
              const e = parts[1].match(/^([A-Z]+)(\d+)$/i);
              if (s && e) {
                const startCol = colToIndex(s[1].toUpperCase());
                const startRow = parseInt(s[2], 10);
                const endCol = colToIndex(e[1].toUpperCase());
                const endRow = parseInt(e[2], 10);
                const expanded: string[] = [];
                for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
                  for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
                    expanded.push(`${indexToCol(c)}${r}`);
                  }
                }
                return expanded.join('+');
              }
            }
          }
          return range;
        });

        // Tokenize by + and - to analyze each term
        const terms = expr.split(/(?=[+-])/);
        for (const term of terms) {
          const trimmed = term.replace(/^[+-]/, '').trim();
          if (!trimmed) continue;

          // number*CELL
          const coeffFirst = trimmed.match(/^(\d+(?:\.\d+)?)\s*\*\s*\$?([A-Z]+)\$?(\d+)$/i);
          if (coeffFirst) {
            const ref = `${coeffFirst[2].toUpperCase()}${coeffFirst[3]}`;
            deps[ref] = (deps[ref] || 0) + parseFloat(coeffFirst[1]);
            continue;
          }

          // CELL*number
          const coeffLast = trimmed.match(/^\$?([A-Z]+)\$?(\d+)\s*\*\s*(\d+(?:\.\d+)?)$/i);
          if (coeffLast) {
            const ref = `${coeffLast[1].toUpperCase()}${coeffLast[2]}`;
            deps[ref] = (deps[ref] || 0) + parseFloat(coeffLast[3]);
            continue;
          }

          // CELL/number
          const divRef = trimmed.match(/^\$?([A-Z]+)\$?(\d+)\s*\/\s*(\d+(?:\.\d+)?)$/i);
          if (divRef) {
            const ref = `${divRef[1].toUpperCase()}${divRef[2]}`;
            deps[ref] = (deps[ref] || 0) + (1 / parseFloat(divRef[3]));
            continue;
          }

          // Plain cell ref
          const plainRef = trimmed.match(/^\$?([A-Z]+)\$?(\d+)$/i);
          if (plainRef) {
            const ref = `${plainRef[1].toUpperCase()}${plainRef[2]}`;
            deps[ref] = (deps[ref] || 0) + 1;
            continue;
          }

          // Fallback: extract any cell refs in complex expressions
          const refs = trimmed.match(/\$?[A-Z]+\$?\d+/gi) || [];
          for (const r of refs) {
            const cleaned = r.replace(/\$/g, '').toUpperCase();
            deps[cleaned] = (deps[cleaned] || 0) + 1;
          }
        }

        return deps;
      };

      // Second pass: classify into output (has formula) and input (no formula)
      for (const [ref, cell] of Object.entries<any>(cells)) {
        const refMatch = ref.match(/^([A-Z]+)(\d+)$/);
        if (!refMatch) continue;

        if (cell.formula) {
          outputCells.push({
            ref,
            value: cell.value,
            formula: '=' + cell.formula,
            title: findTitle(ref),
            dependencies: extractDependencies(cell.formula),
          });
        } else if (typeof cell.value === 'number' || (cell.type === 'n' || cell.type === 's') && cell.value !== null) {
          inputCells.push({
            ref,
            value: cell.value,
            title: findTitle(ref),
          });
        }
      }

      // Only keep input cells that are referenced by at least one output formula
      const referencedCells = new Set<string>();
      for (const oc of outputCells) {
        for (const ref of Object.keys(oc.dependencies)) {
          referencedCells.add(ref);
        }
      }
      const relevantInputCells = inputCells.filter(ic => referencedCells.has(ic.ref));

      // Build minimal cells map (only inputs referenced by formulas + outputs)
      const filteredCells: Record<string, any> = {};
      for (const ic of relevantInputCells) {
        filteredCells[ic.ref] = { value: ic.value, formula: null, type: typeof ic.value === 'number' ? 'n' : 's' };
      }
      for (const oc of outputCells) {
        filteredCells[oc.ref] = { value: oc.value, formula: oc.formula, type: 'n' };
      }

      excelData = { cells: filteredCells, sheets: workbook.SheetNames, inputCells: relevantInputCells, outputCells };
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
