/**
 * Shapes of the data the backend sends for simulations.
 *
 * These mirror backend/src/excel/excelDataBuilder.ts and backend/src/types. The
 * repo has no shared package, so they are duplicated here by hand: keep them in
 * sync when the API changes. Fields the code treats as possibly absent (older
 * saved projects predate them) are optional.
 */

/** A spreadsheet cell's value as read from the workbook. */
export type CellValue = number | string | boolean | null;

/** A cell in the trimmed-down `cells` map. */
export interface ExcelCell {
  value: CellValue;
  formula: string | null;
  type: string | null;
}

/** A cell a student can edit. */
export interface InputCell {
  ref: string;
  value: CellValue;
  title: string | null;
  /** True for a formula cell exposed as an overridable input. */
  overridable?: boolean;
  /** For overridable cells, the normalised formula. */
  formula?: string;
}

/** A computed (formula) cell shown as output. */
export interface OutputCell {
  ref: string;
  value?: CellValue;
  formula: string;
  title: string | null;
  dependencies: Record<string, number>;
}

/** The parsed workbook stored on a project (`projects.excel_data`). */
export interface ExcelData {
  cells: Record<string, ExcelCell>;
  sheets?: string[];
  multiSheet?: boolean;
  inputCells?: InputCell[];
  outputCells?: OutputCell[];
}

/** The parts of a project the designer and student views read. */
export interface SimulationProject {
  id?: string;
  name?: string;
  excel_data?: ExcelData | null;
  default_max_attempts?: number;
}

/** One column of a table output element. */
export interface TableColumn {
  header?: string;
  range?: string;
}

/**
 * Properties of a canvas element. Which ones apply depends on the element type
 * (text / input-field / output-field / image); all are optional because each type
 * only uses a subset and saved pages may predate newer fields.
 */
export interface ElementProps {
  // text
  content?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  // input and output fields
  cellRef?: string;
  label?: string;
  /** Display/control kind, e.g. 'number', 'range', 'dropdown', 'bar-chart', 'table'. Free text: it comes from a <select>. */
  format?: string;
  // input fields
  placeholder?: string;
  /** Written as strings by the designer's inputs but read as numbers, so both occur. */
  min?: number | string;
  max?: number | string;
  stepSize?: number | string;
  /** Comma-separated choices for a dropdown input. */
  options?: string;
  // output fields (charts and tables)
  cellRange?: string;
  chartTitle?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  tableRowHeader?: string;
  /** Legacy: older tables defined their rows by a range instead of `tableRows`. */
  tableRowRange?: string;
  tableRows?: string[];
  tableColumns?: TableColumn[];
  // images
  src?: string;
  alt?: string;
}

/** A row from GET /projects/:id/participants. */
export interface ParticipantRow {
  user_id: string;
  role: 'teacher' | 'student';
  username?: string | null;
  max_attempts?: number;
  attempts_used?: number;
}

/** Per-student outcome returned when a project is created. */
export interface StudentCreateResult {
  username: string;
  ok: boolean;
  error?: string;
}

/** Formulas found in one sheet by POST /excel/upload. */
export interface SheetFormulas {
  sheet: string;
  formulas: { cell: string; formula: string; references: string[] }[];
}
