import * as fs from 'fs';
import * as path from 'path';
import { buildExcelData } from './excelDataBuilder';
import { computeOracle } from './formulaOracle';
import { recomputeAll, type CellMap } from '../../../frontend/src/utils/FormulaEngine';

/**
 * Cross-check: our frontend FormulaEngine vs an INDEPENDENT oracle (fast-formula-parser, MIT).
 *
 * For each sample workbook we:
 *   1. parse it with buildExcelData (formulas + literal input values),
 *   2. compute expected values with fast-formula-parser (a separate formula engine), and
 *   3. compute the same cells with our FormulaEngine.recomputeAll, then assert they agree.
 *
 * Unlike the previous approach, this does NOT rely on the .xlsx file's cached values, so it needs
 * no spreadsheet app and no fixture regeneration — the oracle is computed in-process, works in CI,
 * and covers every workbook (including those saved without cached values). We only compare cells
 * where BOTH engines produce a finite number; text results (e.g. IF returning a label) and any
 * cells the parsers disagree on structurally are out of scope for a numeric equality check.
 */

const SAMPLE_DIR = path.resolve(__dirname, '../../../sample-excel-sheets');

function buildFormulas(cells: Record<string, any>): Record<string, string> {
  const f: Record<string, string> = {};
  for (const [ref, cell] of Object.entries<any>(cells)) {
    const raw = cell.formula || (typeof cell.value === 'string' ? cell.value : null);
    if (raw) f[ref.toUpperCase()] = raw.startsWith('=') ? raw : '=' + raw;
  }
  return f;
}

function buildDefaults(cells: Record<string, any>): CellMap {
  const d: CellMap = {};
  for (const [ref, cell] of Object.entries<any>(cells)) {
    if (!cell.formula && cell.value !== null && cell.value !== undefined && !isNaN(Number(cell.value))) {
      d[ref.toUpperCase()] = Number(cell.value);
    }
  }
  return d;
}

function listSampleWorkbooks(): string[] {
  if (!fs.existsSync(SAMPLE_DIR)) return [];
  return fs
    .readdirSync(SAMPLE_DIR)
    .filter(f => f.toLowerCase().endsWith('.xlsx') && !f.startsWith('~$'))
    .sort();
}

const workbooks = listSampleWorkbooks();

describe('cross-check: FormulaEngine vs independent oracle', () => {
  it('finds sample workbooks to test', () => {
    expect(workbooks.length).toBeGreaterThan(0);
  });

  describe.each(workbooks)('%s', (file) => {
    const data = buildExcelData(fs.readFileSync(path.join(SAMPLE_DIR, file)));
    const oracle = computeOracle(data);
    const recomputed = recomputeAll(buildDefaults(data.cells), buildFormulas(data.cells));

    it('agrees with the independent oracle on all numeric formula cells', () => {
      const mismatches: string[] = [];
      let checked = 0;

      for (const out of data.outputCells) {
        const ref = out.ref.toUpperCase();
        const expected = oracle[ref];
        const got = recomputed[ref];

        // Only assert where BOTH engines produced a finite number. If the oracle couldn't
        // evaluate it (unsupported function, text result), it isn't a fair numeric comparison.
        if (typeof expected !== 'number' || !isFinite(expected)) continue;
        if (typeof got !== 'number' || !isFinite(got)) {
          mismatches.push(`${ref}: oracle=${expected}, engine produced ${JSON.stringify(got)} (${out.formula})`);
          continue;
        }

        checked++;
        const tol = Math.max(1e-6, Math.abs(expected) * 1e-6);
        if (Math.abs(got - expected) > tol) {
          mismatches.push(`${ref}: oracle=${expected}, engine=${got} (${out.formula})`);
        }
      }

      if (mismatches.length > 0) {
        throw new Error(
          `${file}: ${mismatches.length} mismatch(es) of ${checked + mismatches.length} numeric cells:\n` +
            mismatches.slice(0, 20).join('\n')
        );
      }

      // Each workbook should have at least one numerically-verifiable formula cell; if not, the
      // oracle failed to evaluate anything and the comparison would be vacuous.
      expect(checked).toBeGreaterThan(0);
    });
  });
});
