import XLSX from 'xlsx';
import { extractFormulas } from './formulaExtractor';

/**
 * Builds the `excel_data` structure consumed by the frontend from an uploaded
 * workbook buffer. Supports workbooks with multiple sheets.
 *
 * Cell keys:
 *  - Single-sheet workbooks keep bare refs (e.g. `B3`) for backward compatibility
 *    with existing projects.
 *  - Multi-sheet workbooks qualify every ref with its (upper-cased) sheet name
 *    (e.g. `SALES!B3`). Formulas are normalised so that bare refs become
 *    qualified with the formula's owning sheet, while explicit cross-sheet refs
 *    (`Sales!B3`) are preserved.
 */

export interface InputCell {
  ref: string;
  value: any;
  title: string | null;
}

export interface OutputCell {
  ref: string;
  value: any;
  formula: string;
  title: string | null;
  dependencies: Record<string, number>;
}

export interface ExcelData {
  cells: Record<string, any>;
  sheets: string[];
  /** True when the workbook has more than one sheet. */
  multiSheet: boolean;
  inputCells: InputCell[];
  outputCells: OutputCell[];
}

interface RawCell {
  value: any;
  formula: string | null;
  type: string | null;
  /** Sheet this cell belongs to (original case). */
  sheet: string;
  /** Bare cell address within its sheet, e.g. `B3`. */
  localRef: string;
}

function colToIndex(col: string): number {
  let index = 0;
  for (let i = 0; i < col.length; i++) {
    index = index * 26 + col.charCodeAt(i) - 64;
  }
  return index;
}

function indexToCol(index: number): string {
  let col = '';
  while (index > 0) {
    const remainder = (index - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    index = Math.floor((index - 1) / 26);
  }
  return col;
}

function prevCol(col: string): string | null {
  const colIdx = colToIndex(col);
  if (colIdx <= 1) return null;
  return indexToCol(colIdx - 1);
}

/** Normalise a sheet name into a key-safe token: upper-case, non-alphanumerics -> underscore. */
function sheetKey(sheetName: string): string {
  return sheetName.toUpperCase().replace(/[^A-Z0-9]/g, '_');
}

/** Produce the storage key for a cell: bare ref for single-sheet, `SHEET!REF` otherwise. */
function qualify(sheetName: string, localRef: string, multiSheet: boolean): string {
  return multiSheet ? `${sheetKey(sheetName)}!${localRef.toUpperCase()}` : localRef.toUpperCase();
}

/**
 * Rewrite a formula's cell references into fully-qualified storage keys.
 *  - Explicit cross-sheet refs (`Sales!B3` or `'My Sheet'!B3`) are qualified using their named sheet.
 *  - Bare refs (`B3`) are qualified using `ownerSheet`.
 * For single-sheet workbooks, refs are left bare (upper-cased) as before.
 */
function normaliseFormula(formula: string, ownerSheet: string, multiSheet: boolean): string {
  if (!multiSheet) return formula;

  // Match optional sheet prefix (quoted or bare) followed by a cell ref.
  const qualifiedRefRegex = new RegExp(
    "(?:(?:'([^']+)'|([A-Za-z_][A-Za-z0-9_.]*))\\s*!\\s*)?(\\$?[A-Za-z]+\\$?\\d+)",
    'g'
  );

  return formula.replace(qualifiedRefRegex, (_whole, quotedSheet, bareSheet, cellRef) => {
    const sheet = quotedSheet || bareSheet || ownerSheet;
    return `${sheetKey(sheet)}!${cellRef.toUpperCase()}`;
  });
}

/**
 * Extract cell references and their linear coefficients from a formula body
 * (no leading '='). Reference keys are already-qualified storage keys.
 */
function extractDependencies(normalisedFormula: string): Record<string, number> {
  const deps: Record<string, number> = {};
  if (!normalisedFormula) return deps;
  let expr = normalisedFormula;

  // A cell token: optional `SHEET!` prefix + column + row (all already qualified/upper-cased).
  const CELL = "(?:[A-Z0-9_]+!)?\\$?[A-Z]+\\$?\\d+";

  // Expand range functions: SUM(A1:A5) -> A1+A2+A3+A4+A5 (preserving any sheet prefix).
  expr = expr.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT|PRODUCT)\(([^)]+)\)/gi, (_m, _func, range: string) => {
    if (range.includes(':')) {
      const parts = range.split(':');
      if (parts.length === 2) {
        const parseTok = (t: string) => /^(?:([A-Z0-9_]+)!)?\$?([A-Z]+)\$?(\d+)$/.exec(t.trim().toUpperCase());
        const s = parseTok(parts[0]);
        const e = parseTok(parts[1]);
        if (s && e) {
          const sheetPrefix = s[1] ? `${s[1]}!` : '';
          const startCol = colToIndex(s[2]);
          const startRow = parseInt(s[3], 10);
          const endCol = colToIndex(e[2]);
          const endRow = parseInt(e[3], 10);
          const expanded: string[] = [];
          for (let r = Math.min(startRow, endRow); r <= Math.max(startRow, endRow); r++) {
            for (let c = Math.min(startCol, endCol); c <= Math.max(startCol, endCol); c++) {
              expanded.push(`${sheetPrefix}${indexToCol(c)}${r}`);
            }
          }
          return expanded.join('+');
        }
      }
    }
    return range;
  });

  const terms = expr.split(/(?=[+-])/);
  for (const term of terms) {
    const trimmed = term.replace(/^[+-]/, '').trim();
    if (!trimmed) continue;

    // number*CELL
    const coeffFirst = new RegExp(`^(\\d+(?:\\.\\d+)?)\\s*\\*\\s*(${CELL})$`).exec(trimmed);
    if (coeffFirst) {
      const ref = coeffFirst[2].replace(/\$/g, '');
      deps[ref] = (deps[ref] || 0) + parseFloat(coeffFirst[1]);
      continue;
    }

    // CELL*number
    const coeffLast = new RegExp(`^(${CELL})\\s*\\*\\s*(\\d+(?:\\.\\d+)?)$`).exec(trimmed);
    if (coeffLast) {
      const ref = coeffLast[1].replace(/\$/g, '');
      deps[ref] = (deps[ref] || 0) + parseFloat(coeffLast[2]);
      continue;
    }

    // CELL/number
    const divRef = new RegExp(`^(${CELL})\\s*/\\s*(\\d+(?:\\.\\d+)?)$`).exec(trimmed);
    if (divRef) {
      const ref = divRef[1].replace(/\$/g, '');
      deps[ref] = (deps[ref] || 0) + (1 / parseFloat(divRef[2]));
      continue;
    }

    // Plain cell ref
    const plainRef = new RegExp(`^(${CELL})$`).exec(trimmed);
    if (plainRef) {
      const ref = plainRef[1].replace(/\$/g, '');
      deps[ref] = (deps[ref] || 0) + 1;
      continue;
    }

    // Fallback: extract any cell refs in complex expressions
    const refs = trimmed.match(new RegExp(CELL, 'g')) || [];
    for (const r of refs) {
      const cleaned = r.replace(/\$/g, '');
      deps[cleaned] = (deps[cleaned] || 0) + 1;
    }
  }

  return deps;
}

