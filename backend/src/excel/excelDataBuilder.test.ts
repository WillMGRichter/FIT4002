import * as path from 'path';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { buildExcelData } from './excelDataBuilder';

/**
 * Build an in-memory .xlsx buffer from a plain description so tests are deterministic and don't
 * depend on the internals of any checked-in sample file.
 *   cells: address -> value | { f: formula, v?: cachedValue }
 */
function makeWorkbook(sheets: Record<string, Record<string, any>>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const [sheetName, cells] of Object.entries(sheets)) {
    const ws: XLSX.WorkSheet = {};
    let maxCol = 0;
    let maxRow = 0;
    for (const [addr, raw] of Object.entries(cells)) {
      const { c, r } = XLSX.utils.decode_cell(addr);
      maxCol = Math.max(maxCol, c);
      maxRow = Math.max(maxRow, r);
      if (raw && typeof raw === 'object' && 'f' in raw) {
        ws[addr] = { t: 'n', f: (raw as any).f, v: (raw as any).v ?? 0 };
      } else if (typeof raw === 'number') {
        ws[addr] = { t: 'n', v: raw };
      } else {
        ws[addr] = { t: 's', v: String(raw) };
      }
    }
    ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: maxCol, r: maxRow } });
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('buildExcelData - basic classification', () => {
  const buffer = makeWorkbook({
    Sheet1: {
      A1: 'Price',      B1: 10,
      A2: 'Quantity',   B2: 5,
      A3: 'Total',      B3: { f: 'B1*B2', v: 50 },
    },
  });
  const data = buildExcelData(buffer);

  it('reports a single sheet and multiSheet=false', () => {
    expect(data.sheets).toEqual(['Sheet1']);
    expect(data.multiSheet).toBe(false);
  });

  it('classifies literal number cells as inputs', () => {
    const refs = data.inputCells.map(c => c.ref);
    // With a single sheet, refs are bare addresses.
    expect(refs).toEqual(expect.arrayContaining(['B1', 'B2']));
  });

  it('classifies formula cells as outputs, with a leading =', () => {
    const total = data.outputCells.find(c => c.ref === 'B3');
    expect(total).toBeDefined();
    expect(total!.formula).toBe('=B1*B2');
  });

  it('derives titles from the label to the left', () => {
    const price = data.inputCells.find(c => c.ref === 'B1');
    const total = data.outputCells.find(c => c.ref === 'B3');
    expect(price!.title).toBe('Price');
    expect(total!.title).toBe('Total');
  });

  it('extracts formula dependencies for output cells', () => {
    const total = data.outputCells.find(c => c.ref === 'B3');
    expect(Object.keys(total!.dependencies).sort()).toEqual(['B1', 'B2']);
  });
});

describe('buildExcelData - multi-sheet', () => {
  const buffer = makeWorkbook({
    Sales: {
      A1: 'Revenue', B1: 200,
    },
    Summary: {
      A1: 'Total', B1: { f: 'Sales!B1*2', v: 400 },
    },
  });
  const data = buildExcelData(buffer);

  it('reports multiSheet=true and both sheet names', () => {
    expect(data.multiSheet).toBe(true);
    expect(data.sheets).toEqual(expect.arrayContaining(['Sales', 'Summary']));
  });

  it('qualifies cell refs with the sheet name', () => {
    const refs = Object.keys(data.cells);
    expect(refs).toEqual(expect.arrayContaining(['SALES!B1', 'SUMMARY!B1']));
  });

  it('keeps cross-sheet references in output formulas', () => {
    const total = data.outputCells.find(c => c.ref === 'SUMMARY!B1');
    expect(total).toBeDefined();
    expect(total!.formula).toContain('SALES!B1');
  });
});

describe('buildExcelData - overridable formula inputs', () => {
  // B7 is a formula (=B1*B2) that C1 depends on (=B7+1). buildExcelData should expose B7 as an
  // overridable input in addition to being an output, so a student can pin it.
  const buffer = makeWorkbook({
    Sheet1: {
      A1: 'Price',  B1: 10,
      A2: 'Qty',    B2: 4,
      A3: 'Net',    B7: { f: 'B1*B2', v: 40 },
      A4: 'Final',  C1: { f: 'B7+1', v: 41 },
    },
  });
  const data = buildExcelData(buffer);

  it('exposes the depended-upon formula cell as an overridable input', () => {
    const b7 = data.inputCells.find(c => c.ref === 'B7');
    expect(b7).toBeDefined();
    expect(b7!.overridable).toBe(true);
    expect(b7!.formula).toBe('=B1*B2');
  });

  it('still lists that cell as an output too', () => {
    expect(data.outputCells.some(c => c.ref === 'B7')).toBe(true);
  });

  it('does not mark a plain literal input as overridable', () => {
    const b1 = data.inputCells.find(c => c.ref === 'B1');
    expect(b1).toBeDefined();
    expect(b1!.overridable).toBeFalsy();
  });
});

describe('buildExcelData - sample workbook invariants', () => {
  const samplePath = path.resolve(__dirname, '../../../sample-excel-sheets/06_payroll_if_formulas.xlsx');

  // Guard: only run if the sample file is present (it is checked into the repo).
  const exists = fs.existsSync(samplePath);
  const maybe = exists ? it : it.skip;

  maybe('parses a real sample workbook into a valid ExcelData shape', () => {
    const data = buildExcelData(fs.readFileSync(samplePath));
    expect(Array.isArray(data.sheets)).toBe(true);
    expect(data.sheets.length).toBeGreaterThan(0);
    // Every output cell must carry a formula that starts with '='.
    for (const out of data.outputCells) {
      expect(typeof out.formula).toBe('string');
      expect(out.formula.startsWith('=')).toBe(true);
    }
    // A ref may legitimately appear in BOTH sets: a formula cell that other formulas depend on
    // is exposed as an "overridable" input as well as an output. Any such overlap MUST be
    // flagged overridable and carry a formula; pure literal inputs must never be outputs.
    const outRefs = new Set(data.outputCells.map(c => c.ref));
    for (const inp of data.inputCells) {
      if (outRefs.has(inp.ref)) {
        expect(inp.overridable).toBe(true);
        expect(typeof inp.formula).toBe('string');
      }
    }
  });
});
