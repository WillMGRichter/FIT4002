import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent } from '../utils/projectStorage';
import { recomputeAll, expandRange, getTransitiveDependencies, type CellMap } from '../utils/FormulaEngine';
import styles from './StudentSimulationView.module.css';

interface CanvasElement {
  id: string;
  type: 'text' | 'input-field' | 'output-field' | 'image';
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

// Fixed slice colors for pie charts - not user-configurable yet, cycled in order per slice.
const PIE_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#34d399'];

type PerPageInputs = Record<string, Record<string, number | string>>;

/**
 * Normalise a stored `input_values` blob into the per-page shape
 * `{ [pageId]: { ref: value } }`.
 *
 * Backward compatibility: older saved states used a single flat map
 * `{ ref: value }` shared across all pages. When we detect that shape (top-level
 * values are primitives rather than objects), we seed the FIRST page with those
 * values so existing in-progress attempts aren't lost.
 */
function migrateInputValues(stored: any, pages: Page[]): PerPageInputs {
  if (!stored || typeof stored !== 'object') return {};

  const values = Object.values(stored);
  const looksPerPage =
    values.length > 0 && values.every(v => v !== null && typeof v === 'object' && !Array.isArray(v));

  if (looksPerPage) {
    // Already the per-page shape - keep only entries that are objects.
    const result: PerPageInputs = {};
    for (const [pageId, refMap] of Object.entries(stored)) {
      if (refMap && typeof refMap === 'object') result[pageId] = refMap as Record<string, number | string>;
    }
    return result;
  }

  // Legacy flat shape: assign to the first page.
  const firstPageId = pages[0]?.id;
  return firstPageId ? { [firstPageId]: stored as Record<string, number | string> } : {};
}

export const StudentSimulationView: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = Boolean((location.state as { preview?: boolean } | null)?.preview);
  const { token } = useAuth();

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  // Fully-isolated per-page values: each page has its own copy of cell inputs,
  // keyed by page id. A change on one page never affects another page's cells.
  const [inputValuesByPage, setInputValuesByPage] = useState<Record<string, Record<string, number | string>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState<{ attemptNumber: number; maxAttempts: number } | null>(null);
  const [project, setProject] = useState<any>(null);
  const stateIdRef = useRef<string | null>(null);

  const autoSaveTimer = useRef<number | null>(null);

  const currentPageId = pages[currentPageIdx]?.id || '';
  // The current page's own input values (its isolated copy of the shared cells).
  const inputValues = useMemo(
    () => inputValuesByPage[currentPageId] || {},
    [inputValuesByPage, currentPageId]
  );

  // Extract formula strings from the project's excel_data for client-side recomputation
  const formulas = useMemo(() => {
    if (!project?.excel_data?.cells) return {};
    const f: Record<string, string> = {};
    for (const [ref, cell] of Object.entries<any>(project.excel_data.cells)) {
      const rawFormula = cell.formula || (typeof cell.value === 'string' ? cell.value : null);
      if (rawFormula) {
        f[ref.toUpperCase()] = rawFormula.startsWith('=') ? rawFormula : '=' + rawFormula;
      }
    }
    return f;
  }, [project]);

  // Seed values from the spreadsheet — used as defaults until the student provides input
  const defaultCells = useMemo(() => {
    if (!project?.excel_data?.cells) return {};
    const d: CellMap = {};
    for (const [ref, cell] of Object.entries<any>(project.excel_data.cells)) {
      if (!cell.formula && cell.value !== null && cell.value !== undefined && !isNaN(Number(cell.value))) {
        d[ref.toUpperCase()] = Number(cell.value);
      }
    }
    return d;
  }, [project]);

