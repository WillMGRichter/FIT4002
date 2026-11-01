import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface PieChartFieldsProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Cell range / title fields for a pie chart output. */
export const PieChartFields: React.FC<PieChartFieldsProps> = ({ elem, updateElementProps }) => {
  return (
    <>
      <div className={styles.propRow}>
        <label>Cell range</label>
        <input
          type="text"
          placeholder="e.g. B8:B12 or B1:B3,B5:B7"
          value={elem.props.cellRange || ''}
          onChange={e => updateElementProps(elem.id, { cellRange: e.target.value })}
          className={styles.propInput}
        />
      </div>
      <div className={styles.propRow}>
        <label>Chart title</label>
        <input
          type="text"
          placeholder="e.g. Budget by Channel"
          value={elem.props.chartTitle || ''}
          onChange={e => updateElementProps(elem.id, { chartTitle: e.target.value })}
          className={styles.propInput}
        />
      </div>
    </>
  );
};
