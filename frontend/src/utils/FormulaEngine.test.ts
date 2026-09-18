import {
  evaluateFormula,
  expandRange,
  getAllCellRefs,
  getCellDependencies,
  recomputeAll,
  getTransitiveDependencies,
  type CellMap,
} from './FormulaEngine';

describe('evaluateFormula - literals and non-formula input', () => {
  it('returns a number for a numeric non-formula string', () => {
    expect(evaluateFormula('42', {})).toBe(42);
  });

  it('returns the string for a non-numeric non-formula string', () => {
    expect(evaluateFormula('hello', {})).toBe('hello');
  });

  it('parses a leading-= numeric literal', () => {
    expect(evaluateFormula('=7', {})).toBe(7);
  });
});

describe('evaluateFormula - arithmetic and precedence', () => {
  it('adds and subtracts', () => {
    expect(evaluateFormula('=2+3-1', {})).toBe(4);
  });

  it('respects multiplication precedence over addition', () => {
    expect(evaluateFormula('=2+3*4', {})).toBe(14);
  });

  it('honours parentheses', () => {
    expect(evaluateFormula('=(2+3)*4', {})).toBe(20);
  });

  it('divides', () => {
    expect(evaluateFormula('=10/4', {})).toBe(2.5);
  });
});

describe('evaluateFormula - power operator (^)', () => {
  it('evaluates a simple power', () => {
    expect(evaluateFormula('=2^3', {})).toBe(8);
  });

  it('binds tighter than multiplication', () => {
    expect(evaluateFormula('=2*3^2', {})).toBe(18);
  });

  it('is right-associative', () => {
    expect(evaluateFormula('=2^3^2', {})).toBe(512);
  });
});

describe('evaluateFormula - unary minus/plus', () => {
  it('handles a leading unary minus', () => {
    expect(evaluateFormula('=-5+3', {})).toBe(-2);
  });

  it('handles unary minus after an operator', () => {
    expect(evaluateFormula('=3*-2', {})).toBe(-6);
  });

  // Excel semantics: unary minus binds tighter than ^, so -2^2 = (-2)^2 = 4.
  it('binds unary minus tighter than power (Excel semantics)', () => {
    expect(evaluateFormula('=-2^2', {})).toBe(4);
  });
});

describe('evaluateFormula - cell references', () => {
  it('resolves a single cell reference', () => {
    const cells: CellMap = { A1: 10, B1: 5 };
    expect(evaluateFormula('=A1+B1', cells)).toBe(15);
  });

  it('resolves $-anchored references', () => {
    const cells: CellMap = { A1: 4 };
    expect(evaluateFormula('=$A$1*2', cells)).toBe(8);
  });

  it('resolves cross-sheet references', () => {
    const cells: CellMap = { 'SALES!B3': 100, 'COSTS!B3': 40 };
    expect(evaluateFormula('=SALES!B3-COSTS!B3', cells)).toBe(60);
  });

  it('treats a missing numeric cell as 0', () => {
    expect(evaluateFormula('=A1+5', {})).toBe(5);
  });
});

describe('evaluateFormula - functions', () => {
  const cells: CellMap = { A1: 1, A2: 2, A3: 3, A4: 4 };

  it('SUM over a range', () => {
    expect(evaluateFormula('=SUM(A1:A4)', cells)).toBe(10);
  });

  it('AVERAGE over a range', () => {
    expect(evaluateFormula('=AVERAGE(A1:A4)', cells)).toBe(2.5);
  });

  it('MIN and MAX', () => {
    expect(evaluateFormula('=MIN(A1:A4)', cells)).toBe(1);
    expect(evaluateFormula('=MAX(A1:A4)', cells)).toBe(4);
  });

  it('COUNT', () => {
    expect(evaluateFormula('=COUNT(A1:A4)', cells)).toBe(4);
  });

  it('PRODUCT', () => {
    expect(evaluateFormula('=PRODUCT(A1:A4)', cells)).toBe(24);
  });

  it('function embedded in arithmetic', () => {
    expect(evaluateFormula('=SUM(A1:A4)*2', cells)).toBe(20);
  });

  it('accepts a literal argument alongside a cell/expression (MAX floor-at-zero)', () => {
    // Excel pattern: clamp a computed value to >= 0.
    expect(evaluateFormula('=MAX(0,A1-A4)', { A1: 2, A4: 5 })).toBe(0); // 2-5=-3 -> 0
    expect(evaluateFormula('=MAX(0,A4-A1)', { A1: 2, A4: 5 })).toBe(3); // 5-2=3
  });

  it('accepts an expression argument (product) inside MAX/MIN', () => {
    expect(evaluateFormula('=MAX(0,A1*A2)', { A1: 4, A2: 3 })).toBe(12);
    expect(evaluateFormula('=MIN(100,A1*A2)', { A1: 4, A2: 3 })).toBe(12);
    expect(evaluateFormula('=MIN(5,A1*A2)', { A1: 4, A2: 3 })).toBe(5);
  });

  it('SUM/PRODUCT accept mixed literal, ref, and expression args', () => {
    expect(evaluateFormula('=SUM(1,A1,A2*2)', { A1: 10, A2: 5 })).toBe(21); // 1 + 10 + 10
    expect(evaluateFormula('=PRODUCT(2,A1)', { A1: 6 })).toBe(12);
  });

  it('still supports plain range aggregation', () => {
    expect(evaluateFormula('=SUM(A1:A4)', cells)).toBe(10);
    expect(evaluateFormula('=MAX(A1:A4)', cells)).toBe(4);
  });
});

