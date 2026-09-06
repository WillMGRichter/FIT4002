/**
 * Builds a comprehensive multi-sheet test workbook that exercises every feature
 * currently supported by SmartSim:
 *   - Multiple sheets (Inputs, Projections, Summary)
 *   - Cross-sheet references (Projections -> Inputs, Summary -> Projections)
 *   - Absolute references ($B$2)
 *   - IF formulas (incl. nested IF) for categorical/table outputs
 *   - Range functions: SUM / AVERAGE / MIN / MAX / COUNT (for table + chart outputs)
 *   - Dropdown-style single-cell numeric inputs
 *   - Label-to-the-left convention so the backend derives cell titles
 *
 * Run from the backend dir (where `xlsx` is installed):
 *   cd backend && node ../scripts/build-comprehensive-test.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

const OUT = path.resolve(__dirname, '../sample-excel-sheets/comprehensive-test.xlsx');

// Helper: set a cell with an optional formula (and a cached value).
function cell(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}

function setRange(ws, ref) {
  ws['!ref'] = ref;
}

const wb = XLSX.utils.book_new();

/* ------------------------------------------------------------------ *
 * Sheet 1: Inputs  — the values a student would tweak (incl. dropdowns)
 * ------------------------------------------------------------------ */
const inputs = {};
cell(inputs, 'A1', 'Inputs');
cell(inputs, 'A2', 'Starting Customers'); cell(inputs, 'B2', 1000);
cell(inputs, 'A3', 'Monthly Growth Rate'); cell(inputs, 'B3', 0.08);
cell(inputs, 'A4', 'Revenue per Customer'); cell(inputs, 'B4', 75);
cell(inputs, 'A5', 'Monthly Fixed Costs'); cell(inputs, 'B5', 42000);
cell(inputs, 'A6', 'Marketing Tier (1-3)'); cell(inputs, 'B6', 2); // dropdown-style input
cell(inputs, 'A7', 'Discount Applied? (0/1)'); cell(inputs, 'B7', 1); // dropdown-style input
setRange(inputs, 'A1:B7');
XLSX.utils.book_append_sheet(wb, inputs, 'Inputs');

/* ------------------------------------------------------------------ *
 * Sheet 2: Projections — per-month model using cross-sheet + absolute refs,
 *          IF logic, and growth chains. 6 months, columns:
 *          A Month | B Customers | C Revenue | D Costs | E Profit | F Status
 * ------------------------------------------------------------------ */
const proj = {};
cell(proj, 'A1', 'Projections');
cell(proj, 'A3', 'Month');
cell(proj, 'B3', 'Customers');
cell(proj, 'C3', 'Revenue');
cell(proj, 'D3', 'Costs');
cell(proj, 'E3', 'Profit');
cell(proj, 'F3', 'Status');

const MONTHS = 6;
for (let i = 0; i < MONTHS; i++) {
  const row = 4 + i;
  const month = i + 1;
  cell(proj, `A${row}`, month);

  // Customers: month 1 pulls Starting Customers from Inputs (absolute ref);
  // later months grow by the monthly growth rate (cross-sheet absolute ref).
  if (i === 0) {
    cell(proj, `B${row}`, 1000, `Inputs!$B$2`);
  } else {
    cell(proj, `B${row}`, 0, `B${row - 1}*(1+Inputs!$B$3)`);
  }

  // Revenue = Customers * Revenue per Customer, with a marketing multiplier
  // driven by the Marketing Tier (nested IF), cross-sheet absolute ref for price.
  cell(
    proj,
    `C${row}`,
    0,
    `B${row}*Inputs!$B$4*IF(Inputs!$B$6=3,1.2,IF(Inputs!$B$6=2,1.1,1))`
  );

  // Costs = fixed costs (cross-sheet), reduced 10% when discount applied.
  cell(proj, `D${row}`, 0, `Inputs!$B$5*IF(Inputs!$B$7=1,0.9,1)`);

  // Profit = Revenue - Costs (same-sheet refs)
  cell(proj, `E${row}`, 0, `C${row}-D${row}`);

  // Status = IF(Profit>0,"Profit",IF(Profit=0,"Break-even","Loss"))
  cell(proj, `F${row}`, '', `IF(E${row}>0,"Profit",IF(E${row}=0,"Break-even","Loss"))`);
}
setRange(proj, `A1:F${3 + MONTHS}`);
XLSX.utils.book_append_sheet(wb, proj, 'Projections');

/* ------------------------------------------------------------------ *
 * Sheet 3: Summary — range aggregates over the Projections sheet.
 *          Exercises SUM / AVERAGE / MIN / MAX / COUNT across a cross-sheet
 *          range. These are ideal table + chart outputs.
 * ------------------------------------------------------------------ */
const summary = {};
cell(summary, 'A1', 'Summary');
cell(summary, 'A2', 'Total Revenue'); cell(summary, 'B2', 0, `SUM(Projections!C4:C${3 + MONTHS})`);
cell(summary, 'A3', 'Total Costs'); cell(summary, 'B3', 0, `SUM(Projections!D4:D${3 + MONTHS})`);
cell(summary, 'A4', 'Total Profit'); cell(summary, 'B4', 0, `SUM(Projections!E4:E${3 + MONTHS})`);
cell(summary, 'A5', 'Average Monthly Profit'); cell(summary, 'B5', 0, `AVERAGE(Projections!E4:E${3 + MONTHS})`);
cell(summary, 'A6', 'Best Month Profit'); cell(summary, 'B6', 0, `MAX(Projections!E4:E${3 + MONTHS})`);
cell(summary, 'A7', 'Worst Month Profit'); cell(summary, 'B7', 0, `MIN(Projections!E4:E${3 + MONTHS})`);
cell(summary, 'A8', 'Months Modelled'); cell(summary, 'B8', 0, `COUNT(Projections!A4:A${3 + MONTHS})`);
cell(summary, 'A9', 'Ending Customers'); cell(summary, 'B9', 0, `Projections!B${3 + MONTHS}`);
// A profitability verdict combining two cross-sheet aggregates via nested IF.
cell(summary, 'A10', 'Overall Verdict');
cell(summary, 'B10', '', `IF(B4>0,"Profitable",IF(B4=0,"Neutral","Unprofitable"))`);
setRange(summary, 'A1:B10');
XLSX.utils.book_append_sheet(wb, summary, 'Summary');

XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
console.log('Sheets:', wb.SheetNames.join(', '));
