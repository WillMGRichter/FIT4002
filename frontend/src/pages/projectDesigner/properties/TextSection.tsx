import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface TextSectionProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Content / font size / bold / colour fields for a text element. */
export const TextSection: React.FC<TextSectionProps> = ({ elem, updateElementProps }) => {
  return (
    <div className={styles.propsSection}>
      <div className={styles.propsSectionTitle}>Text</div>
      <div className={styles.propRow}>
        <label>Content</label>
        <input type="text" value={elem.props.content || ''} onChange={e => updateElementProps(elem.id, { content: e.target.value })} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Font size</label>
        <input type="number" value={elem.props.fontSize || 16} onChange={e => updateElementProps(elem.id, { fontSize: parseInt(e.target.value) || 16 })} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Bold</label>
        <input type="checkbox" checked={elem.props.bold || false} onChange={e => updateElementProps(elem.id, { bold: e.target.checked })} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Color</label>
        <input type="color" value={elem.props.color || '#111827'} onChange={e => updateElementProps(elem.id, { color: e.target.value })} className={styles.propInput} />
      </div>
    </div>
  );
};
