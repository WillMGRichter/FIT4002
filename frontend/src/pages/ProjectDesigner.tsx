import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Eye, Save, Table } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import styles from './ProjectDesigner.module.css';
import { ELEMENT_PALETTE } from './projectDesigner/elementPalette';
import { CanvasElementView } from './projectDesigner/CanvasElementView';
import { getInputCells, getOutputCells, getTrackedCells } from './projectDesigner/designerCells';
import { PageSidebar } from './projectDesigner/PageSidebar';
import { PropertiesPanel } from './projectDesigner/PropertiesPanel';
import { ExcelPreviewModal } from './projectDesigner/ExcelPreviewModal';
import { useDesignerPages } from './projectDesigner/useDesignerPages';
import { useElementEditing } from './projectDesigner/useElementEditing';
import { useCanvasGestures } from './projectDesigner/useCanvasGestures';

export const ProjectDesigner: React.FC = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  const canvasRef = useRef<HTMLDivElement>(null);

  const { project, pages, setPages, activePageIdx, setActivePageIdx, loading, saving, savePages, addPage, deletePage } =
    useDesignerPages({ projectId, token });
  const [selectedElemId, setSelectedElemId] = useState<string | null>(null);
  const [showExcelPreview, setShowExcelPreview] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(true);
  const [propsOpen, setPropsOpen] = useState(true);

  const activePage = pages[activePageIdx];
  const activeElements = activePage?.elements || [];
  const selectedElem = activeElements.find(e => e.id === selectedElemId);

  // Input / output cells of the uploaded spreadsheet (sorted by reference) and the combined list
  // shown in the "Preview Excel" table. See projectDesigner/designerCells.ts.
  const inputCells = React.useMemo(() => getInputCells(project?.excel_data), [project]);
  const outputCells = React.useMemo(() => getOutputCells(project?.excel_data), [project]);
  const allTrackedCells = React.useMemo(() => getTrackedCells(inputCells, outputCells), [inputCells, outputCells]);

  const { addElement, updateElementProps, updateElementPosition, updateElementSize, deleteElement, handleImageUpload } =
    useElementEditing({ setPages, activePageIdx, activePage, activeElements, selectedElem, setSelectedElemId });

  const { handleElemMouseDown, handleResizeMouseDown } =
    useCanvasGestures({ canvasRef, activePageIdx, setPages, setSelectedElemId });

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.canvasElem}`)) return;
    setSelectedElemId(null);
  };

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
