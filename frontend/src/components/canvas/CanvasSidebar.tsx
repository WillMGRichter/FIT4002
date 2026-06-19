import React from 'react';
import { NavLink } from 'react-router-dom';
import styles from './CanvasSidebar.module.css';

export interface SidebarItem {
  type: string;
  label: string;
  preview: React.ReactNode;
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
  /** 'list' stacks items vertically; 'grid' uses a 2-column grid. Defaults to 'list'. */
  layout?: 'list' | 'grid';
}

interface CanvasSidebarProps {
  sections: SidebarSection[];
}

const onDragStart = (e: React.DragEvent<HTMLDivElement>, nodeType: string) => {
  e.dataTransfer.setData('application/reactflow', nodeType);
  e.dataTransfer.effectAllowed = 'move';
};

export const CanvasSidebar: React.FC<CanvasSidebarProps> = ({ sections }) => (
  <aside className={styles.sidebar}>
    <div className={styles.header}>
      <NavLink to="/" className={styles.backBtn}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </NavLink>
    </div>

    <div className={styles.navGroup}>
      <span className={styles.navGroupLabel}>Home</span>
      <button className={styles.createBtn}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Create
      </button>
    </div>

    {sections.map(section => (
      <div key={section.title} className={styles.section}>
        <span className={styles.sectionLabel}>{section.title}</span>
        <div className={section.layout === 'grid' ? styles.itemGrid : styles.itemList}>
          {section.items.map(item => (
            <div
              key={item.type}
              className={styles.item}
              draggable
              onDragStart={e => onDragStart(e, item.type)}
              title={item.label}
            >
              {item.preview}
            </div>
          ))}
        </div>
      </div>
    ))}
  </aside>
);
