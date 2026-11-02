import React from 'react';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps, InputCell, OutputCell } from '../../../types/simulation';
import type { CanvasElement } from '../types';
import { BarChartFields } from './BarChartFields';
import { PieChartFields } from './PieChartFields';
import { TableFields } from './TableFields';
import { SliderFields } from './SliderFields';
import { DropdownFields } from './DropdownFields';

interface CellBindingSectionProps {
  elem: CanvasElement;
  inputCells: InputCell[];
  outputCells: OutputCell[];
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/**
 * Label, cell reference and format for an input or output element, plus the extra fields each
 * format needs (chart ranges, table builder, slider limits, dropdown options).
 */
export const CellBindingSection: React.FC<CellBindingSectionProps> = ({ elem, inputCells, outputCells, updateElementProps }) => {
  return (
    <div className={styles.propsSection}>
      <div className={styles.propsSectionTitle}>Cell Binding</div>
      <div className={styles.propRow}>
        <label>Label</label>
        <input type="text" value={elem.props.label || ''} onChange={e => updateElementProps(elem.id, { label: e.target.value })} className={styles.propInput} />
      </div>
      {elem.props.format !== 'bar-chart' && elem.props.format !== 'pie-chart' && elem.props.format !== 'table' && (
        <div className={styles.propRow}>
          <label>Cell ref</label>
          <select value={elem.props.cellRef || ''} onChange={e => {
            const ref = e.target.value;
            const cell = elem.type === 'input-field'
              ? inputCells.find(c => c.ref === ref)
              : outputCells.find(c => c.ref === ref);
            const updates: Partial<ElementProps> = { cellRef: ref };
            const isDefaultLabel = elem.props.label === 'Input' || elem.props.label === 'Output';
            if (cell?.title && isDefaultLabel) updates.label = cell.title;
            updateElementProps(elem.id, updates);
          }} className={styles.propInput}>
            <option value="">-- Select cell --</option>
            {elem.type === 'input-field' && inputCells.map(c => (
              <option key={c.ref} value={c.ref}>{c.ref} | {c.title || c.ref}{c.value !== undefined && c.value !== null ? ` | ${c.value}` : ''}</option>
            ))}
            {elem.type === 'output-field' && outputCells.map(c => (
              <option key={c.ref} value={c.ref}>{c.ref} | {c.title || c.ref}{c.formula ? ` | ${c.formula}` : ''}</option>
            ))}
          </select>
        </div>
      )}
      {elem.type === 'input-field' && (
        <>
          <div className={styles.propRow}>
            <label>Placeholder</label>
            <input type="text" value={elem.props.placeholder || ''} onChange={e => updateElementProps(elem.id, { placeholder: e.target.value })} className={styles.propInput} />
          </div>
          {/* Specify format of the input type */}
          <div className={styles.propRow}>
            <label>Format</label>
              <select value={elem.props.format || 'number'} onChange={e => updateElementProps(elem.id, { format: e.target.value })} className={styles.propInput}>
                <option value="number">Number</option>
                <option value="range">Slider</option>
                <option value="dropdown">Dropdown</option>
              </select>
          </div>
        </>
      )}
      {elem.type === 'output-field' && (
        <div className={styles.propRow}>
          <label>Format</label>
          <select value={elem.props.format || 'number'} onChange={e => updateElementProps(elem.id, { format: e.target.value })} className={styles.propInput}>
            <option value="number">Number</option>
            <option value="text">Text</option>
            <option value="currency">Currency</option>
            <option value="percentage">Percentage</option>
            <option value="bar-chart">Bar Chart</option>
            <option value="pie-chart">Pie Chart</option>
            <option value="table">Table</option>
          </select>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'bar-chart' && <BarChartFields elem={elem} updateElementProps={updateElementProps} />}
      {elem.type === 'output-field' && elem.props.format === 'pie-chart' && <PieChartFields elem={elem} updateElementProps={updateElementProps} />}
      {elem.type === 'output-field' && elem.props.format === 'table' && <TableFields elem={elem} updateElementProps={updateElementProps} />}
      {elem.type === 'input-field' && elem.props.format === 'range' && <SliderFields elem={elem} updateElementProps={updateElementProps} />}
      {elem.type === 'input-field' && elem.props.format === 'dropdown' && <DropdownFields elem={elem} updateElementProps={updateElementProps} />}
    </div>
  );
};