export function buildExcelData(buffer: Buffer): ExcelData {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetNames = workbook.SheetNames;
  const multiSheet = sheetNames.length > 1;

  const rawFormulasBySheet = extractFormulas(buffer);

  // Collect every cell from every sheet, keyed by qualified storage key.
  const cells: Record<string, RawCell> = {};

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // First pass: read all cached cells for this sheet.
    for (const cellAddress in sheet) {
      if (cellAddress[0] === '!') continue;
      const cell = sheet[cellAddress];
      const key = qualify(sheetName, cellAddress, multiSheet);
      cells[key] = {
        value: cell.v !== undefined ? cell.v : null,
        formula: cell.f || null,
        type: cell.t || null,
        sheet: sheetName,
        localRef: cellAddress.toUpperCase(),
      };
    }

    // Recover formula cells the xlsx lib drops when they lack a cached value.
    for (const { cell, formula } of rawFormulasBySheet.get(sheetName) || []) {
      const key = qualify(sheetName, cell, multiSheet);
      const existing = cells[key];
      if (existing) {
        if (!existing.formula) existing.formula = formula;
      } else {
        cells[key] = {
          value: null,
          formula,
          type: 'n',
          sheet: sheetName,
          localRef: cell.toUpperCase(),
        };
      }
    }
  }

  // Title lookup: search the label to the left, then the header above,
  // scoped to the cell's own sheet.
  const findTitle = (cell: RawCell): string | null => {
    const match = cell.localRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    const col = match[1];
    const row = parseInt(match[2], 10);

    const lookup = (localRef: string) => cells[qualify(cell.sheet, localRef, multiSheet)];

    const leftCol = prevCol(col);
    if (leftCol) {
      const leftCell = lookup(`${leftCol}${row}`);
      if (leftCell && (leftCell.type === 's' || typeof leftCell.value === 'string') && leftCell.value != null) {
        return String(leftCell.value);
      }
    }

    if (row > 1) {
      const aboveCell = lookup(`${col}${row - 1}`);
      if (aboveCell && (aboveCell.type === 's' || typeof aboveCell.value === 'string') && aboveCell.value != null) {
        return String(aboveCell.value);
      }
    }

    return null;
  };

  const inputCells: InputCell[] = [];
  const outputCells: OutputCell[] = [];

  // Second pass: classify into output (has formula) and input (no formula).
  for (const [key, cell] of Object.entries(cells)) {
    if (cell.formula) {
      const normalised = normaliseFormula(cell.formula, cell.sheet, multiSheet);
      outputCells.push({
        ref: key,
        value: cell.value,
        formula: '=' + normalised,
        title: findTitle(cell),
        dependencies: extractDependencies(normalised),
      });
    } else if (
      typeof cell.value === 'number' ||
      ((cell.type === 'n' || cell.type === 's') && cell.value !== null)
    ) {
      inputCells.push({
        ref: key,
        value: cell.value,
        title: findTitle(cell),
      });
    }
  }

  // Keep only input cells referenced by at least one output formula.
  const referencedCells = new Set<string>();
  for (const oc of outputCells) {
    for (const ref of Object.keys(oc.dependencies)) {
      referencedCells.add(ref);
    }
  }
  const relevantInputCells = inputCells.filter(ic => referencedCells.has(ic.ref));

  // Build minimal cells map (inputs referenced by formulas + outputs).
  const filteredCells: Record<string, any> = {};
  for (const ic of relevantInputCells) {
    filteredCells[ic.ref] = { value: ic.value, formula: null, type: typeof ic.value === 'number' ? 'n' : 's' };
  }
  for (const oc of outputCells) {
    filteredCells[oc.ref] = { value: oc.value, formula: oc.formula, type: 'n' };
  }

  return {
    cells: filteredCells,
    sheets: sheetNames,
    multiSheet,
    inputCells: relevantInputCells,
    outputCells,
  };
}
