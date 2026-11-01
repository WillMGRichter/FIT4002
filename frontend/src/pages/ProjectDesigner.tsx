import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Table } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent } from '../utils/projectStorage';
import styles from './ProjectDesigner.module.css';
import type { ElementProps, SimulationProject } from '../types/simulation';
import type { CanvasElement, ElementType, Page, ServerPage } from './projectDesigner/types';
import { ELEMENT_PALETTE, newElemId } from './projectDesigner/elementPalette';
import { CanvasElementView } from './projectDesigner/CanvasElementView';
import { getInputCells, getOutputCells, getTrackedCells } from './projectDesigner/designerCells';
import { PageSidebar } from './projectDesigner/PageSidebar';
import { PropertiesPanel } from './projectDesigner/PropertiesPanel';
import { ExcelPreviewModal } from './projectDesigner/ExcelPreviewModal';

export const ProjectDesigner: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<SimulationProject | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [selectedElemId, setSelectedElemId] = useState<string | null>(null);
  // offsetX/Y is the grab point expressed relative to the element's own top-left corner, in
  // canvas *content* coordinates (scrollLeft/Top + pointer-in-viewport) rather than raw client
  // pixels - that makes position purely a function of (current scroll, current pointer), so
  // programmatic auto-scroll during a drag (see the edge-pan effect below) moves the element
  // along with the pan for free, with no separate delta bookkeeping needed.
  //
  // NOTE: drag/resize gesture info lives in REFS, not React state. The gesture is started from
  // the mousedown handler which attaches the window mousemove/mouseup listeners synchronously.
  // Driving this through useState instead caused a bug where the first movements were dropped:
  // the listener was only attached by a useEffect that ran *after* a re-render, so the element
  // "didn't move at first, then jumped" once the render finally committed. Using refs means the
  // drag is live on the very next mousemove with no render in between.
  const draggingRef = useRef<{ elemId: string; offsetX: number; offsetY: number; baseX: number; baseY: number } | null>(null);
  const resizingRef = useRef<{ elemId: string; elemX: number; elemY: number; offsetW: number; offsetH: number } | null>(null);
  // Bumped on gesture start/end only, to drive the edge-pan rAF effect (which does need to
  // start/stop with the gesture). Not used for per-frame updates.
  const [gestureActive, setGestureActive] = useState(false);
  const mousePosRef = useRef({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

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

  const activePage = pages[activePageIdx];
  const activeElements = activePage?.elements || [];

  // Input / output cells of the uploaded spreadsheet (sorted by reference) and the combined list
  // shown in the "Preview Excel" table. See projectDesigner/designerCells.ts.
  const inputCells = React.useMemo(() => getInputCells(project?.excel_data), [project]);
  const outputCells = React.useMemo(() => getOutputCells(project?.excel_data), [project]);
  const allTrackedCells = React.useMemo(() => getTrackedCells(inputCells, outputCells), [inputCells, outputCells]);

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

  const addElement = (type: ElementType) => {
    if (!activePage) return;
    const paletteItem = ELEMENT_PALETTE.find(e => e.type === type);
    const newElem: CanvasElement = {
      id: newElemId(),
      type,
      x: 40 + (activeElements.length * 20),
      y: 40 + (activeElements.length * 20),
      w: type === 'text' ? 200 : type === 'image' ? 300 : 220,
      h: type === 'image' ? 180 : (type === 'input-field' || type === 'output-field') ? 64 : 48,
      props: { ...(paletteItem?.defaultProps || {}) },
    };
    const newElements = [...activeElements, newElem];
    updateActivePageElements(newElements);
    setSelectedElemId(newElem.id);
  };

  const updateActivePageElements = useCallback((elements: CanvasElement[]) => {
    setPages(prev => prev.map((p, i) => i === activePageIdx ? { ...p, elements } : p));
  }, [activePageIdx]);

  const updateElementProps = useCallback((elemId: string, props: Partial<ElementProps>) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, props: { ...e.props, ...props } } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx]);

  const updateElementPosition = useCallback((elemId: string, x: number, y: number) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, x, y } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx]);

  const updateElementSize = useCallback((elemId: string, w: number, h: number) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e => e.id === elemId ? { ...e, w: Math.max(40, w), h: Math.max(24, h) } : e);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx]);

  const deleteElement = useCallback((elemId: string) => {
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.filter(e => e.id !== elemId);
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
    setSelectedElemId(null);
  }, [activePageIdx]);

  // Reads a picked image file, downscales it on a canvas (max 1280px) and stores the result
  // as a compressed data URL in the element's src so it persists with the page's JSONB.
  const handleImageUpload = (file: File) => {
    if (!selectedElem || selectedElem.type !== 'image') return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement('img');
      img.onload = () => {
        const MAX = 1280;
        let width = img.width;
        let height = img.height;
        if (width > MAX || height > MAX) {
          const scale = Math.min(MAX / width, MAX / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        updateElementProps(selectedElem.id, { src: canvas.toDataURL('image/jpeg', 0.85) });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.canvasElem}`)) return;
    setSelectedElemId(null);
  };

  // Content-space position under the pointer: scroll offset + pointer's offset within the
  // canvas viewport. Unlike raw clientX/Y, this stays correct across programmatic scrolling.
  const contentPointFromClient = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: clientX, y: clientY };
    const rect = canvas.getBoundingClientRect();
    return { x: canvas.scrollLeft + (clientX - rect.left), y: canvas.scrollTop + (clientY - rect.top) };
  };

  // During a drag/resize we mutate the element's DOM style directly instead of calling
  // setState on every mousemove. That avoids re-rendering React 60x/sec (which was slow for
  // image elements with large base64 srcs). The latest geometry is stashed here and committed
  // to React state once, on mouseup.
  const pendingGeomRef = useRef<{ elemId: string; x: number; y: number; w: number; h: number } | null>(null);

  const findElemNode = useCallback((elemId: string): HTMLElement | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.querySelector(`[data-elem-id="${elemId}"]`) as HTMLElement | null;
  }, []);

  const updateDragFromClient = useCallback((clientX: number, clientY: number) => {
    const current = draggingRef.current;
    if (!current) return;
    const point = contentPointFromClient(clientX, clientY);
    const x = Math.max(0, point.x - current.offsetX);
    const y = Math.max(0, point.y - current.offsetY);
    const node = findElemNode(current.elemId);
    if (node) {
      // Move via GPU-composited transform rather than left/top so the browser skips layout on
      // every frame - this is what removes the stutter. The real left/top is committed on drop.
      node.style.transform = `translate(${x - current.baseX}px, ${y - current.baseY}px)`;
      node.style.willChange = 'transform';
      pendingGeomRef.current = { elemId: current.elemId, x, y, w: node.offsetWidth, h: node.offsetHeight };
    }
  }, [findElemNode]);

  const updateResizeFromClient = useCallback((clientX: number, clientY: number) => {
    const current = resizingRef.current;
    if (!current) return;
    const point = contentPointFromClient(clientX, clientY);
    const w = Math.max(40, point.x - current.elemX + current.offsetW);
    const h = Math.max(24, point.y - current.elemY + current.offsetH);
    const node = findElemNode(current.elemId);
    if (node) {
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      pendingGeomRef.current = { elemId: current.elemId, x: current.elemX, y: current.elemY, w, h };
    }
  }, [findElemNode]);

  // Commit the DOM-only drag/resize geometry back into React state. Called once on mouseup.
  const commitPendingGeom = useCallback(() => {
    const geom = pendingGeomRef.current;
    pendingGeomRef.current = null;
    if (!geom) return;
    // Clear the temporary drag transform so the committed left/top (applied on the next render)
    // isn't stacked on top of a leftover translate. React will set left/top to geom.x/geom.y.
    const node = findElemNode(geom.elemId);
    if (node) {
      node.style.transform = '';
      node.style.willChange = '';
      node.style.left = `${geom.x}px`;
      node.style.top = `${geom.y}px`;
    }
    setPages(prev => {
      const page = prev[activePageIdx];
      if (!page) return prev;
      const newElements = page.elements.map(e =>
        e.id === geom.elemId ? { ...e, x: geom.x, y: geom.y, w: geom.w, h: geom.h } : e
      );
      return prev.map((p, i) => i === activePageIdx ? { ...p, elements: newElements } : p);
    });
  }, [activePageIdx, findElemNode]);

  // Ends whichever gesture is active: commits geometry, clears the gesture refs, removes the
  // window listeners and stops the edge-pan loop. Stored in a ref so the listeners (attached
  // synchronously on mousedown) can always reference the current teardown.
  const endGestureRef = useRef<() => void>(() => {});

  // Starts a drag or resize. Listeners are attached HERE, synchronously, so the very next
  // mousemove drives the element - no waiting for a React re-render/effect (that delay was the
  // "doesn't move at first, then jumps" bug). No React state changes per frame; only DOM writes.
  const beginGesture = useCallback(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      if (draggingRef.current) updateDragFromClient(e.clientX, e.clientY);
      else if (resizingRef.current) updateResizeFromClient(e.clientX, e.clientY);
    };
    const handleMouseUp = () => endGestureRef.current();

    endGestureRef.current = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      commitPendingGeom();
      draggingRef.current = null;
      resizingRef.current = null;
      setGestureActive(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    setGestureActive(true); // only to (re)start the edge-pan rAF effect
  }, [updateDragFromClient, updateResizeFromClient, commitPendingGeom]);

  const handleElemMouseDown = useCallback((e: React.MouseEvent, elem: CanvasElement) => {
    if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`)) return;
    e.stopPropagation();
    e.preventDefault(); // avoid native image drag-ghost / text selection stealing the gesture
    setSelectedElemId(elem.id);
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    const point = contentPointFromClient(e.clientX, e.clientY);
    resizingRef.current = null;
    draggingRef.current = { elemId: elem.id, offsetX: point.x - elem.x, offsetY: point.y - elem.y, baseX: elem.x, baseY: elem.y };
    beginGesture();
  }, [beginGesture]);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, elem: CanvasElement) => {
    e.stopPropagation();
    e.preventDefault();
    mousePosRef.current = { x: e.clientX, y: e.clientY };
    const point = contentPointFromClient(e.clientX, e.clientY);
    draggingRef.current = null;
    resizingRef.current = { elemId: elem.id, elemX: elem.x, elemY: elem.y, offsetW: elem.w - (point.x - elem.x), offsetH: elem.h - (point.y - elem.y) };
    beginGesture();
  }, [beginGesture]);

  // Clean up listeners if the component unmounts mid-gesture.
  useEffect(() => () => endGestureRef.current(), []);

  // Delete/Backspace deletes the selected canvas element - skipped while focus is in a text
  // field (Label, Cell range, etc. in the properties panel), so editing text can still use
  // those keys normally instead of deleting the whole element out from under the user.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedElemId) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement;
      const isEditableTarget = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;
      if (isEditableTarget) return;
      e.preventDefault();
      deleteElement(selectedElemId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElemId, deleteElement]);

  // Edge auto-pan: while dragging/resizing, holding the pointer near the canvas viewport's
  // border scrolls the canvas toward that border every frame, even without further pointer
  // movement. Position/size are re-derived from (scroll, last known pointer) each tick, so the
  // element keeps growing outward with the pan instead of getting left behind.
  useEffect(() => {
    if (!gestureActive) return;
    const EDGE = 60; // px from viewport edge where panning starts
    const MAX_SPEED = 11; // px scrolled per frame at/past the edge

    const edgePanDelta = (pos: number, min: number, max: number) => {
      if (pos > max - EDGE) return Math.min(MAX_SPEED, ((pos - (max - EDGE)) / EDGE) * MAX_SPEED);
      if (pos < min + EDGE) return -Math.min(MAX_SPEED, (((min + EDGE) - pos) / EDGE) * MAX_SPEED);
      return 0;
    };

    let rafId: number;
    const tick = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const { x: mx, y: my } = mousePosRef.current;
        const dx = edgePanDelta(mx, rect.left, rect.right);
        const dy = edgePanDelta(my, rect.top, rect.bottom);
        if (dx !== 0 || dy !== 0) {
          canvas.scrollLeft += dx;
          canvas.scrollTop += dy;
          if (draggingRef.current) updateDragFromClient(mx, my);
          if (resizingRef.current) updateResizeFromClient(mx, my);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [gestureActive, updateDragFromClient, updateResizeFromClient]);

  const selectedElem = activeElements.find(e => e.id === selectedElemId);

  if (loading) {
    return <AppShell title="Project Designer"><div className={styles.loading}>Loading...</div></AppShell>;
  }

  return (
    <AppShell title={project?.name || 'Designer'} activeItem="create" showBack>
      <div className={styles.designer}>
        {/* ── Left: Page sidebar ── */}
        <PageSidebar
          pages={pages}
          activePageIdx={activePageIdx}
          open={pagesOpen}
          onToggle={() => setPagesOpen(v => !v)}
          onSelectPage={idx => { setActivePageIdx(idx); setSelectedElemId(null); }}
          onRenamePage={(idx, name) => {
            const newPages = [...pages];
            newPages[idx] = { ...newPages[idx], name };
            setPages(newPages);
          }}
          onDeletePage={deletePage}
          onAddPage={addPage}
        />

        {/* ── Center: Canvas ── */}
        <div className={styles.centerCol}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarGroup}>
              {ELEMENT_PALETTE.map(item => (
                <button key={item.type} className={styles.toolBtn} onClick={() => addElement(item.type)} title={item.label}>
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className={styles.toolbarGroup}>
              <div className={styles.toolbarDivider} />
              <button className={`${styles.actionBtn} ${styles.saveBtn}`} onClick={savePages} disabled={saving} title="Save"><Save size={16} /> {saving ? 'Saving...' : 'Save'}</button>
              <button className={`${styles.actionBtn} ${styles.previewBtn}`} onClick={() => setShowExcelPreview(true)} title="Preview Excel"><Table size={16} /> Preview Excel</button>
              <button className={`${styles.actionBtn} ${styles.previewBtn}`} onClick={async () => { await savePages(); navigate(`/projects/${projectId}/play`, { state: { preview: true } }); }} title="Preview Student View"><Eye size={16} /> Preview Student View</button>
            </div>
          </div>

          <div
            ref={canvasRef}
            className={styles.canvas}
            onMouseDown={handleCanvasMouseDown}
          >
            {activeElements.map(elem => (
              <CanvasElementView
                key={elem.id}
                elem={elem}
                selected={selectedElemId === elem.id}
                onElemMouseDown={handleElemMouseDown}
                onResizeMouseDown={handleResizeMouseDown}
              />
            ))}
          </div>
        </div>

        {/* ── Right: Properties panel ── */}
        <PropertiesPanel
          open={propsOpen}
          onToggle={() => setPropsOpen(v => !v)}
          selectedElem={selectedElem}
          inputCells={inputCells}
          outputCells={outputCells}
          updateElementProps={updateElementProps}
          updateElementPosition={updateElementPosition}
          updateElementSize={updateElementSize}
          deleteElement={deleteElement}
          onImageUpload={handleImageUpload}
        />
      </div>

      {/* The section that shows preview of excel sheet values */}
      {showExcelPreview && (
        <ExcelPreviewModal project={project} cells={allTrackedCells} onClose={() => setShowExcelPreview(false)} />
      )}
    </AppShell>
  );
};
