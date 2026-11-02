import React from 'react';
import { expandRange } from '../../utils/FormulaEngine';
import { getColumns, getRows } from '../../utils/tableUtils';
import styles from '../ProjectDesigner.module.css';
import type { CanvasElement } from './types';

// Matches PIE_COLORS in StudentSimulationView.tsx, so this canvas preview's slice colors
// line up with what the actual student-facing pie chart will render.
const PIE_COLORS = ['#4ade80', '#60a5fa', '#f59e0b', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#34d399'];

// Renders a single canvas element. Memoized so that dragging/resizing ONE element
// (which updates only that element's x/y/w/h in state) does not re-render every other
// element. This matters most for image elements, whose src is a large base64 data URL:
// re-rendering all of them on every mousemove made dragging very laggy.
export interface CanvasElementViewProps {
  elem: CanvasElement;
  selected: boolean;
  onElemMouseDown: (e: React.MouseEvent, elem: CanvasElement) => void;
  onResizeMouseDown: (e: React.MouseEvent, elem: CanvasElement) => void;
}

export const CanvasElementView = React.memo<CanvasElementViewProps>(({ elem, selected, onElemMouseDown, onResizeMouseDown }) => {
  return (
    <div
      className={`${styles.canvasElem} ${selected ? styles.canvasElemSelected : ''}`}
      data-elem-id={elem.id}
      style={{ left: elem.x, top: elem.y, width: elem.w, height: elem.h }}
      onMouseDown={e => onElemMouseDown(e, elem)}
    >
      {elem.type === 'text' && (
        <div className={styles.elemText} style={{ fontSize: elem.props.fontSize, color: elem.props.color, fontWeight: elem.props.bold ? 700 : 400 }}>
          {elem.props.content}
        </div>
      )}
      {elem.type === 'input-field' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          {elem.props.format === 'range' && (
            <div>
            <input className={styles.fieldBox} type='range' readOnly disabled></input>
            <span className={styles.sliderValue}>{elem.props.min ?? 0} - {elem.props.max ?? 10}</span>
            </div>
          )}
          {elem.props.format === 'dropdown' && (
            <div className={styles.fieldBox}>
              <span className={styles.fieldPlaceholder}>{elem.props.placeholder || 'Choose...'} ({elem.props.cellRef || 'no cell'})</span>
            </div>
          )}
          {elem.props.format !== 'range' && elem.props.format !== 'dropdown' && (
            <div className={styles.fieldBox}>
            <span className={styles.fieldPlaceholder}>{elem.props.placeholder} ({elem.props.cellRef || 'no cell'})</span>
          </div>
          )}
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'bar-chart' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.barChartPreview}>
            <div className={styles.barChartPreviewBar} style={{ height: '40%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '65%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '50%' }} />
            <div className={styles.barChartPreviewBar} style={{ height: '85%' }} />
            <span className={styles.barChartPreviewLabel}>{elem.props.cellRange || 'no range'}</span>
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'pie-chart' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.pieChartPreview}>
            <div className={styles.pieChartPreviewCircle} />
            <div className={styles.pieChartPreviewLegend}>
              {elem.props.cellRange
                ? expandRange(elem.props.cellRange).map((ref, i) => (
                    <div key={ref} className={styles.pieChartPreviewLegendRow}>
                      <span className={styles.pieChartPreviewSwatch} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className={styles.pieChartPreviewLegendLabel}>Legend {i + 1}</span>
                    </div>
                  ))
                : <span className={styles.barChartPreviewLabel}>no range</span>}
            </div>
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format === 'table' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={styles.tablePreview}>
            <div className={styles.tablePreviewHeader}>
              <span>{elem.props.tableRowHeader || ''}</span>
              {getColumns(elem.props).map((column, i) => <span key={i}>{column.header || `Column ${i + 1}`}</span>)}
            </div>
            {getRows(elem.props).slice(0, 3).map((row: string, i: number) => (
              <div key={`${row}-${i}`} className={styles.tablePreviewRow}>
                <span>{row}</span>
                {getColumns(elem.props).map((_, columnIndex) => <span key={columnIndex}>0</span>)}
              </div>
            ))}
            {!getRows(elem.props).length && <span className={styles.barChartPreviewLabel}>no rows</span>}
          </div>
        </div>
      )}
      {elem.type === 'output-field' && elem.props.format !== 'bar-chart' && elem.props.format !== 'pie-chart' && elem.props.format !== 'table' && (
        <div className={styles.elemField}>
          <label>{elem.props.label}</label>
          <div className={`${styles.fieldBox} ${styles.fieldOutput}`}>
            <span>{elem.props.cellRef || 'no cell'}</span>
          </div>
        </div>
      )}
      {elem.type === 'image' && (
        <div className={styles.elemImage}>
          <img src={elem.props.src} alt={elem.props.alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}
      <div className={styles.resizeHandle} onMouseDown={e => onResizeMouseDown(e, elem)} />
    </div>
  );
});
CanvasElementView.displayName = 'CanvasElementView';
