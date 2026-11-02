import type { CellValue, ExcelData, InputCell, OutputCell } from '../../types/simulation';

export interface TrackedCell {
  ref: string;
  title: string | null | undefined;
  kind: 'Input' | 'Output';
  display: CellValue | string;
}

const byRef = (a: { ref: string }, b: { ref: string }) =>
  a.ref.localeCompare(b.ref, undefined, { numeric: true });

/**
 * Input (non-formula) cells of the uploaded spreadsheet, sorted naturally by reference
 * (A2 before A10). Uses the backend's `inputCells` list when present, otherwise derives
 * them from the raw `cells`.
 */
export function getInputCells(excelData: ExcelData | null | undefined): InputCell[] {
  if (excelData?.inputCells) return [...excelData.inputCells].sort(byRef);
  if (!excelData?.cells) return [];
  return Object.entries(excelData.cells)
    .filter(([, cell]) => !cell.formula)
    .map(([ref, cell]): InputCell => ({ ref, value: cell.value, title: null }))
    .sort(byRef);
}

/**
 * Output (formula) cells of the uploaded spreadsheet, sorted naturally by reference.
 * Uses the backend's `outputCells` list when present, otherwise derives them from `cells`.
 */
export function getOutputCells(excelData: ExcelData | null | undefined): OutputCell[] {
  if (excelData?.outputCells) return [...excelData.outputCells].sort(byRef);
  if (!excelData?.cells) return [];
  return Object.entries(excelData.cells)
    .filter(([, cell]) => !!cell.formula)
    .map(([ref, cell]): OutputCell => ({ ref, formula: cell.formula ?? '', title: null, dependencies: {} }))
    .sort(byRef);
}

/**
 * Every cell the app currently tracks from the sheet, for the "Preview Excel" table.
 * Note: this only reflects cells the backend kept after upload (output/formula cells, plus input
 * cells referenced by a formula) - unreferenced or label-only cells from the original sheet are
 * not available.
 */
export function getTrackedCells(inputCells: InputCell[], outputCells: OutputCell[]): TrackedCell[] {
  const rows: TrackedCell[] = [
    ...inputCells.map((c): TrackedCell => ({ ref: c.ref, title: c.title, kind: 'Input', display: c.value })),
    ...outputCells.map((c): TrackedCell => ({ ref: c.ref, title: c.title, kind: 'Output', display: c.formula })),
  ];
  return rows.sort(byRef);
}
