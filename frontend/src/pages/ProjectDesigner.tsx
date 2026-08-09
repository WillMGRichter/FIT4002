import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Trash2, Plus, Eye, Save, GripVertical, Type, Image, RectangleHorizontal, ChartBar, Table, X } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent } from '../utils/projectStorage';
import styles from './ProjectDesigner.module.css';

type ElementType = 'text' | 'input-field' | 'output-field' | 'image';

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

let elemId = 0;
const newElemId = () => `elem_${++elemId}`;

const ELEMENT_PALETTE: { type: ElementType; label: string; icon: React.ReactNode; defaultProps: Record<string, any> }[] = [
  { type: 'text', label: 'Text', icon: <Type size={20} />, defaultProps: { content: 'Text', fontSize: 16, color: '#111827', bold: false } },
  { type: 'input-field', label: 'Input', icon: <RectangleHorizontal size={20} />, defaultProps: { cellRef: '', label: 'Input', placeholder: 'Enter value...' } },
  { type: 'output-field', label: 'Output', icon: <ChartBar size={20} />, defaultProps: { cellRef: '', cellRange: '', label: 'Output', format: 'number' } },
  { type: 'image', label: 'Image', icon: <Image size={20} />, defaultProps: { src: 'https://placehold.co/400x200?text=Image', alt: '' } },
];

