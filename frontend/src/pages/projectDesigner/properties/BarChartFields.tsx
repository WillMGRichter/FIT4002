import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface BarChartFieldsProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Cell range / title / axis-title fields for a bar chart output. */
export const BarChartFields: React.FC<BarChartFieldsProps> = ({ elem, updateElementProps }) => {
  return (
    <>
      <div className={styles.propRow}>
        <label>Cell range</label>
        <input
          type="text"
          placeholder="e.g. B4:B8 or B1:B3,B5:B7"
          value={elem.props.cellRange || ''}
          onChange={e => updateElementProps(elem.id, { cellRange: e.target.value })}
          className={styles.propInput}
        />
      </div>
      <div className={styles.propRow}>
        <label>Chart title</label>
        <input
          type="text"
          placeholder="e.g. Revenue by Year"
          value={elem.props.chartTitle || ''}
          onChange={e => updateElementProps(elem.id, { chartTitle: e.target.value })}
          className={styles.propInput}
        />
      </div>
      <div className={styles.propRow}>
        <label>X-axis title</label>
        <input
          type="text"
          placeholder="e.g. Year"
          value={elem.props.xAxisTitle || ''}
          onChange={e => updateElementProps(elem.id, { xAxisTitle: e.target.value })}
          className={styles.propInput}
        />
      </div>
      <div className={styles.propRow}>
        <label>Y-axis title</label>
        <input
          type="text"
          placeholder="e.g. Revenue ($)"
          value={elem.props.yAxisTitle || ''}
          onChange={e => updateElementProps(elem.id, { yAxisTitle: e.target.value })}
          className={styles.propInput}
        />
      </div>
    </>
  );
};