describe('evaluateFormula - IF', () => {
  it('returns the true branch (number)', () => {
    expect(evaluateFormula('=IF(A1>5,10,20)', { A1: 6 })).toBe(10);
  });

  it('returns the false branch (number)', () => {
    expect(evaluateFormula('=IF(A1>5,10,20)', { A1: 4 })).toBe(20);
  });

  it('returns text results', () => {
    expect(evaluateFormula('=IF(A1>=20,"Healthy","At Risk")', { A1: 25 })).toBe('Healthy');
    expect(evaluateFormula('=IF(A1>=20,"Healthy","At Risk")', { A1: 10 })).toBe('At Risk');
  });

  it('supports the various comparison operators', () => {
    expect(evaluateFormula('=IF(A1=5,1,0)', { A1: 5 })).toBe(1);
    expect(evaluateFormula('=IF(A1<>5,1,0)', { A1: 5 })).toBe(0);
    expect(evaluateFormula('=IF(A1<=5,1,0)', { A1: 5 })).toBe(1);
    expect(evaluateFormula('=IF(A1>=5,1,0)', { A1: 5 })).toBe(1);
  });

  it('nests IFs', () => {
    const f = '=IF(A1>=40,"Excellent",IF(A1>=20,"Healthy","At Risk"))';
    expect(evaluateFormula(f, { A1: 45 })).toBe('Excellent');
    expect(evaluateFormula(f, { A1: 30 })).toBe('Healthy');
    expect(evaluateFormula(f, { A1: 5 })).toBe('At Risk');
  });

  it('supports an IF embedded inside arithmetic', () => {
    // base * discount-factor
    expect(evaluateFormula('=100*IF(A1=1,0.9,1)', { A1: 1 })).toBe(90);
    expect(evaluateFormula('=100*IF(A1=1,0.9,1)', { A1: 2 })).toBe(100);
  });
});

describe('expandRange', () => {
  it('expands a vertical range', () => {
    expect(expandRange('A1:A3')).toEqual(['A1', 'A2', 'A3']);
  });

  it('expands a horizontal range', () => {
    expect(expandRange('A1:C1')).toEqual(['A1', 'B1', 'C1']);
  });

  it('expands a rectangular range in row-major order', () => {
    expect(expandRange('A1:B2')).toEqual(['A1', 'B1', 'A2', 'B2']);
  });

  it('expands comma-separated parts', () => {
    expect(expandRange('A1:A2, B5')).toEqual(['A1', 'A2', 'B5']);
  });
});

describe('getAllCellRefs / getCellDependencies', () => {
  it('extracts unique refs from a formula', () => {
    expect(getAllCellRefs('=A1+B2*A1')).toEqual(['A1', 'B2']);
  });

  it('extracts sheet-qualified refs', () => {
    expect(getAllCellRefs('=SALES!B3+COSTS!B3')).toEqual(['SALES!B3', 'COSTS!B3']);
  });

  it('returns [] for a non-formula', () => {
    expect(getAllCellRefs('42')).toEqual([]);
  });

  it('builds a dependency map', () => {
    const deps = getCellDependencies({ B1: '=A1+A2', C1: '=B1*2' });
    expect(deps).toEqual({ B1: ['A1', 'A2'], C1: ['B1'] });
  });
});

describe('getTransitiveDependencies', () => {
  const formulas = { C1: '=B1+A3', B1: '=A1*A2' };

  it('collects direct and indirect dependencies', () => {
    const deps = getTransitiveDependencies('C1', formulas);
    expect(deps).toEqual(new Set(['B1', 'A1', 'A2', 'A3']));
  });

  it('returns an empty set for a cell with no formula', () => {
    expect(getTransitiveDependencies('Z9', formulas)).toEqual(new Set());
  });
});

describe('recomputeAll', () => {
  it('computes formulas in dependency order', () => {
    const cells: CellMap = { A1: 2, A2: 3 };
    const formulas = { B1: '=A1+A2', C1: '=B1*10' };
    const result = recomputeAll(cells, formulas);
    expect(result.B1).toBe(5);
    expect(result.C1).toBe(50);
  });

  it('recomputes when an input cell changes', () => {
    const formulas = { B1: '=A1*2' };
    expect(recomputeAll({ A1: 5 }, formulas).B1).toBe(10);
    expect(recomputeAll({ A1: 8 }, formulas).B1).toBe(16);
  });

  it('honours an override: a pinned formula cell keeps its value and dependents use it', () => {
    // B7 is normally =A1*10; overriding it to 55 should make C1 (=B7+1) use 55.
    const cells: CellMap = { A1: 3, B7: 55 };
    const formulas = { B7: '=A1*10', C1: '=B7+1' };
    const overrides = new Set(['B7']);
    const result = recomputeAll(cells, formulas, overrides);
    expect(result.B7).toBe(55);
    expect(result.C1).toBe(56);
  });

  it('ignores a stale value when the cell is NOT flagged as an override', () => {
    // Same setup but no override -> B7 recomputes from its formula (30), ignoring the 55.
    const cells: CellMap = { A1: 3, B7: 55 };
    const formulas = { B7: '=A1*10', C1: '=B7+1' };
    const result = recomputeAll(cells, formulas);
    expect(result.B7).toBe(30);
    expect(result.C1).toBe(31);
  });

  it('preserves text results from IF formulas', () => {
    const cells: CellMap = { A1: 10 };
    const formulas = { B1: '=IF(A1>=20,"Healthy","At Risk")' };
    expect(recomputeAll(cells, formulas).B1).toBe('At Risk');
  });
});
