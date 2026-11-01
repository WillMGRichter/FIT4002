import FormulaParser, { FormulaHelpers, Types } from 'fast-formula-parser';
import type { ExcelData } from '../excel/excelDataBuilder';

/**
 * Independent formula oracle backed by fast-formula-parser (MIT).
 *
 * Given the workbook data produced by buildExcelData, this computes the expected value of every
 * formula cell using a SEPARATE formula engine, so the cross-check compares our FormulaEngine
 * against an independent implementation rather than against the .xlsx file's (possibly stale)
 * cached values. No spreadsheet app, no cache dependency — runs anywhere Node runs.
 */

export type OracleValues = Record<string, number | string>;

function colLettersToNumber(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function numberToColLetters(n: number): string {
  let s = '';
  let c = n;
  while (c > 0) {
    const r = (c - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    c = Math.floor((c - 1) / 26);
  }
  return s;
}

interface ParsedRef {
  sheet: string | null;
  col: number; // 1-based
  row: number; // 1-based
}

function parseRef(ref: string): ParsedRef | null {
  const m = ref.match(/^(?:(.+)!)?\$?([A-Z]+)\$?(\d+)$/i);
  if (!m) return null;
  const [, sheet, colLetters, rowStr] = m;
  return { sheet: sheet ? sheet.toUpperCase() : null, col: colLettersToNumber(colLetters), row: parseInt(rowStr, 10) };
}

/**
 * Compute expected values for all formula cells in `data`, independently of our engine.
 * Returns a map of uppercased qualified ref -> value (numbers and strings).
 */
export function computeOracle(data: ExcelData): OracleValues {
  const values: OracleValues = {};

  // Seed with literal (non-formula) numeric inputs, keyed by uppercased ref.
  for (const [ref, cell] of Object.entries(data.cells)) {
    if (!cell.formula && cell.value != null && !isNaN(Number(cell.value))) {
      values[ref.toUpperCase()] = Number(cell.value);
    }
  }

  const lookup = (sheet: string | null | undefined, row: number, col: number): number | string => {
    const bare = `${numberToColLetters(col)}${row}`;
    const key = sheet ? `${sheet.toUpperCase()}!${bare}` : bare;
    const v = values[key] !== undefined ? values[key] : values[bare];
    return v == null ? 0 : v;
  };

  const parser = new FormulaParser({
    // fast-formula-parser ships SUM/AVERAGE/COUNT/PRODUCT/IF/ROUND/etc. but (oddly) not MIN/MAX.
    // Supply just those two aggregations so the oracle can evaluate our sample workbooks. The
    // evaluation CORE (arithmetic, precedence, ^, unary, comparisons, IF, ranges) still comes
    // from the parser, keeping it an independent check of the parts where bugs actually hide.
    functions: {
      MIN: (...params: unknown[]) => {
        const nums: number[] = [];
        FormulaHelpers.flattenParams(params, Types.NUMBER, false, (v: unknown) => {
          const n = Number(v);
          if (!isNaN(n)) nums.push(n);
        });
        return nums.length ? Math.min(...nums) : 0;
      },
      MAX: (...params: unknown[]) => {
        const nums: number[] = [];
        FormulaHelpers.flattenParams(params, Types.NUMBER, false, (v: unknown) => {
          const n = Number(v);
          if (!isNaN(n)) nums.push(n);
        });
        return nums.length ? Math.max(...nums) : 0;
      },
    },
    onCell: ({ sheet, row, col }) => lookup(sheet, row, col),
    onRange: (ref) => {
      const out: (number | string)[][] = [];
      for (let r = ref.from.row; r <= ref.to.row; r++) {
        const rowArr: (number | string)[] = [];
        for (let c = ref.from.col; c <= ref.to.col; c++) {
          rowArr.push(lookup(ref.sheet, r, c));
        }
        out.push(rowArr);
      }
      return out;
    },
  });

  // Multi-pass evaluation so formula cells that depend on other formula cells converge.
  // Passes stop early once a full pass makes no change.
  const MAX_PASSES = 10;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let changed = false;
    for (const oc of data.outputCells) {
      const key = oc.ref.toUpperCase();
      const p = parseRef(key);
      if (!p) continue;
      const position = { sheet: p.sheet ?? 'Sheet1', row: p.row, col: p.col };
      try {
        const formula = oc.formula.replace(/^=/, '');
        const result = parser.parse(formula, position);
        // fast-formula-parser returns FormulaError objects for #REF!/#VALUE! etc; skip those.
        if (typeof result === 'number' && isFinite(result)) {
          if (values[key] !== result) { values[key] = result; changed = true; }
        } else if (typeof result === 'string' || typeof result === 'boolean') {
          const asStr = String(result);
          if (values[key] !== asStr) { values[key] = asStr; changed = true; }
        }
      } catch {
        /* leave unresolved; a later pass may resolve it once dependencies fill in */
      }
    }
    if (!changed) break;
  }

  return values;
}
