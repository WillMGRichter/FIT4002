import React from 'react';
import { X } from 'lucide-react';
import styles from '../ProjectDesigner.module.css';
import type { SimulationProject } from '../../types/simulation';
import type { TrackedCell } from './designerCells';

interface ExcelPreviewModalProps {
  project: SimulationProject | null;
  cells: TrackedCell[];
  onClose: () => void;
}

/** Modal listing the spreadsheet cells the simulation currently uses (inputs and outputs). */
export const ExcelPreviewModal: React.FC<ExcelPreviewModalProps> = ({ project, cells, onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={`modal ${styles.excelPreviewModal}`} onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h3>Excel Sheet Values</h3>
          <button className="modal__close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className={`modal__body ${styles.excelPreviewBody}`}>
          {project?.excel_data?.multiSheet && (
            <p className={styles.excelMultiSheetNotice}>
              This workbook has {project.excel_data.sheets?.length || 'multiple'} sheets
              {project.excel_data.sheets?.length ? ` (${project.excel_data.sheets.join(', ')})` : ''}.
              Cell references are shown as <code>Sheet!Cell</code>, and cross-sheet formulas are supported.
            </p>
          )}
          <p className={styles.excelPreviewHint}>
            Showing the cells currently used by this simulation - not the full original spreadsheet layout.
          </p>
          <table className={styles.excelPreviewTable}>
            <thead>
              <tr>
                <th>Cell</th>
                <th>Title</th>
                <th>Type</th>
                <th>Value / Formula</th>
              </tr>
            </thead>
            <tbody>
              {cells.map(c => (
                <tr key={c.ref}>
                  <td>{c.ref}</td>
                  <td>{c.title || '-'}</td>
                  <td>{c.kind}</td>
                  <td>{c.display}</td>
                </tr>
              ))}
              {cells.length === 0 && (
                <tr>
                  <td colSpan={4} className={styles.excelPreviewEmpty}>No spreadsheet data on this project.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
