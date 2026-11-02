import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { CanvasElement } from '../types';

interface PositionSizeSectionProps {
  elem: CanvasElement;
  updateElementPosition: (elemId: string, x: number, y: number) => void;
  updateElementSize: (elemId: string, w: number, h: number) => void;
}

/** X / Y / Width / Height fields for the selected element. */
export const PositionSizeSection: React.FC<PositionSizeSectionProps> = ({ elem, updateElementPosition, updateElementSize }) => {
  return (
    <div className={styles.propsSection}>
      <div className={styles.propsSectionTitle}>Position &amp; Size</div>
      <div className={styles.propRow}>
        <label>X</label>
        <input type="number" value={elem.x} onChange={e => updateElementPosition(elem.id, parseInt(e.target.value) || 0, elem.y)} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Y</label>
        <input type="number" value={elem.y} onChange={e => updateElementPosition(elem.id, elem.x, parseInt(e.target.value) || 0)} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Width</label>
        <input type="number" value={elem.w} onChange={e => updateElementSize(elem.id, parseInt(e.target.value) || 40, elem.h)} className={styles.propInput} />
      </div>
      <div className={styles.propRow}>
        <label>Height</label>
        <input type="number" value={elem.h} onChange={e => updateElementSize(elem.id, elem.w, parseInt(e.target.value) || 24)} className={styles.propInput} />
      </div>
    </div>
  );
};
