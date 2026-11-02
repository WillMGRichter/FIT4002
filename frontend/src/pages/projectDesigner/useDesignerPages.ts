import { useCallback, useEffect, useState } from 'react';
import { API_URL } from '../../config';
import { addRecent } from '../../utils/projectStorage';
import type { SimulationProject } from '../../types/simulation';
import type { Page, ServerPage } from './types';

/**
 * Loads a project and its pages, and owns the page list: which page is active, saving all pages
 * to the server (creating unsaved "temp_" pages first), and adding / deleting pages.
 */
export function useDesignerPages({ projectId, token }: { projectId: string | undefined; token: string | null }) {
  const [project, setProject] = useState<SimulationProject | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId || !token) return;
    fetch(`${API_URL}/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        setProject(data);
        addRecent({ id: projectId!, name: data.name });
        return fetch(`${API_URL}/projects/${projectId}/pages`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })
      .then(r => r.json())
      .then(data => {
        if (data.length === 0) {
          setPages([{ id: 'temp_1', name: 'Page 1', sort_order: 0, elements: [] }]);
        } else {
          setPages(data.map((p: ServerPage) => ({ ...p, elements: p.elements || [] })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, token]);

  const [saving, setSaving] = useState(false);

  // Persist all pages to the server. Pages with temp IDs are created first via POST, then updated with elements.
  const savePages = useCallback(async () => {
    if (!projectId || !token) return;
    setSaving(true);
    const updatedPages = [...pages];
    for (let i = 0; i < updatedPages.length; i++) {
      const page = updatedPages[i];
      if (page.id.startsWith('temp_')) {
        const res = await fetch(`${API_URL}/projects/${projectId}/pages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: page.name, sortOrder: i }),
        });
        const created = await res.json();
        updatedPages[i] = { ...created, elements: page.elements };
        await fetch(`${API_URL}/projects/${projectId}/pages/${created.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ elements: page.elements }),
        });
      } else {
        await fetch(`${API_URL}/projects/${projectId}/pages/${page.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ elements: page.elements, name: page.name }),
        });
      }
    }
    setPages(updatedPages);
    setSaving(false);
  }, [pages, projectId, token]);

  const addPage = async () => {
    if (!projectId || !token) {
      setPages(prev => [...prev, { id: `temp_${Date.now()}`, name: `Page ${prev.length + 1}`, sort_order: prev.length, elements: [] }]);
      setActivePageIdx(pages.length);
      return;
    }
    const res = await fetch(`${API_URL}/projects/${projectId}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: `Page ${pages.length + 1}`, sortOrder: pages.length }),
    });
    const newPage = await res.json();
    setPages(prev => [...prev, { ...newPage, elements: [] }]);
    setActivePageIdx(pages.length);
  };

  const deletePage = async (idx: number) => {
    const page = pages[idx];
    if (pages.length <= 1) return;
    if (!page.id.startsWith('temp_') && token && projectId) {
      await fetch(`${API_URL}/projects/${projectId}/pages/${page.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
    const newPages = pages.filter((_, i) => i !== idx);
    setPages(newPages);
    setActivePageIdx(Math.min(idx, newPages.length - 1));
  };

  return { project, pages, setPages, activePageIdx, setActivePageIdx, loading, saving, savePages, addPage, deletePage };
}
