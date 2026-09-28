import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Plus, Eye, Save, GripVertical, Type, Image, RectangleHorizontal, ChartBar, Table, X, ChevronLeft, ChevronRight, Upload } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent } from '../utils/projectStorage';
import { expandRange } from '../utils/FormulaEngine';
import { getColumns, getRows } from '../utils/tableUtils';
import styles from './ProjectDesigner.module.css';

type ElementType = 'text' | 'input-field' | 'output-field' | 'image';

// Matches PIE_COLORS in StudentSimulationView.tsx, so this canvas preview's slice colors
// line up with what the actual student-facing pie chart will render.
const PIE_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#34d399'];

interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  props: Record<string, any>;
}

interface Page {
  id: string;
  name: string;
  sort_order: number;
  elements: CanvasElement[];
}

const newElemId = () => `elem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const ELEMENT_PALETTE: { type: ElementType; label: string; icon: React.ReactNode; defaultProps: Record<string, any> }[] = [
  { type: 'text', label: 'Text', icon: <Type size={20} />, defaultProps: { content: 'Text', fontSize: 16, color: '#111827', bold: false } },
  { type: 'input-field', label: 'Input', icon: <RectangleHorizontal size={20} />, defaultProps: { cellRef: '', label: 'Input', placeholder: 'Enter value...' } },
  { type: 'output-field', label: 'Output', icon: <ChartBar size={20} />, defaultProps: { cellRef: '', cellRange: '', tableRowHeader: '', tableRows: ['Row 1'], tableColumns: [{ header: 'Column 1', range: '' }], label: 'Output', format: 'number', chartTitle: '', xAxisTitle: '', yAxisTitle: '' } },
  { type: 'image', label: 'Image', icon: <Image size={20} />, defaultProps: { src: 'https://placehold.co/400x200?text=Image', alt: '' } },
];

// Renders a single canvas element. Memoized so that dragging/resizing ONE element
// (which updates only that element's x/y/w/h in state) does not re-render every other
// element. This matters most for image elements, whose src is a large base64 data URL:
// re-rendering all of them on every mousemove made dragging very laggy.
interface CanvasElementViewProps {
  elem: CanvasElement;
  selected: boolean;
  onElemMouseDown: (e: React.MouseEvent, elem: CanvasElement) => void;
  onResizeMouseDown: (e: React.MouseEvent, elem: CanvasElement) => void;
}

const CanvasElementView = React.memo<CanvasElementViewProps>(({ elem, selected, onElemMouseDown, onResizeMouseDown }) => {
  return (
    <div
      className={`${styles.canvasElem} ${selected ? styles.canvasElemSelected : ''}`}
      data-elem-id={elem.id}
      style={{ left: elem.x, top: elem.y, width: elem.w, height: elem.h }}
      onMouseDown={e => onElemMouseDown(e, elem)}
    >
      {elem.type === 'text' && (
        <div className={styles.elemText} style={{ fontSize: elem.props.fontSize, color: elem.props.color, fontWeight: elem.props.bold ? 700 : 400 }}>
          {elem.props.content}
        </div>
      )}
      {elem.type === 'input-field' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          {elem.props.format === 'range' && (
            <div>
            <input className={styles.fieldBox} type='range' readOnly disabled></input>
            <span className={styles.sliderValue}>{elem.props.min ?? 0} - {elem.props.max ?? 10}</span>
            </div>
          )}
          {elem.props.format === 'dropdown' && (
            <div className={styles.fieldBox}>
              <span className={styles.fieldPlaceholder}>{elem.props.placeholder || 'Choose...'} ({elem.props.cellRef || 'no cell'})</span>
            </div>
          )}
          {elem.props.format !== 'range' && elem.props.format !== 'dropdown' && (
            <div className={styles.fieldBox}>
            <span className={styles.fieldPlaceholder}>{elem.props.placeholder} ({elem.props.cellRef || 'no cell'})</span>
          </div>
          )}
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'bar-chart' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.barChartPreview}>
            <div className={styles.barChartPreviewBar} style={{ height: '40%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '65%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '50%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '85%' }} />
            <span className={styles.barChartPreviewLabel}>{elem.props.cellRange || 'no range'}</span>
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'pie-chart' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.pieChartPreview}>
            <div className={styles.pieChartPreviewCircle} />
            <div className={styles.pieChartPreviewLegend}>
              {elem.props.cellRange
                ? expandRange(elem.props.cellRange).map((ref, i) => (
                    <div key={ref} className={styles.pieChartPreviewLegendRow}>
                      <span className={styles.pieChartPreviewSwatch} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className={styles.pieChartPreviewLegendLabel}>Legend {i + 1}</span>
                    </div>
                  ))
                : <span className={styles.barChartPreviewLabel}>no range</span>}
            </div>
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'table' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.tablePreview}>
            <div className={styles.tablePreviewHeader}>
              <span>{elem.props.tableRowHeader || ''}</span>
              {getColumns(elem.props).map((column, i) => <span key={i}>{column.header || `Column ${i + 1}`}</span>)}
            </div>
            {getRows(elem.props).slice(0, 3).map((row: string, i: number) => (
              <div key={`${row}-${i}`} className={styles.tablePreviewRow}>
                <span>{row}</span>
                {getColumns(elem.props).map((_, columnIndex) => <span key={columnIndex}>0</span>)}
              </div>
            ))}
            {!getRows(elem.props).length && <span className={styles.barChartPreviewLabel}>no rows</span>}
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format !== 'bar-chart' && elem.props.format !== 'pie-chart' && elem.props.format !== 'table' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={`${styles.fieldBox} ${styles.fieldOutput}`}>
            <span>{elem.props.cellRef || 'no cell'}</span>
          </div>
        </div>
      )}
      {elem.type === 'image' && (
        <div className={styles.elemImage}>
          <img src={elem.props.src} alt={elem.props.alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div className={styles.resizeHandle} onMouseDown={e => onResizeMouseDown(e, elem)} />
    </div>
  );
});
CanvasElementView.displayName = 'CanvasElementView';

export const ProjectDesigner: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<any>(null);
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
          setPages(data.map((p: any) => ({ ...p, elements: p.elements || [] })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [projectId, token]);

  const activePage = pages[activePageIdx];
  const activeElements = activePage?.elements || [];

  // Collect all non-formula (input) cells from the uploaded spreadsheet, sorted by reference
  const inputCells = React.useMemo(() => {
    if (project?.excel_data?.inputCells) {
      return project.excel_data.inputCells.sort((a: any, b: any) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
    }
    if (!project?.excel_data?.cells) return [];
    return Object.entries(project.excel_data.cells)
      .filter(([_, cell]: [string, any]) => !cell.formula)
      .map(([ref, cell]: [string, any]) => ({ ref, value: cell.value, title: null }))
      .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  }, [project]);

  // Collect all formula (output) cells from the uploaded spreadsheet, sorted by reference
  const outputCells = React.useMemo(() => {
    if (project?.excel_data?.outputCells) {
      return project.excel_data.outputCells.sort((a: any, b: any) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
    }
    if (!project?.excel_data?.cells) return [];
    return Object.entries(project.excel_data.cells)
      .filter(([_, cell]: [string, any]) => !!cell.formula)
      .map(([ref, cell]: [string, any]) => ({ ref, formula: cell.formula, title: null, dependencies: {} }))
      .sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  }, [project]);

  // Combined list of every cell the app currently tracks from the sheet, for the "Preview Excel" table.
  // Note: this only reflects cells the backend kept after upload (output/formula cells, plus input cells
  // referenced by a formula) - unreferenced or label-only cells from the original sheet are not available.
  const allTrackedCells = React.useMemo(() => {
    const rows = [
      ...inputCells.map((c: any) => ({ ref: c.ref, title: c.title, kind: 'Input', display: c.value })),
      ...outputCells.map((c: any) => ({ ref: c.ref, title: c.title, kind: 'Output', display: c.formula })),
    ];
    return rows.sort((a, b) => a.ref.localeCompare(b.ref, undefined, { numeric: true }));
  }, [inputCells, outputCells]);

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

  const updateElementProps = useCallback((elemId: string, props: Record<string, any>) => {
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
        <aside className={`${styles.pageSidebar} ${!pagesOpen ? styles.panelCollapsed : ''}`}>
          <div className={styles.pageSidebarHeader}>
            {pagesOpen && <h3>Pages</h3>}
            <button
              className={styles.panelToggleBtn}
              onClick={() => setPagesOpen(v => !v)}
              title={pagesOpen ? 'Collapse pages' : 'Expand pages'}
            >
              {pagesOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
            </button>
          </div>
          {pagesOpen && (
            <>
              <div className={styles.pageList}>
                {pages.map((page, idx) => (
                  <div
                    key={page.id}
                    className={`${styles.pageItem} ${idx === activePageIdx ? styles.pageItemActive : ''}`}
                    onClick={() => { setActivePageIdx(idx); setSelectedElemId(null); }}
                  >
                    <GripVertical size={14} className={styles.pageDrag} />
                    <input
                      className={styles.pageNameInput}
                      value={page.name}
                      onChange={e => {
                        const newPages = [...pages];
                        newPages[idx] = { ...newPages[idx], name: e.target.value };
                        setPages(newPages);
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                    <button className={styles.pageDeleteBtn} onClick={e => { e.stopPropagation(); deletePage(idx); }} title="Delete page"><Trash2 size={13} /></button>
                  </div>
                ))}
                <button className={styles.addPageBtn} onClick={addPage}><Plus size={14} /> Add Page</button>
              </div>
            </>
          )}
        </aside>

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
        <aside className={`${styles.propsPanel} ${!propsOpen ? styles.panelCollapsed : ''}`}>
          <div className={styles.propsTitleRow}>
            {propsOpen && <h3 className={styles.propsTitle}>Properties</h3>}
            <button
              className={styles.panelToggleBtn}
              onClick={() => setPropsOpen(v => !v)}
              title={propsOpen ? 'Collapse properties' : 'Expand properties'}
            >
              {propsOpen ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>
          {propsOpen && (
            selectedElem ? (
              <div className={styles.propsContent}>
                <div className={styles.propsSection}>
                  <div className={styles.propsSectionTitle}>Position &amp; Size</div>
                  <div className={styles.propRow}>
                    <label>X</label>
                    <input type="number" value={selectedElem.x} onChange={e => updateElementPosition(selectedElem.id, parseInt(e.target.value) || 0, selectedElem.y)} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Y</label>
                    <input type="number" value={selectedElem.y} onChange={e => updateElementPosition(selectedElem.id, selectedElem.x, parseInt(e.target.value) || 0)} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Width</label>
                    <input type="number" value={selectedElem.w} onChange={e => updateElementSize(selectedElem.id, parseInt(e.target.value) || 40, selectedElem.h)} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Height</label>
                    <input type="number" value={selectedElem.h} onChange={e => updateElementSize(selectedElem.id, selectedElem.w, parseInt(e.target.value) || 24)} className={styles.propInput} />
                  </div>
                </div>

              <div className={styles.divider} />

              {selectedElem.type === 'text' && (
                <div className={styles.propsSection}>
                  <div className={styles.propsSectionTitle}>Text</div>
                  <div className={styles.propRow}>
                    <label>Content</label>
                    <input type="text" value={selectedElem.props.content || ''} onChange={e => updateElementProps(selectedElem.id, { content: e.target.value })} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Font size</label>
                    <input type="number" value={selectedElem.props.fontSize || 16} onChange={e => updateElementProps(selectedElem.id, { fontSize: parseInt(e.target.value) || 16 })} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Bold</label>
                    <input type="checkbox" checked={selectedElem.props.bold || false} onChange={e => updateElementProps(selectedElem.id, { bold: e.target.checked })} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Color</label>
                    <input type="color" value={selectedElem.props.color || '#111827'} onChange={e => updateElementProps(selectedElem.id, { color: e.target.value })} className={styles.propInput} />
                  </div>
                </div>
              )}

              {(selectedElem.type === 'input-field' || selectedElem.type === 'output-field') && (
                <div className={styles.propsSection}>
                  <div className={styles.propsSectionTitle}>Cell Binding</div>
                  <div className={styles.propRow}>
                    <label>Label</label>
                    <input type="text" value={selectedElem.props.label || ''} onChange={e => updateElementProps(selectedElem.id, { label: e.target.value })} className={styles.propInput} />
                  </div>
                  {selectedElem.props.format !== 'bar-chart' && selectedElem.props.format !== 'pie-chart' && selectedElem.props.format !== 'table' && (
                    <div className={styles.propRow}>
                      <label>Cell ref</label>
                      <select value={selectedElem.props.cellRef || ''} onChange={e => {
                        const ref = e.target.value;
                        const cell = selectedElem.type === 'input-field'
                          ? inputCells.find((c: any) => c.ref === ref)
                          : outputCells.find((c: any) => c.ref === ref);
                        const updates: Record<string, any> = { cellRef: ref };
                        const isDefaultLabel = selectedElem.props.label === 'Input' || selectedElem.props.label === 'Output';
                        if (cell?.title && isDefaultLabel) updates.label = cell.title;
                        updateElementProps(selectedElem.id, updates);
                      }} className={styles.propInput}>
                        <option value="">-- Select cell --</option>
                        {selectedElem.type === 'input-field' && inputCells.map((c: any) => (
                          <option key={c.ref} value={c.ref}>{c.ref} | {c.title || c.ref}{c.value !== undefined && c.value !== null ? ` | ${c.value}` : ''}</option>
                        ))}
                        {selectedElem.type === 'output-field' && outputCells.map((c: any) => (
                          <option key={c.ref} value={c.ref}>{c.ref} | {c.title || c.ref}{c.formula ? ` | ${c.formula}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedElem.type === 'input-field' && (
                    <>
                      <div className={styles.propRow}>
                        <label>Placeholder</label>
                        <input type="text" value={selectedElem.props.placeholder || ''} onChange={e => updateElementProps(selectedElem.id, { placeholder: e.target.value })} className={styles.propInput} />
                      </div>
                      {/* Specify format of the input type */}
                      <div className={styles.propRow}>
                        <label>Format</label>
                          <select value={selectedElem.props.format || 'number'} onChange={e => updateElementProps(selectedElem.id, { format: e.target.value })} className={styles.propInput}>
                            <option value="number">Number</option>
                            <option value="range">Slider</option>
                            <option value="dropdown">Dropdown</option>
                          </select>
                      </div>
                    </>
                  )}
                  {selectedElem.type === 'output-field' && (
                    <div className={styles.propRow}>
                      <label>Format</label>
                      <select value={selectedElem.props.format || 'number'} onChange={e => updateElementProps(selectedElem.id, { format: e.target.value })} className={styles.propInput}>
                        <option value="number">Number</option>
                        <option value="text">Text</option>
                        <option value="currency">Currency</option>
                        <option value="percentage">Percentage</option>
                        <option value="bar-chart">Bar Chart</option>
                        <option value="pie-chart">Pie Chart</option>
                        <option value="table">Table</option>
                      </select>
                    </div>
                  )}
                  {selectedElem.type === 'output-field' && selectedElem.props.format === 'bar-chart' && (
                    <>
                      <div className={styles.propRow}>
                        <label>Cell range</label>
                        <input
                          type="text"
                          placeholder="e.g. B4:B8 or B1:B3,B5:B7"
                          value={selectedElem.props.cellRange || ''}
                          onChange={e => updateElementProps(selectedElem.id, { cellRange: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                      <div className={styles.propRow}>
                        <label>Chart title</label>
                        <input
                          type="text"
                          placeholder="e.g. Revenue by Year"
                          value={selectedElem.props.chartTitle || ''}
                          onChange={e => updateElementProps(selectedElem.id, { chartTitle: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                      <div className={styles.propRow}>
                        <label>X-axis title</label>
                        <input
                          type="text"
                          placeholder="e.g. Year"
                          value={selectedElem.props.xAxisTitle || ''}
                          onChange={e => updateElementProps(selectedElem.id, { xAxisTitle: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                      <div className={styles.propRow}>
                        <label>Y-axis title</label>
                        <input
                          type="text"
                          placeholder="e.g. Revenue ($)"
                          value={selectedElem.props.yAxisTitle || ''}
                          onChange={e => updateElementProps(selectedElem.id, { yAxisTitle: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                    </>
                  )}
                  {selectedElem.type === 'output-field' && selectedElem.props.format === 'pie-chart' && (
                    <>
                      <div className={styles.propRow}>
                        <label>Cell range</label>
                        <input
                          type="text"
                          placeholder="e.g. B8:B12 or B1:B3,B5:B7"
                          value={selectedElem.props.cellRange || ''}
                          onChange={e => updateElementProps(selectedElem.id, { cellRange: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                      <div className={styles.propRow}>
                        <label>Chart title</label>
                        <input
                          type="text"
                          placeholder="e.g. Budget by Channel"
                          value={selectedElem.props.chartTitle || ''}
                          onChange={e => updateElementProps(selectedElem.id, { chartTitle: e.target.value })}
                          className={styles.propInput}
                        />
                      </div>
                    </>
                  )}
                  {selectedElem.type === 'output-field' && selectedElem.props.format === 'table' && (
                    <>
                      <div className={styles.tableColumnsSection}>
                        <div className={styles.propsSectionTitle}>Rows</div>
                        <div className={styles.propRow}>
                          <label>Heading</label>
                          <input
                            type="text"
                            placeholder="e.g. Month"
                            value={selectedElem.props.tableRowHeader || ''}
                            onChange={e => updateElementProps(selectedElem.id, { tableRowHeader: e.target.value })}
                            className={styles.propInput}
                          />
                        </div>
                        {getRows(selectedElem.props).map((row: string, index: number) => {
                          const rows = getRows(selectedElem.props);
                          return (
                            <div key={index} className={styles.tableRowConfig}>
                              <input
                                type="text"
                                placeholder="Row Label"
                                value={row}
                                onChange={e => {
                                  const next = [...rows];
                                  next[index] = e.target.value;
                                  updateElementProps(selectedElem.id, { tableRows: next });
                                }}
                                className={styles.propInput}
                              />
                              <button type="button" className={styles.removeColumnBtn} onClick={() => {
                                const next = rows.filter((_: string, i: number) => i !== index);
                                updateElementProps(selectedElem.id, { tableRows: next });
                              }} title="Remove row">x</button>
                            </div>
                          );
                        })}
                        <button type="button" className={styles.addColumnBtn} onClick={() => {
                          const rows = getRows(selectedElem.props);
                          updateElementProps(selectedElem.id, { tableRows: [...rows, `Row ${rows.length + 1}`] });
                        }}>+</button>
                      </div>
                      <div className={styles.tableColumnsSection}>
                        <div className={styles.propsSectionTitle}>Columns</div>
                        {getColumns(selectedElem.props).map((column, index: number) => {
                          const columns = getColumns(selectedElem.props);
                          return (
                            <div key={index} className={styles.tableColumnConfig}>
                              <input
                                type="text"
                                placeholder="Column Heading"
                                value={column.header || ''}
                                onChange={e => {
                                  const next = [...columns];
                                  next[index] = { ...next[index], header: e.target.value };
                                  updateElementProps(selectedElem.id, { tableColumns: next });
                                }}
                                className={styles.propInput}
                              />
                              <input
                                type="text"
                                placeholder="e.g. B2:B13"
                                value={column.range || ''}
                                onChange={e => {
                                  const next = [...columns];
                                  next[index] = { ...next[index], range: e.target.value };
                                  updateElementProps(selectedElem.id, { tableColumns: next });
                                }}
                                className={styles.propInput}
                              />
                              <button type="button" className={styles.removeColumnBtn} onClick={() => {
                                const next = columns.filter((_: unknown, i: number) => i !== index);
                                updateElementProps(selectedElem.id, { tableColumns: next.length ? next : [{ header: 'Column 1', range: '' }] });
                              }} title="Remove column">x</button>
                            </div>
                          );
                        })}
                        <button type="button" className={styles.addColumnBtn} onClick={() => {
                          const columns = getColumns(selectedElem.props);
                          updateElementProps(selectedElem.id, { tableColumns: [...columns, { header: `Column ${columns.length + 1}`, range: '' }] });
                        }}>+</button>
                      </div>
                    </>
                  )}
                  {selectedElem.type === 'input-field' && selectedElem.props.format === 'range' && (
                    <>
                      <div className={styles.propRow}>
                        <label>Step Size</label>
                        <input 
                        type="text"
                        placeholder='1'
                        value={selectedElem.props.stepSize ?? ''}
                        onChange={e => updateElementProps(selectedElem.id, { stepSize: e.target.value})}
                        className={styles.propInput}/>
                      </div>
                      <div className={styles.propRow}>
                        <label>Min</label>
                        <input 
                        type="text"
                        placeholder='0'
                        value={selectedElem.props.min ?? ''}
                        onChange={e => updateElementProps(selectedElem.id, { min: e.target.value})}
                        className={styles.propInput}/>
                      </div>
                      <div className={styles.propRow}>
                        <label>Max</label>
                        <input 
                        type="text"
                        placeholder='10'
                        value={selectedElem.props.max ?? ''}
                        onChange={e => updateElementProps(selectedElem.id, { max: e.target.value})}
                        className={styles.propInput}/>
                      </div>
                    </>
                  )}
                  {selectedElem.type === 'input-field' && selectedElem.props.format === 'dropdown' && (
                    <div className={styles.propRow}>
                      <label>Options</label>
                      <input type="text" value={selectedElem.props.options || ''} onChange={e => updateElementProps(selectedElem.id, { options: e.target.value })} className={styles.propInput} placeholder="Comma-separated" />
                    </div>
                  )}
                </div>
              )}

              {selectedElem.type === 'image' && (
                <div className={styles.propsSection}>
                  <div className={styles.propsSectionTitle}>Image</div>
                  <div className={styles.propRow}>
                    <label>Image URL</label>
                    <input type="text" value={selectedElem.props.src || ''} onChange={e => updateElementProps(selectedElem.id, { src: e.target.value })} className={styles.propInput} />
                  </div>
                  <div className={styles.propRow}>
                    <label>Upload from device</label>
                    <label className={styles.uploadBtn}>
                      <Upload size={14} /> Choose Image
                      <input type="file" accept="image/*" hidden onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file);
                        e.target.value = '';
                      }} />
                    </label>
                  </div>
                  {selectedElem.props.src && String(selectedElem.props.src).startsWith('data:') && (
                    <div>
                      <div className={styles.uploadPreview}>
                        <img src={selectedElem.props.src} alt="" />
                      </div>
                      <button className={styles.removeImgBtn} onClick={() => updateElementProps(selectedElem.id, { src: '' })}>
                        <X size={12} /> Remove image
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.divider} />
              <button className={styles.deleteBtn} onClick={() => deleteElement(selectedElem.id)}>
                <Trash2 size={14} /> Delete element
              </button>
            </div>
          ) : (
            <p className={styles.propsEmpty}>Select an element on the canvas to edit its properties</p>
          )
          )}
        </aside>
      </div>

      {/* THe section that shows preview of excel sheet values */}
      {showExcelPreview && (
        <div className="modal-overlay" onClick={() => setShowExcelPreview(false)}>
          <div className={`modal ${styles.excelPreviewModal}`} onClick={e => e.stopPropagation()}>
            <div className="modal__header">
              <h3>Excel Sheet Values</h3>
              <button className="modal__close" onClick={() => setShowExcelPreview(false)}><X size={18} /></button>
            </div>
            <div className={`modal__body ${styles.excelPreviewBody}`}>
              {project?.excel_data?.multiSheet && (
                <p className={styles.excelMultiSheetNotice}>
                  This workbook has {project.excel_data.sheets?.length || 'multiple'} sheets
                  {project.excel_data.sheets?.length ? ` (${project.excel_data.sheets.join(', ')})` : ''}.
                  Cell references are shown as <code>Sheet!Cell</code>, and cross-sheet formulas are supported.
                </p>
              )}
              <p className={styles.excelPreviewHint}>
                Showing the cells currently used by this simulation - not the full original spreadsheet layout.
              </p>
              <table className={styles.excelPreviewTable}>
                <thead>
                  <tr>
                    <th>Cell</th>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Value / Formula</th>
                  </tr>
                </thead>
                <tbody>
                  {allTrackedCells.map(c => (
                    <tr key={c.ref}>
                      <td>{c.ref}</td>
                      <td>{c.title || '-'}</td>
                      <td>{c.kind}</td>
                      <td>{c.display}</td>
                    </tr>
                  ))}
                  {allTrackedCells.length === 0 && (
                    <tr>
                      <td colSpan={4} className={styles.excelPreviewEmpty}>No spreadsheet data on this project.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
