import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Send, AlertCircle } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent } from '../utils/projectStorage';
import { recomputeAll, expandRange, type CellMap } from '../utils/FormulaEngine';
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

export const StudentSimulationView: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isPreview = Boolean((location.state as { preview?: boolean } | null)?.preview);
  const { token } = useAuth();

  const [pages, setPages] = useState<Page[]>([]);
  const [currentPageIdx, setCurrentPageIdx] = useState(0);
  const [inputValues, setInputValues] = useState<Record<string, number | string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState<{ attemptNumber: number; maxAttempts: number } | null>(null);
  const [project, setProject] = useState<any>(null);
  const stateIdRef = useRef<string | null>(null);

  const autoSaveTimer = useRef<number | null>(null);

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

  // Merge default cells with student input, then compute all formula outputs via topological sort
  const computedValues = useMemo(() => {
    const allCells: CellMap = { ...defaultCells, ...inputValues };
    return recomputeAll(allCells, formulas);
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
            setInputValues(state.input_values);
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

  // Persist current input values to the server (debounced) for resume across sessions
  const saveInputValues = useCallback(async (values: Record<string, number | string>) => {
    if (!stateIdRef.current || !projectId || !token) return;
    try {
      await fetch(`${API_URL}/student-state/${projectId}/state/inputs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stateId: stateIdRef.current, inputValues: values }),
      });
    } catch { /* silent */ }
  }, [projectId, token]);

  const debouncedSave = useCallback((values: Record<string, number | string>) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = window.setTimeout(() => saveInputValues(values), 1000);
  }, [saveInputValues]);

  const handleInputChange = (cellRef: string, value: string) => {
    // Store the raw string as typed rather than eagerly parsing to a number - parseFloat("0.")
    // collapses to 0 mid-keystroke, which snaps the controlled input back and strips the "."
    // before the user can type a fractional digit. Downstream formula evaluation already
    // coerces strings to numbers (see FormulaEngine.getCellValue), so this is safe either way.
    const newValues = { ...inputValues, [cellRef.toUpperCase()]: value };
    setInputValues(newValues);
    debouncedSave(newValues);
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
      await saveInputValues(inputValues);
      const res = await fetch(`${API_URL}/student-state/${projectId}/state/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stateId: stateIdRef.current, inputValues }),
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

  // Elements keep the raw x/y/w/h they were given on the designer's canvas, which has no size cap.
  // The slide card below has a default max-width/min-height, so grow it to whatever the furthest
  // element actually needs - otherwise elements placed near the designer canvas's edges spill
  // outside the visible page card here.
  const pageBounds = useMemo(() => {
    const elements = currentPage?.elements || [];
    const maxRight = elements.reduce((m, e) => Math.max(m, e.x + e.w), 0);
    const maxBottom = elements.reduce((m, e) => Math.max(m, e.y + e.h), 0);
    return { width: maxRight, height: maxBottom };
  }, [currentPage]);

  const formatValue = (value: any, fmt?: string) => {
    const num = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(num)) return '0';
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
              {currentPage?.elements.map(elem => (
                <div
                  key={elem.id}
                  className={styles.canvasElem}
                  style={{ left: elem.x, top: elem.y, width: elem.w, height: elem.h }}
                >
                  {elem.type === 'text' && (
                    <div className={styles.textElem} style={{ fontSize: elem.props.fontSize, color: elem.props.color, fontWeight: elem.props.bold ? 700 : 400 }}>
                      {elem.props.content}
                    </div>
                  )}
                  {elem.type === 'input-field' && (
                    <div className={styles.fieldElem}>
                      <label>{elem.props.label}</label>
                        <input
                          // spread props of input here equivalent to x = elem.props.x, y = elem.props.y.... etc
                          {...elem.props}
                          // override elem.props above if necessary
                          type={elem.props.format}
                          className={styles.fieldInput}
                          value={inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? ''}
                          onChange={e => handleInputChange(elem.props.cellRef || '', e.target.value)}
                        />
                        {elem.props.format === 'range'
                         && (<span className={styles.sliderValue}>
                          {inputValues[elem.props.cellRef?.toUpperCase() || ''] ?? elem.props.min ?? 0}
                         </span>)
                        }
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
                  {elem.type === 'output-field' && elem.props.format !== 'bar-chart' && elem.props.format !== 'pie-chart' && (
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
              ))}
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
