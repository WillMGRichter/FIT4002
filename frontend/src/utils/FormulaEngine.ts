export type CellMap = Record<string, number | string>;

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

function parseCellRef(ref: string): { col: number; row: number } | null {
  const match = ref.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i);
  if (!match) return null;
  return { col: colToIndex(match[2].toUpperCase()), row: parseInt(match[4], 10) };
}

// Expand a single range like "A1:C3" into individual cell references (A1, A2, A3, B1, ...),
// or a lone cell ref like "A1" into itself.
function expandSingleRange(range: string): string[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [range];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [range];

  const cells: string[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push(`${indexToCol(c)}${r}`);
    }
  }
  return cells;
}

// Expand a comma-separated list of ranges/cells, e.g. "B1:B3,B5:B7" -> flattened cell refs,
// so a chart (or SUM/AVERAGE/etc argument) can skip cells by omitting them from the list.
export function expandRange(range: string): string[] {
  return range.split(',').flatMap(part => expandSingleRange(part.trim()));
}

function getCellValue(cellRef: string, cells: CellMap): number {
  const val = cells[cellRef.toUpperCase()];
  const num = typeof val === 'number' ? val : parseFloat(String(val));
  return isNaN(num) ? 0 : num;
}

function evaluateFunction(name: string, range: string, cells: CellMap): number {
  const refs = expandRange(range);
  const values = refs.map(r => getCellValue(r, cells));

  switch (name.toUpperCase()) {
    case 'SUM':
      return values.reduce((a, b) => a + b, 0);
    case 'AVERAGE':
    case 'AVG':
      return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    case 'MIN':
      return values.length ? Math.min(...values) : 0;
    case 'MAX':
      return values.length ? Math.max(...values) : 0;
    case 'COUNT':
      return values.filter(v => !isNaN(v)).length;
    case 'PRODUCT':
      return values.reduce((a, b) => a * b, 1);
    default:
      return 0;
  }
}

const FUNC_REGEX = /(SUM|AVERAGE|AVG|MIN|MAX|COUNT|PRODUCT)\(([^)]+)\)/gi;
const CELL_REGEX = /\$?[A-Z]+\$?\d+/gi;

function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if ('+-*/()'.includes(ch)) {
      if (buffer.trim()) tokens.push(buffer.trim());
      tokens.push(ch);
      buffer = '';
    } else {
      buffer += ch;
    }
  }
  if (buffer.trim()) tokens.push(buffer.trim());
  return tokens;
}

function applyOp(a: number, op: string, b: number): number {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/': return b === 0 ? 0 : a / b;
    default: return b;
  }
}

function precedence(op: string): number {
  if (op === '+' || op === '-') return 1;
  if (op === '*' || op === '/') return 2;
  return 0;
}

// Evaluate a tokenized infix expression using the shunting-yard algorithm.
// Supports +, -, *, / with standard operator precedence and parentheses.
function evaluateExpression(tokens: string[], cells: CellMap): number {
  const values: number[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    if (token === '(') {
      ops.push(token);
    } else if (token === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        const b = values.pop()!;
        const a = values.pop()!;
        values.push(applyOp(a, ops.pop()!, b));
      }
      ops.pop();
    } else if ('+-*/'.includes(token)) {
      while (ops.length && precedence(ops[ops.length - 1]) >= precedence(token)) {
        const b = values.pop()!;
        const a = values.pop()!;
        values.push(applyOp(a, ops.pop()!, b));
      }
      ops.push(token);
    } else {
      const num = parseFloat(token);
      values.push(isNaN(num) ? 0 : num);
    }
  }

  while (ops.length) {
    const b = values.pop()!;
    const a = values.pop()!;
    values.push(applyOp(a, ops.pop()!, b));
  }

  return values[0] || 0;
}

// Evaluate a single formula (e.g. "=A1+B2*2") against the given cell values.
// Pipeline: strip '=' -> expand range functions (SUM, AVERAGE, etc.) -> substitute cell refs -> evaluate infix expression via shunting-yard.
export function evaluateFormula(formula: string, cells: CellMap): number {
  if (!formula || !formula.toString().startsWith('=')) {
    const num = parseFloat(String(formula));
    return isNaN(num) ? 0 : num;
  }

  let expr = formula.toString().substring(1);

  expr = expr.replace(FUNC_REGEX, (_match, name: string, range: string) => {
    return String(evaluateFunction(name, range.trim(), cells));
  });

  expr = expr.replace(CELL_REGEX, (ref: string) => {
    const cleaned = ref.replace(/\$/g, '');
    return String(getCellValue(cleaned, cells));
  });

  const tokens = tokenize(expr);
  return evaluateExpression(tokens, cells);
}

export function getAllCellRefs(formula: string): string[] {
  if (!formula || !formula.toString().startsWith('=')) return [];
  const expr = formula.toString().substring(1);
  const refs: string[] = [];
  let match;
  const cellRegex = /\$?([A-Z]+)\$?(\d+)/gi;
  while ((match = cellRegex.exec(expr)) !== null) {
    const ref = match[1].toUpperCase() + match[2];
    if (!refs.includes(ref)) refs.push(ref);
  }
  return refs;
}

export function getCellDependencies(formulas: Record<string, string>): Record<string, string[]> {
  const deps: Record<string, string[]> = {};
  for (const [cellRef, formula] of Object.entries(formulas)) {
    deps[cellRef] = getAllCellRefs(formula);
  }
  return deps;
}

// Recompute all formula outputs in dependency order using topological sort.
// The cells map starts with input values; each formula is evaluated against the progressively filled map.
export function recomputeAll(
  cells: CellMap,
  formulas: Record<string, string>
): CellMap {
  const result: CellMap = { ...cells };

  const deps = getCellDependencies(formulas);
  const sorted = topologicalSort(deps);

  for (const cell of sorted) {
    const formula = formulas[cell];
    if (formula) {
      result[cell] = evaluateFormula(formula, result);
    }
  }

  return result;
}

// Topological sort so formulas are evaluated after all their dependencies.
// Uses DFS-based ordering; cycles are silently broken by skipping already-visited nodes.
function topologicalSort(deps: Record<string, string[]>): string[] {
  const visited = new Set<string>();
  const sorted: string[] = [];

  function visit(node: string, path: Set<string>) {
    if (path.has(node)) return;
    if (visited.has(node)) return;
    path.add(node);
    for (const dep of (deps[node] || [])) {
      visit(dep, path);
    }
    path.delete(node);
    visited.add(node);
    sorted.push(node);
  }

  for (const node of Object.keys(deps)) {
    visit(node, new Set());
  }

  return sorted;
}