  // Lookup of cell ref -> spreadsheet label, used to label bar chart bars
  const cellTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    const cells = [...(project?.excel_data?.inputCells || []), ...(project?.excel_data?.outputCells || [])];
    for (const c of cells) {
      if (c.ref && c.title) titles[c.ref.toUpperCase()] = c.title;
    }
    return titles;
  }, [project]);

  // Merge default cells with THIS PAGE's inputs, then compute all formula outputs.
  // Each page recomputes independently from the shared formulas/defaults, so pages
  // that reference the same cell do not interfere with one another.
  const computedValues = useMemo(() => {
    const allCells: CellMap = { ...defaultCells, ...inputValues };
    // An override is any current-page input whose ref also has a formula: the
    // student is pinning a computed cell to a manual value. recomputeAll keeps
    // that value instead of evaluating its formula.
    const overrides = new Set<string>();
    for (const ref of Object.keys(inputValues)) {
      if (formulas[ref.toUpperCase()]) overrides.add(ref.toUpperCase());
    }
    return recomputeAll(allCells, formulas, overrides);
  }, [inputValues, formulas, defaultCells]);

  useEffect(() => {
    if (!projectId || !token) return;

    const load = async () => {
      try {
        const [projRes, pagesRes] = await Promise.all([
          fetch(`${API_URL}/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/projects/${projectId}/pages`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (!projRes.ok || !pagesRes.ok) throw new Error('Failed to load simulation');

        const proj = await projRes.json();
        let pgs = await pagesRes.json();
        pgs = pgs.map((p: any) => ({ ...p, elements: p.elements || [] }));

        setProject(proj);
        addRecent({ id: projectId!, name: proj.name });
        setPages(pgs);

        // Try to load existing state
        const stateRes = await fetch(`${API_URL}/student-state/${projectId}/state`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (stateRes.ok) {
          const state = await stateRes.json();
          stateIdRef.current = state.id;
          setAttemptInfo({ attemptNumber: state.attempt_number, maxAttempts: 0 });
          if (state.input_values && Object.keys(state.input_values).length > 0) {
            setInputValuesByPage(migrateInputValues(state.input_values, pgs));
          }
          if (state.current_page_id && pgs.length > 0) {
            const idx = pgs.findIndex((p: Page) => p.id === state.current_page_id);
            if (idx >= 0) setCurrentPageIdx(idx);
          }
        }

        // Get attempt info from participant
        const partRes = await fetch(`${API_URL}/projects/${projectId}/participants`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (partRes.ok) {
          await partRes.json();
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    load();
  }, [projectId, token]);

  // Persist the full per-page input values to the server (debounced) for resume across sessions
  const saveInputValues = useCallback(async (values: Record<string, Record<string, number | string>>) => {
    if (!stateIdRef.current || !projectId || !token) return;
    try {
      await fetch(`${API_URL}/student-state/${projectId}/state/inputs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stateId: stateIdRef.current, inputValues: values }),
      });
    } catch { /* silent */ }
  }, [projectId, token]);

  const debouncedSave = useCallback((values: Record<string, Record<string, number | string>>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => saveInputValues(values), 1000);
  }, [saveInputValues]);

  const handleInputChange = (cellRef: string, value: string) => {
    // Store the raw string as typed rather than eagerly parsing to a number - parseFloat("0.")
    // collapses to 0 mid-keystroke, which snaps the controlled input back and strips the "."
    // before the user can type a fractional digit. Downstream formula evaluation already
    // coerces strings to numbers (see FormulaEngine.getCellValue), so this is safe either way.
    // Writes only into the CURRENT page's isolated value map.
    if (!currentPageId) return;
    const upper = cellRef.toUpperCase();
    setInputValuesByPage(prev => {
      const pageVals = { ...(prev[currentPageId] || {}), [upper]: value };

      // Auto-revert overrides (mitigation): if the student changed a NON-formula
      // input, drop any active formula-cell override whose value depends on the
      // changed cell - keeping such an override would show a value inconsistent
      // with its own formula. The overridden cell then resumes computing normally.
      if (!formulas[upper]) {
        for (const ref of Object.keys(pageVals)) {
          if (ref === upper) continue;
          if (formulas[ref] && getTransitiveDependencies(ref, formulas).has(upper)) {
            delete pageVals[ref];
          }
        }
      }

      const next = { ...prev, [currentPageId]: pageVals };
      debouncedSave(next);
      return next;
    });
  };

  /** Clear a formula-cell override so it resumes computing from its formula. */
  const clearOverride = (cellRef: string) => {
    if (!currentPageId) return;
    const upper = cellRef.toUpperCase();
    setInputValuesByPage(prev => {
      const pageVals = { ...(prev[currentPageId] || {}) };
      delete pageVals[upper];
      const next = { ...prev, [currentPageId]: pageVals };
      debouncedSave(next);
      return next;
    });
  };

  const handlePageChange = async (newIdx: number) => {
    setCurrentPageIdx(newIdx);
    if (stateIdRef.current && projectId && token && pages[newIdx]) {
      try {
        await fetch(`${API_URL}/student-state/${projectId}/state/page`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ stateId: stateIdRef.current, pageId: pages[newIdx].id }),
        });
      } catch { /* silent */ }
    }
  };

  const handleSubmit = async () => {
    if (!stateIdRef.current || !projectId || !token) return;
    setSubmitting(true);
    try {
      await saveInputValues(inputValuesByPage);
      const res = await fetch(`${API_URL}/student-state/${projectId}/state/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stateId: stateIdRef.current, inputValues: inputValuesByPage }),
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currentPage = pages[currentPageIdx];
  const totalPages = pages.length;

  // A bar/pie chart's configured w/h on the designer canvas is just a box size the teacher
  // picked - it says nothing about how many bars/legend rows the chart actually ends up with.
  // Without this, extra bars just get squeezed thinner (.barChartCol is flex:1) instead of the
  // box - and the page - growing to fit them, and pie-chart legend rows get silently clipped
  // (.pieChartLegend has overflow:hidden). This computes the size the chart actually needs.
  const MIN_BAR_COL_WIDTH = 48;
  const MIN_LEGEND_ROW_HEIGHT = 18;

  const getEffectiveSize = useCallback((elem: CanvasElement) => {
    if (elem.type !== 'output-field') return { w: elem.w, h: elem.h };

    if (elem.props.format === 'bar-chart') {
      const count = expandRange(elem.props.cellRange || '').length;
      const yAxisAllowance = elem.props.yAxisTitle ? 24 : 0;
      const minW = count * MIN_BAR_COL_WIDTH + Math.max(0, count - 1) * 8 + 20 + yAxisAllowance;
      return { w: Math.max(elem.w, minW), h: elem.h };
    }

    if (elem.props.format === 'pie-chart') {
      const count = expandRange(elem.props.cellRange || '').length;
      const minH = count * MIN_LEGEND_ROW_HEIGHT + 40;
      return { w: elem.w, h: Math.max(elem.h, minH) };
    }

    return { w: elem.w, h: elem.h };
  }, []);

  // Elements keep the raw x/y/w/h they were given on the designer's canvas, which has no size cap.
  // The slide card below has a default max-width/min-height, so grow it to whatever the furthest
  // element actually needs - otherwise elements placed near the designer canvas's edges spill
  // outside the visible page card here.
  const pageBounds = useMemo(() => {
    const elements = currentPage?.elements || [];
    const maxRight = elements.reduce((m, e) => {
      const { w } = getEffectiveSize(e);
      return Math.max(m, e.x + w);
    }, 0);
    const maxBottom = elements.reduce((m, e) => {
      const { h } = getEffectiveSize(e);
      return Math.max(m, e.y + h);
    }, 0);
    return { width: maxRight, height: maxBottom };
  }, [currentPage, getEffectiveSize]);

  const formatValue = (value: any, fmt?: string) => {
    if (fmt === 'text') return String(value ?? '');
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return String(value ?? '0');
    switch (fmt) {
      case 'currency': return `$${num.toFixed(2)}`;
      case 'percentage': return `${(num * 100).toFixed(1)}%`;
      default: return Number.isInteger(num) ? num.toString() : num.toFixed(2);
    }
  };

  const renderBarChart = (props: Record<string, any>) => {
    const refs = expandRange(props.cellRange || '');
    const bars = refs.map(ref => {
      const upperRef = ref.toUpperCase();
      return { ref: upperRef, value: Number(computedValues[upperRef]) || 0 };
    });
    const max = Math.max(1, ...bars.map(b => Math.abs(b.value)));

    return (
      <div className={styles.barChartWrap}>
        {props.chartTitle && <div className={styles.barChartTitle}>{props.chartTitle}</div>}
        <div className={styles.barChartRow}>
          {props.yAxisTitle && <div className={styles.barChartYAxisTitle}>{props.yAxisTitle}</div>}
          <div className={styles.barChart}>
            {bars.map(b => (
              <div key={b.ref} className={styles.barChartCol}>
                <span className={styles.barChartValue}>{formatValue(b.value)}</span>
                <div className={styles.barChartBar} style={{ height: `${(Math.abs(b.value) / max) * 100}%` }} />
                <span className={styles.barChartRefLabel}>{cellTitles[b.ref] || b.ref}</span>
              </div>
            ))}
          </div>
        </div>
        {props.xAxisTitle && <div className={styles.barChartXAxisTitle}>{props.xAxisTitle}</div>}
      </div>
    );
  };

  const renderPieChart = (props: Record<string, any>) => {
    const refs = expandRange(props.cellRange || '');
    const slices = refs.map(ref => {
      const upperRef = ref.toUpperCase();
      return { ref: upperRef, value: Math.max(0, Number(computedValues[upperRef]) || 0) };
    });
    const total = slices.reduce((sum, s) => sum + s.value, 0);

    let cursor = 0;
    const gradientStops = slices.map((s, i) => {
      const pct = total > 0 ? (s.value / total) * 100 : 0;
      const start = cursor;
      const end = cursor + pct;
      cursor = end;
      return `${PIE_COLORS[i % PIE_COLORS.length]} ${start}% ${end}%`;
    });

    return (
      <div className={styles.pieChartWrap}>
        {props.chartTitle && <div className={styles.barChartTitle}>{props.chartTitle}</div>}
        <div className={styles.pieChartRow}>
          <div
            className={styles.pieChartCircle}
            style={{ background: total > 0 ? `conic-gradient(${gradientStops.join(', ')})` : '#e5e7eb' }}
          />
          <div className={styles.pieChartLegend}>
            {slices.map((s, i) => (
              <div key={s.ref} className={styles.pieChartLegendRow}>
                <span className={styles.pieChartSwatch} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className={styles.pieChartLegendLabel}>{cellTitles[s.ref] || s.ref}</span>
                <span className={styles.pieChartLegendValue}>
                  {formatValue(s.value)}{total > 0 ? ` (${((s.value / total) * 100).toFixed(0)}%)` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderTable = (props: Record<string, any>) => {
    const refs = expandRange(props.cellRange || '');

    return (
      <div className={styles.tableWrap}>
        {props.chartTitle && <div className={styles.barChartTitle}>{props.chartTitle}</div>}
        <table className={styles.outputTable}>
          <thead>
            <tr>
              {props.showCellRef !== false && <th>Cell</th>}
              <th>Label</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {refs.map(ref => {
              const upperRef = ref.toUpperCase();
              return (
                <tr key={upperRef}>
                  {props.showCellRef !== false && <td>{upperRef}</td>}
                  <td>{cellTitles[upperRef] || upperRef}</td>
                  <td>{formatValue(computedValues[upperRef] ?? 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (loading) {
    return <AppShell title="Simulation"><div className={styles.state}>Loading simulation...</div></AppShell>;
  }

  if (error) {
    return <AppShell title="Simulation"><div className={`${styles.state} ${styles.stateError}`}>{error}</div></AppShell>;
  }

  if (submitted) {
    return (
      <AppShell title="Simulation Complete">
        <div className={styles.completed}>
          <div className={styles.completedIcon}>✓</div>
          <h1>Simulation Complete</h1>
          <p>Your answers have been submitted successfully.</p>
          <button className={styles.backBtn} onClick={() => navigate('/dashboard')}>Back to Dashboard</button>
        </div>
      </AppShell>
    );
  }

  if (totalPages === 0) {
    return (
      <AppShell title="Simulation">
        <div className={styles.state}>
          <AlertCircle size={24} />
          <p>This simulation has no pages yet.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={project?.name || 'Simulation'} showBack compactSidebar>
      <div className={styles.simulation}>
        {/* ── Page indicator ── */}
        <div className={styles.pageIndicator}>
          <div className={styles.pageIndicatorSide}>
            {isPreview && (
              <button className={styles.backToEditingBtn} onClick={() => navigate(`/projects/${projectId}/design`)}>
                Back to Editing
              </button>
            )}
          </div>
          <div className={styles.pageDots}>
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className={`${styles.pageDot} ${idx === currentPageIdx ? styles.pageDotActive : ''} ${idx < currentPageIdx ? styles.pageDotDone : ''}`}
                onClick={() => handlePageChange(idx)}
                title={page.name}
              />
            ))}
          </div>
          <div className={styles.pageIndicatorSide} />
        </div>

        {/* ── Slide area ── */}
        <div className={styles.slideArea}>
          {attemptInfo && (
            <div className={styles.attemptBadge}>
              Attempt {attemptInfo.attemptNumber}
            </div>
          )}

          <div className={styles.slide} style={{ width: Math.max(900, pageBounds.width + 48) }}>
            <div className={styles.slideHeader}>
              <h2>{currentPage?.name || 'Untitled'}</h2>
              <span className={styles.slideCounter}>{currentPageIdx + 1} / {totalPages}</span>
            </div>

            <div className={styles.canvas} style={{ minHeight: Math.max(400, pageBounds.height) }}>
              {currentPage?.elements.map(elem => {
                const { w: effectiveW, h: effectiveH } = getEffectiveSize(elem);
                return (
                <div
                  key={elem.id}
                  className={styles.canvasElem}
                  style={{ left: elem.x, top: elem.y, width: effectiveW, height: effectiveH }}
                >
                  {elem.type === 'text' && (
                    <div className={styles.textElem} style={{ fontSize: elem.props.fontSize, color: elem.props.color, fontWeight: elem.props.bold ? 700 : 400 }}>
                      {elem.props.content}
                    </div>
                  )}
                  {elem.type === 'input-field' && (
                    <div className={styles.fieldElem}>
                      <label>{elem.props.label}</label>
                        {elem.props.format === 'dropdown' ? (
                          <select
                            className={styles.fieldInput}
                            value={inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? ''}
                            onChange={e => handleInputChange(elem.props.cellRef || '', e.target.value)}
                          >
                            <option value="">{elem.props.placeholder || 'Choose...'}</option>
                            {(elem.props.options || '').split(',').map((opt: string) => opt.trim()).filter(Boolean).map((opt: string) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : elem.props.format === 'range' ? (
                          <input
                            type="range"
                            className={styles.fieldInput}
                            min={elem.props.min ?? 0}
                            max={elem.props.max ?? 10}
                            step={elem.props.stepSize ?? 1}
                            value={inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? (Number(elem.props.min ?? 0) + Number(elem.props.max ?? 10)) / 2}
                            onChange={e => handleInputChange(elem.props.cellRef || '', e.target.value)}
                          />
                        ) : (
                          <input
                            type={elem.props.format || 'number'}
                            className={styles.fieldInput}
                            placeholder={elem.props.placeholder}
                            value={inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? ''}
                            onChange={e => handleInputChange(elem.props.cellRef || '', e.target.value)}
                          />
                        )}
                        {elem.props.format === 'range'
                         && (<span className={styles.sliderValue}>
                          {inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? (Number(elem.props.min ?? 0) + Number(elem.props.max ?? 10)) / 2 }
                         </span> 
                        )
                        }
                        {(() => {
                          const ref = elem.props.cellRef?.toUpperCase() || '';
                          const isFormulaCell = !!formulas[ref];
                          const isOverridden = isFormulaCell && inputValues[ref] !== undefined && inputValues[ref] !== '';
                          if (!isOverridden) return null;
                          return (
                            <div className={styles.overrideNotice}>
                              <span className={styles.overrideBadge}>Manual override</span>
                              <button
                                type="button"
                                className={styles.overrideReset}
                                onClick={() => clearOverride(elem.props.cellRef || '')}
                              >
                                Reset to formula
                              </button>
                            </div>
                          );
                        })()}
                    </div>
                    )}
                  {elem.type === 'output-field' && elem.props.format === 'bar-chart' && (
                    <div className={`${styles.fieldElem} ${styles.outputElem}`}>
                      <label>{elem.props.label}</label>
                      {renderBarChart(elem.props)}
                    </div>
                  )}
                  {elem.type === 'output-field' && elem.props.format === 'pie-chart' && (
                    <div className={`${styles.fieldElem} ${styles.outputElem}`}>
                      <label>{elem.props.label}</label>
                      {renderPieChart(elem.props)}
                    </div>
                  )}
                  {elem.type === 'output-field' && elem.props.format === 'table' && (
                    <div className={`${styles.fieldElem} ${styles.outputElem}`}>
                      <label>{elem.props.label}</label>
                      {renderTable(elem.props)}
                    </div>
                  )}
                  {elem.type === 'output-field' && elem.props.format !== 'bar-chart' && elem.props.format !== 'pie-chart' && elem.props.format !== 'table' && (
                    <div className={`${styles.fieldElem} ${styles.outputElem}`}>
                      <label>{elem.props.label}</label>
                      <div className={styles.outputValue}>
                        {formatValue(computedValues[elem.props.cellRef?.toUpperCase() || ''] ?? 0, String(elem.props.format || 'number'))}
                      </div>
                    </div>
                  )}
                  {elem.type === 'image' && (
                    <div className={styles.imageElem}>
                      <img src={elem.props.src} alt={elem.props.alt || ''} />
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className={styles.bottomBar}>
          <button
            className={styles.navBtn}
            disabled={currentPageIdx === 0}
            onClick={() => handlePageChange(currentPageIdx - 1)}
          >
            <ChevronLeft size={18} /> Previous
          </button>

          <div className={styles.bottomCenter}>
            {currentPageIdx === totalPages - 1 ? (
              <button className={styles.submitBtn} onClick={handleSubmit} disabled={submitting}>
                <Send size={16} /> {submitting ? 'Submitting...' : 'Submit'}
              </button>
            ) : (
              <span className={styles.pageHint}>Fill in the inputs above</span>
            )}
          </div>

          <button
            className={styles.navBtn}
            disabled={currentPageIdx === totalPages - 1}
            onClick={() => handlePageChange(currentPageIdx + 1)}
          >
            Next <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </AppShell>
  );
};
