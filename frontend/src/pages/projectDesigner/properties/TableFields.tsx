import React from 'react';
import { getColumns, getRows } from '../../../utils/tableUtils';
import styles from '../../ProjectDesigner.module.css';
import type { ElementProps } from '../../../types/simulation';
import type { CanvasElement } from '../types';

interface TableFieldsProps {
  elem: CanvasElement;
  updateElementProps: (elemId: string, props: Partial<ElementProps>) => void;
}

/** Row and column builder for a table output. */
export const TableFields: React.FC<TableFieldsProps> = ({ elem, updateElementProps }) => {
  return (
    <>
      <div className={styles.tableColumnsSection}>
        <div className={styles.propsSectionTitle}>Rows</div>
        <div className={styles.propRow}>
          <label>Heading</label>
          <input
            type="text"
            placeholder="e.g. Month"
            value={elem.props.tableRowHeader || ''}
            onChange={e => updateElementProps(elem.id, { tableRowHeader: e.target.value })}
            className={styles.propInput}
          />
        </div>
        {getRows(elem.props).map((row: string, index: number) => {
          const rows = getRows(elem.props);
          return (
            <div key={index} className={styles.tableRowConfig}>
              <input
                type="text"
                placeholder="Row Label"
                value={row}
                onChange={e => {
                  const next = [...rows];
                  next[index] = e.target.value;
                  updateElementProps(elem.id, { tableRows: next });
                }}
                className={styles.propInput}
              />
              <button type="button" className={styles.removeColumnBtn} onClick={() => {
                const next = rows.filter((_: string, i: number) => i !== index);
                updateElementProps(elem.id, { tableRows: next });
              }} title="Remove row">x</button>
            </div>
          );
        })}
        <button type="button" className={styles.addColumnBtn} onClick={() => {
          const rows = getRows(elem.props);
          updateElementProps(elem.id, { tableRows: [...rows, `Row ${rows.length + 1}`] });
        }}>+</button>
      </div>
      <div className={styles.tableColumnsSection}>
        <div className={styles.propsSectionTitle}>Columns</div>
        {getColumns(elem.props).map((column, index: number) => {
          const columns = getColumns(elem.props);
          return (
            <div key={index} className={styles.tableColumnConfig}>
              <input
                type="text"
                placeholder="Column Heading"
                value={column.header || ''}
                onChange={e => {
                  const next = [...columns];
                  next[index] = { ...next[index], header: e.target.value };
                  updateElementProps(elem.id, { tableColumns: next });
                }}
                className={styles.propInput}
              />
              <input
                type="text"
                placeholder="e.g. B2:B13"
                value={column.range || ''}
                onChange={e => {
                  const next = [...columns];
                  next[index] = { ...next[index], range: e.target.value };
                  updateElementProps(elem.id, { tableColumns: next });
                }}
                className={styles.propInput}
              />
              <button type="button" className={styles.removeColumnBtn} onClick={() => {
                const next = columns.filter((_: unknown, i: number) => i !== index);
                updateElementProps(elem.id, { tableColumns: next.length ? next : [{ header: 'Column 1', range: '' }] });
              }} title="Remove column">x</button>
            </div>
          );
        })}
        <button type="button" className={styles.addColumnBtn} onClick={() => {
          const columns = getColumns(elem.props);
          updateElementProps(elem.id, { tableColumns: [...columns, { header: `Column ${columns.length + 1}`, range: '' }] });
        }}>+</button>
      </div>
    </>
  );
};
