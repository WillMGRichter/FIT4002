import { Router, Response } from 'express';
import { AuthRequest, authMiddleware } from '../middleware/authMiddleware';
import {
  getPagesByProject,
  getPageById,
  createPage,
  updatePage,
  deletePage,
  reorderPages,
} from '../services/pageService';
import { getProjectById } from '../services/projectService';

const router = Router();

router.get('/:projectId/pages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const pages = await getPagesByProject(req.params.projectId as string);
    res.json(pages);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:projectId/pages/:pageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = await getPageById(req.params.pageId as string);
    res.json(page);
  } catch (error: any) {
    res.status(404).json({ error: 'Page not found' });
  }
});

router.post('/:projectId/pages', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can add pages' });
    }

    const { name, sortOrder } = req.body;
    const page = await createPage(req.params.projectId as string, name || 'Untitled', sortOrder ?? 0);
    res.status(201).json(page);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:projectId/pages/:pageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can update pages' });
    }

    const page = await updatePage(req.params.pageId as string, req.body);
    res.json(page);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.delete('/:projectId/pages/:pageId', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can delete pages' });
    }

    await deletePage(req.params.pageId as string);
    res.json({ message: 'Page deleted' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:projectId/pages/reorder', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const project = await getProjectById(req.params.projectId as string);
    if (project.created_by !== req.userId!) {
      return res.status(403).json({ error: 'Only project creator can reorder pages' });
    }

    await reorderPages(req.params.projectId as string, req.body.pageIds);
    res.json({ message: 'Pages reordered' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
