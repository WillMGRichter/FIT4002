import { getInputCells, getOutputCells, getTrackedCells } from '../designerCells';
import type { ExcelData } from '../../../types/simulation';

const cells: ExcelData['cells'] = {
  A10: { value: 1, formula: null, type: 'n' },
  A2: { value: 3, formula: null, type: 'n' },
  B1: { value: 10, formula: '=A2*2', type: 'n' },
  C5: { value: 7, formula: '=A10+1', type: 'n' },
};

describe('getInputCells', () => {
  it('returns [] when there is no spreadsheet', () => {
    expect(getInputCells(null)).toEqual([]);
    expect(getInputCells(undefined)).toEqual([]);
  });

  it('derives non-formula cells from the raw cells, naturally sorted (A2 before A10)', () => {
    const result = getInputCells({ cells });
    expect(result.map(c => c.ref)).toEqual(['A2', 'A10']);
    expect(result[0]).toEqual({ ref: 'A2', value: 3, title: null });
  });

  it('prefers the backend inputCells list, still sorted', () => {
    const inputCells = [
      { ref: 'A10', value: 1, title: 'Tenth' },
      { ref: 'A1', value: 5, title: 'First' },
    ];
    expect(getInputCells({ cells, inputCells }).map(c => c.ref)).toEqual(['A1', 'A10']);
  });

  it('does not reorder the project\'s own list', () => {
    const inputCells = [
      { ref: 'A10', value: 1, title: null },
      { ref: 'A1', value: 5, title: null },
    ];
    getInputCells({ cells, inputCells });
    expect(inputCells.map(c => c.ref)).toEqual(['A10', 'A1']);
  });

  it('returns [] for a spreadsheet with no cells', () => {
    expect(getInputCells({ cells: undefined as unknown as ExcelData['cells'] })).toEqual([]);
  });
});

describe('getOutputCells', () => {
  it('returns [] when there is no spreadsheet', () => {
    expect(getOutputCells(null)).toEqual([]);
  });

  it('derives formula cells from the raw cells, sorted, with empty dependencies', () => {
    const result = getOutputCells({ cells });
    expect(result.map(c => c.ref)).toEqual(['B1', 'C5']);
    expect(result[0]).toEqual({ ref: 'B1', formula: '=A2*2', title: null, dependencies: {} });
  });

  it('prefers the backend outputCells list and does not reorder it in place', () => {
    const outputCells = [
      { ref: 'B2', formula: '=1', title: 'Two', dependencies: {} },
      { ref: 'B1', formula: '=2', title: 'One', dependencies: {} },
    ];
    expect(getOutputCells({ cells, outputCells }).map(c => c.ref)).toEqual(['B1', 'B2']);
    expect(outputCells.map(c => c.ref)).toEqual(['B2', 'B1']);
  });
});

describe('getTrackedCells', () => {
  it('merges inputs and outputs, labelled by kind, in one naturally sorted list', () => {
    const rows = getTrackedCells(getInputCells({ cells }), getOutputCells({ cells }));

    expect(rows.map(r => `${r.ref}:${r.kind}`)).toEqual(['A2:Input', 'A10:Input', 'B1:Output', 'C5:Output']);
  });

  it('shows the value for inputs and the formula for outputs', () => {
    const rows = getTrackedCells(getInputCells({ cells }), getOutputCells({ cells }));

    expect(rows.find(r => r.ref === 'A2')?.display).toBe(3);
    expect(rows.find(r => r.ref === 'B1')?.display).toBe('=A2*2');
  });

  it('is empty when there is nothing to track', () => {
    expect(getTrackedCells([], [])).toEqual([]);
  });
});
