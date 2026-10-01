import { expandRange } from './FormulaEngine';

export interface TableColumn {
  header?: string;
  range?: string;
}

export function getRows(props: Record<string, any>): string[] {
  if (Array.isArray(props.tableRows) && props.tableRows.length) {
    return props.tableRows;
  }

  const legacyRange = props.tableRowRange || props.cellRange || '';
  return legacyRange ? expandRange(legacyRange) : [];
}

export function getColumns(props: Record<string, any>): TableColumn[] {
  if (Array.isArray(props.tableColumns) && props.tableColumns.length) {
    return props.tableColumns;
  }

  return [{ header: 'Column 1', range: props.cellRange || '' }];
}