export const ProjectDesigner: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [project, setProject] = useState<any>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [activePageIdx, setActivePageIdx] = useState(0);
  const [selectedElemId, setSelectedElemId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ elemId: string; startX: number; startY: number; elemX: number; elemY: number } | null>(null);
  const [resizing, setResizing] = useState<{ elemId: string; startX: number; startY: number; elemW: number; elemH: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExcelPreview, setShowExcelPreview] = useState(false);

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

  const deleteElement = (elemId: string) => {
    const newElements = activeElements.filter(e => e.id !== elemId);
    updateActivePageElements(newElements);
    setSelectedElemId(null);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.canvasElem}`)) return;
    setSelectedElemId(null);
  };

  const handleElemMouseDown = (e: React.MouseEvent, elem: CanvasElement) => {
    if ((e.target as HTMLElement).closest(`.${styles.resizeHandle}`)) return;
    e.stopPropagation();
    setSelectedElemId(elem.id);
    setDragging({ elemId: elem.id, startX: e.clientX, startY: e.clientY, elemX: elem.x, elemY: elem.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, elem: CanvasElement) => {
    e.stopPropagation();
    setResizing({ elemId: elem.id, startX: e.clientX, startY: e.clientY, elemW: elem.w, elemH: elem.h });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragging.startX;
      const dy = e.clientY - dragging.startY;
      updateElementPosition(dragging.elemId, Math.max(0, dragging.elemX + dx), Math.max(0, dragging.elemY + dy));
    };
    const handleMouseUp = () => setDragging(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, updateElementPosition]);

  useEffect(() => {
    if (!resizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      const dw = e.clientX - resizing.startX;
      const dh = e.clientY - resizing.startY;
      updateElementSize(resizing.elemId, resizing.elemW + dw, resizing.elemH + dh);
    };
    const handleMouseUp = () => setResizing(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, updateElementSize]);

  const selectedElem = activeElements.find(e => e.id === selectedElemId);

  if (loading) {
    return <AppShell title="Project Designer"><div className={styles.loading}>Loading...</div></AppShell>;
  }

  return (
    <AppShell title={project?.name || 'Designer'} activeItem="create" showBack>
      <div className={styles.designer}>
        {/* ── Left: Page sidebar ── */}
        <aside className={styles.pageSidebar}>
          <div className={styles.pageSidebarHeader}>
            <h3>Pages</h3>
          </div>
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
          </div>
          <button className={styles.addPageBtn} onClick={addPage}><Plus size={14} /> Add Page</button>
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
              <div
                key={elem.id}
                className={`${styles.canvasElem} ${selectedElemId === elem.id ? styles.canvasElemSelected : ''}`}
                style={{ left: elem.x, top: elem.y, width: elem.w, height: elem.h }}
                onMouseDown={e => handleElemMouseDown(e, elem)}
              >
                {elem.type === 'text' && (
                  <div className={styles.elemText} style={{ fontSize: elem.props.fontSize, color: elem.props.color, fontWeight: elem.props.bold ? 700 : 400 }}>
                    {elem.props.content}
                  </div>
                )}
                {elem.type === 'input-field' && (
                  <div className={styles.elemField}>
                    <label>{elem.props.label}</label>
                    <div className={styles.fieldBox}>
                      <span className={styles.fieldPlaceholder}>{elem.props.placeholder} ({elem.props.cellRef || 'no cell'})</span>
                    </div>
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
                {elem.type === 'output-field' && elem.props.format !== 'bar-chart' && (
                  <div className={styles.elemField}>
                    <label>{elem.props.label}</label>
                    <div className={`${styles.fieldBox} ${styles.fieldOutput}`}>
                      <span>{elem.props.cellRef || 'no cell'}</span>
                    </div>
                  </div>
                )}
                {elem.type === 'image' && (
                  <div className={styles.elemImage}>
                    <img src={elem.props.src} alt={elem.props.alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div className={styles.resizeHandle} onMouseDown={e => handleResizeMouseDown(e, elem)} />
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Properties panel ── */}
        <aside className={styles.propsPanel}>
          <h3 className={styles.propsTitle}>Properties</h3>
          {selectedElem ? (
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
                  {selectedElem.props.format !== 'bar-chart' && (
                    <div className={styles.propRow}>
                      <label>Cell ref</label>
                      <select value={selectedElem.props.cellRef || ''} onChange={e => updateElementProps(selectedElem.id, { cellRef: e.target.value })} className={styles.propInput}>
                        <option value="">-- Select cell --</option>
                        {selectedElem.type === 'input-field' && inputCells.map((c: any) => (
                          <option key={c.ref} value={c.ref}>{c.title || c.ref}{c.value !== undefined && c.value !== null ? ` (${c.value})` : ''}</option>
                        ))}
                        {selectedElem.type === 'output-field' && outputCells.map((c: any) => (
                          <option key={c.ref} value={c.ref}>{c.title || c.ref}{c.formula ? ` (${c.formula})` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {selectedElem.type === 'input-field' && (
                    <div className={styles.propRow}>
                      <label>Placeholder</label>
                      <input type="text" value={selectedElem.props.placeholder || ''} onChange={e => updateElementProps(selectedElem.id, { placeholder: e.target.value })} className={styles.propInput} />
                    </div>
                  )}
                  {selectedElem.type === 'output-field' && (
                    <div className={styles.propRow}>
                      <label>Format</label>
                      <select value={selectedElem.props.format || 'number'} onChange={e => updateElementProps(selectedElem.id, { format: e.target.value })} className={styles.propInput}>
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="percentage">Percentage</option>
                        <option value="bar-chart">Bar Chart</option>
                      </select>
                    </div>
                  )}
                  {selectedElem.type === 'output-field' && selectedElem.props.format === 'bar-chart' && (
                    <div className={styles.propRow}>
                      <label>Cell range</label>
                      <input
                        type="text"
                        placeholder="e.g. B4:B8"
                        value={selectedElem.props.cellRange || ''}
                        onChange={e => updateElementProps(selectedElem.id, { cellRange: e.target.value })}
                        className={styles.propInput}
                      />
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
                </div>
              )}

              <div className={styles.divider} />
              <button className={styles.deleteBtn} onClick={() => deleteElement(selectedElem.id)}>
                <Trash2 size={14} /> Delete element
              </button>
            </div>
          ) : (
            <p className={styles.propsEmpty}>Select an element on the canvas to edit its properties</p>
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
