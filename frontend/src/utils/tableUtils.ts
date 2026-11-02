import { expandRange } from './FormulaEngine';
import type { ElementProps, TableColumn } from '../types/simulation';

export type { TableColumn };

export function getRows(props: ElementProps): string[] {
  if (Array.isArray(props.tableRows) && props.tableRows.length) {
    return props.tableRows;
  }

  const legacyRange = props.tableRowRange || props.cellRange || '';
  return legacyRange ? expandRange(legacyRange) : [];
}

export function getColumns(props: ElementProps): TableColumn[] {
  if (Array.isArray(props.tableColumns) && props.tableColumns.length) {
    return props.tableColumns;
  }

  return [{ header: 'Column 1', range: props.cellRange || '' }];
}
