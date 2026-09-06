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

// A cell reference may be sheet-qualified (multi-sheet workbooks), e.g. "SALES!B3".
// This splits an optional "SHEET!" prefix from the bare "B3" portion.
function splitSheetRef(ref: string): { sheet: string; cell: string } {
  const bangIdx = ref.lastIndexOf('!');
  if (bangIdx === -1) return { sheet: '', cell: ref };
  return { sheet: ref.slice(0, bangIdx + 1), cell: ref.slice(bangIdx + 1) };
}

function parseCellRef(ref: string): { col: number; row: number } | null {
  const { cell } = splitSheetRef(ref);
  const match = cell.match(/^(\$?)([A-Z]+)(\$?)(\d+)$/i);
  if (!match) return null;
  return { col: colToIndex(match[2].toUpperCase()), row: parseInt(match[4], 10) };
}

// Expand a single range like "A1:C3" into individual cell references (A1, A2, A3, B1, ...),
// or a lone cell ref like "A1" into itself. Preserves a sheet prefix on the range,
// e.g. "SALES!B4:B7" -> ["SALES!B4", "SALES!B5", ...].
function expandSingleRange(range: string): string[] {
  const parts = range.split(':');
  if (parts.length !== 2) return [range];
  const start = parseCellRef(parts[0]);
  const end = parseCellRef(parts[1]);
  if (!start || !end) return [range];

  // Carry the sheet prefix from the start of the range onto each expanded cell.
  const { sheet } = splitSheetRef(parts[0].trim());

  const cells: string[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      cells.push(`${sheet}${indexToCol(c)}${r}`);
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

function getCellRawValue(cellRef: string, cells: CellMap): number | string {
  const val = cells[cellRef.toUpperCase()];
  if (val === undefined || val === null) return 0;
  return val;
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
// Matches a cell ref with an optional sheet prefix, e.g. "B3" or "SALES!B3".
const CELL_REGEX = /(?:[A-Za-z0-9_]+!)?\$?[A-Z]+\$?\d+/gi;

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
// Pipeline: strip '=' -> handle IF -> expand range functions (SUM, AVERAGE, etc.) -> substitute cell refs -> evaluate infix expression via shunting-yard.
export function evaluateFormula(formula: string, cells: CellMap): number | string {
  if (!formula || !formula.toString().startsWith('=')) {
    const num = parseFloat(String(formula));
    return isNaN(num) ? String(formula) : num;
  }

  let expr = formula.toString().substring(1);

  // Handle a formula that is ENTIRELY a single IF(...) (may return text, e.g. "Profit").
  // Only take this path when nothing follows the IF's closing paren; otherwise the IF is
  // just one operand of a larger expression (e.g. "IF(...)+2") and is handled below.
  if (expr.trim().toUpperCase().startsWith('IF(')) {
    const inner = extractParenContent(expr.trim(), 2);
    if (inner !== null) {
      const openIdx = expr.trim().indexOf('(');
      const spanLen = openIdx + 1 + inner.length + 1; // through the closing ')'
      const isWholeExpr = expr.trim().length === spanLen;
      if (isWholeExpr) {
        const ifResult = tryEvaluateIf(expr, cells);
        if (ifResult !== null) return ifResult;
      }
    }
  }

  // Resolve any IF(...) that appears as a SUB-expression (e.g. "B5*IF(B7=1,0.9,1)")
  // by evaluating each embedded IF to its value before the arithmetic pipeline runs.
  expr = replaceEmbeddedIfs(expr, cells);

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

// Find each IF(...) sub-expression, evaluate it, and splice its result back into
// the expression. Handles nested IFs (via tryEvaluateIf's recursion into the chosen
// branch) and multiple independent IFs in one formula. Numeric results are inserted
// bare so the arithmetic pipeline can consume them; string results are quoted.
function replaceEmbeddedIfs(expr: string, cells: CellMap): string {
  let result = expr;
  // Guard against pathological input; each pass resolves at least one IF.
  for (let guard = 0; guard < 100; guard++) {
    // Match "IF(" only when IF is immediately followed by "(" (excludes IFERROR etc.)
    const match = /\bIF\s*\(/i.exec(result);
    if (!match) break;

    const start = match.index;
    const content = extractParenContent(result, start + 1);
    if (content === null) break; // unbalanced; leave as-is

    // Reconstruct the full "IF(...)" span to know how much to replace.
    const openIdx = result.indexOf('(', start);
    const closeIdx = openIdx + 1 + content.length; // ')' position
    const ifSpan = result.substring(start, closeIdx + 1);

    const value = tryEvaluateIf(ifSpan, cells);
    if (value === null) break; // not a valid IF; avoid infinite loop

    const inserted = typeof value === 'number' ? String(value) : `"${value}"`;
    result = result.substring(0, start) + inserted + result.substring(closeIdx + 1);
  }
  return result;
}

// Parse IF(condition, trueValue, falseValue) with support for nested IFs and string literals
function tryEvaluateIf(expr: string, cells: CellMap): number | string | null {
  const trimmed = expr.trim();
  if (!trimmed.toUpperCase().startsWith('IF(')) return null;

  // Extract the content inside IF(...)
  const inner = extractParenContent(trimmed, 2);
  if (inner === null) return null;

  // Split into 3 arguments by commas, respecting nesting and quotes
  const args = splitIfArgs(inner);
  if (args.length < 3) return null;

  const condition = evaluateCondition(args[0].trim(), cells);
  const branch = condition ? args[1].trim() : args[2].trim();

  return evaluateIfBranch(branch, cells);
}

// Extract content inside parentheses starting at position startIdx
function extractParenContent(str: string, startIdx: number): string | null {
  const openIdx = str.indexOf('(', startIdx);
  if (openIdx === -1) return null;

  let depth = 0;
  for (let i = openIdx; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return str.substring(openIdx + 1, i);
    }
  }
  return null;
}

// Split IF arguments respecting nested parentheses and quoted strings
function splitIfArgs(str: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inQuote = false;
  let quoteChar = '';
  let current = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (inQuote) {
      current += ch;
      if (ch === quoteChar) inQuote = false;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      current += ch;
    } else if (ch === ',' && depth === 0) {
      args.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) args.push(current);
  return args;
}

// Evaluate a condition like "B1=1", "B1>2", "B1<>0"
function evaluateCondition(condition: string, cells: CellMap): boolean {
  // Support operators: =, <>, >=, <=, >, <
  const operators = ['<>', '>=', '<=', '>', '<', '='];
  for (const op of operators) {
    const idx = condition.indexOf(op);
    if (idx !== -1) {
      const left = resolveValue(condition.substring(0, idx).trim(), cells);
      const right = resolveValue(condition.substring(idx + op.length).trim(), cells);
      const leftNum = typeof left === 'number' ? left : parseFloat(String(left));
      const rightNum = typeof right === 'number' ? right : parseFloat(String(right));

      switch (op) {
        case '=': return leftNum === rightNum || String(left) === String(right);
        case '<>': return leftNum !== rightNum && String(left) !== String(right);
        case '>=': return leftNum >= rightNum;
        case '<=': return leftNum <= rightNum;
        case '>': return leftNum > rightNum;
        case '<': return leftNum < rightNum;
      }
    }
  }
  return false;
}

// Resolve a value - could be a cell ref, number, or quoted string
function resolveValue(val: string, cells: CellMap): number | string {
  // Quoted string
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    return val.slice(1, -1);
  }
  // Number literal
  const num = parseFloat(val);
  if (!isNaN(num) && val.match(/^-?\d*\.?\d+$/)) return num;
  // Cell reference (optionally sheet-qualified, e.g. SALES!B3)
  if (val.match(/^(?:[A-Za-z0-9_]+!)?\$?[A-Z]+\$?\d+$/i)) {
    return getCellRawValue(val.replace(/\$/g, ''), cells);
  }
  return val;
}

// Evaluate an IF branch - could be a nested IF, a string literal, a number, or a cell ref
function evaluateIfBranch(branch: string, cells: CellMap): number | string {
  const trimmed = branch.trim();

  // Nested IF
  if (trimmed.toUpperCase().startsWith('IF(')) {
    const result = tryEvaluateIf(trimmed, cells);
    if (result !== null) return result;
  }

  // Quoted string literal
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }

  // Number literal
  const num = parseFloat(trimmed);
  if (!isNaN(num) && trimmed.match(/^-?\d*\.?\d+$/)) return num;

  // Cell reference (optionally sheet-qualified, e.g. SALES!B3)
  if (trimmed.match(/^(?:[A-Za-z0-9_]+!)?\$?[A-Z]+\$?\d+$/i)) {
    return getCellRawValue(trimmed.replace(/\$/g, ''), cells);
  }

  // Expression - evaluate numerically
  const formula = '=' + trimmed;
  return evaluateFormula(formula, cells);
}

export function getAllCellRefs(formula: string): string[] {
  if (!formula || !formula.toString().startsWith('=')) return [];
  const expr = formula.toString().substring(1);
  const refs: string[] = [];
  let match;
  // Capture an optional sheet prefix so dependency keys match the qualified
  // keys used in the formulas map (e.g. "SALES!B3") for multi-sheet workbooks.
  const cellRegex = /((?:[A-Za-z0-9_]+!)?)\$?([A-Z]+)\$?(\d+)/gi;
  while ((match = cellRegex.exec(expr)) !== null) {
    const ref = (match[1] || '').toUpperCase() + match[2].toUpperCase() + match[3];
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
