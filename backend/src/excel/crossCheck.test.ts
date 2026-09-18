import * as fs from 'fs';
import * as path from 'path';
import { buildExcelData } from './excelDataBuilder';
import { recomputeAll, type CellMap } from '../../../frontend/src/utils/FormulaEngine';

/**
 * Cached-vs-recomputed cross-check.
 *
 * For each sample workbook we:
 *   1. parse it with the BACKEND buildExcelData (which carries Excel's cached values), then
 *   2. rebuild the exact {formulas, defaultCells} inputs the FRONTEND feeds to recomputeAll
 *      (see StudentSimulationView), and
 *   3. run the FRONTEND FormulaEngine over them.
 *
 * Every numeric output cell's recomputed value must match Excel's cached value. This is the
 * core correctness contract: our client-side engine must reproduce what Excel computed, across
 * real workbooks, not just hand-written cases.
 */

const SAMPLE_DIR = path.resolve(__dirname, '../../../sample-excel-sheets');

// Replicate StudentSimulationView's formulas map: ref(upper) -> formula (leading '=').
function buildFormulas(cells: Record<string, any>): Record<string, string> {
  const f: Record<string, string> = {};
  for (const [ref, cell] of Object.entries<any>(cells)) {
    const raw = cell.formula || (typeof cell.value === 'string' ? cell.value : null);
    if (raw) {
      f[ref.toUpperCase()] = raw.startsWith('=') ? raw : '=' + raw;
    }
  }
  return f;
}

// Replicate StudentSimulationView's defaultCells: non-formula numeric seeds.
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

describe('cached-vs-recomputed cross-check', () => {
  it('finds sample workbooks to test', () => {
    expect(workbooks.length).toBeGreaterThan(0);
  });

  describe.each(workbooks)('%s', (file) => {
    const data = buildExcelData(fs.readFileSync(path.join(SAMPLE_DIR, file)));
    const formulas = buildFormulas(data.cells);
    const defaults = buildDefaults(data.cells);
    const recomputed = recomputeAll(defaults, formulas);

    // Collect the numeric cached outputs that can serve as an oracle.
    const numericOutputs = data.outputCells.filter(
      o => typeof o.value === 'number' && isFinite(o.value)
    );
    // A workbook is only a valid oracle if Excel actually saved computed values. Some sample
    // files were generated without a calc-on-save pass, so their formula cells are cached as 0
    // (or dropped entirely). Comparing against those would test the fixture, not the engine.
    const zeroCached = numericOutputs.filter(o => o.value === 0).length;
    const usable =
      numericOutputs.length > 0 && zeroCached / numericOutputs.length <= 0.5;

    const maybe = usable ? it : it.skip;

    maybe('recomputes numeric outputs to match Excel cached values', () => {
      const mismatches: string[] = [];
      let checked = 0;

      for (const out of numericOutputs) {
        const ref = out.ref.toUpperCase();
        const cached = out.value as number;

        const got = recomputed[ref];
        if (typeof got !== 'number' || !isFinite(got)) {
          mismatches.push(`${ref}: expected ${cached}, engine produced ${JSON.stringify(got)}`);
          continue;
        }

        checked++;
        // Relative tolerance for float rounding; absolute floor for values near zero.
        const tol = Math.max(1e-6, Math.abs(cached) * 1e-6);
        if (Math.abs(got - cached) > tol) {
          mismatches.push(`${ref}: expected ${cached}, got ${got}`);
        }
      }

      if (mismatches.length > 0) {
        throw new Error(
          `${file}: ${mismatches.length} mismatch(es) out of ${checked + mismatches.length} numeric outputs:\n` +
            mismatches.slice(0, 20).join('\n')
        );
      }

      // Guard against a vacuous pass.
      expect(checked).toBeGreaterThan(0);
    });
  });
});
