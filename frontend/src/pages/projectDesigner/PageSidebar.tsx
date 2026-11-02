import React from 'react';
import { Trash2, Plus, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import styles from '../ProjectDesigner.module.css';
import type { Page } from './types';

interface PageSidebarProps {
  pages: Page[];
  activePageIdx: number;
  open: boolean;
  onToggle: () => void;
  onSelectPage: (idx: number) => void;
  onRenamePage: (idx: number, name: string) => void;
  onDeletePage: (idx: number) => void;
  onAddPage: () => void;
}

/** Left sidebar: the list of pages (select, rename, delete) and the "Add Page" button. */
export const PageSidebar: React.FC<PageSidebarProps> = ({
  pages, activePageIdx, open, onToggle, onSelectPage, onRenamePage, onDeletePage, onAddPage,
}) => {
  return (
    <aside className={`${styles.pageSidebar} ${!open ? styles.panelCollapsed : ''}`}>
      <div className={styles.pageSidebarHeader}>
        {open && <h3>Pages</h3>}
        <button
          className={styles.panelToggleBtn}
          onClick={onToggle}
          title={open ? 'Collapse pages' : 'Expand pages'}
        >
          {open ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
        </button>
      </div>
      {open && (
        <>
          <div className={styles.pageList}>
            {pages.map((page, idx) => (
              <div
                key={page.id}
                className={`${styles.pageItem} ${idx === activePageIdx ? styles.pageItemActive : ''}`}
                onClick={() => onSelectPage(idx)}
              >
                <GripVertical size={14} className={styles.pageDrag} />
                <input
                  className={styles.pageNameInput}
                  value={page.name}
                  onChange={e => onRenamePage(idx, e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
                <button className={styles.pageDeleteBtn} onClick={e => { e.stopPropagation(); onDeletePage(idx); }} title="Delete page"><Trash2 size={13} /></button>
              </div>
            ))}
            <button className={styles.addPageBtn} onClick={onAddPage}><Plus size={14} /> Add Page</button>
          </div>
        </>
      )}
    </aside>
  );
};
