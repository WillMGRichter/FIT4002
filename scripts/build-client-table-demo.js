/**
 * Builds a clean single-sheet sales workbook derived from ClientSample.xlsx,
 * restructured so the TABLE OUTPUT renders meaningfully (each row = one month
 * with a proper left-hand label).
 *
 * Fixes applied vs the original ClientSample.xlsx:
 *   - "Monthly gross" relabelled to "Monthly Growth Rate" (it is a rate, 0.2).
 *   - Dropped the dangling Sheet2 (=Sheet2!A2 pointed at an empty cell -> 0).
 *   - Laid the projection out as rows (Month down, metrics across) with row
 *     labels in column A, so findTitle() gives each output cell a real label.
 *
 * Assumptions (unchanged from the source):
 *   Units grow by Monthly Growth Rate each month; Revenue = Units x Price;
 *   Cost = Units x CostPerItem; Profit = Revenue - Cost.
 *
 * Run:  cd backend && node ../scripts/build-client-table-demo.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

const OUT = path.resolve(__dirname, '../sample-excel-sheets/client-table-demo.xlsx');

function cell(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}

// ---- Assumptions block (inputs) ----
const volume = 5000;     // B1 Sales volume (units, month 1)
const price = 5;         // B2 Sale price ($)
const growth = 0.2;      // B3 Monthly growth rate
const costPerItem = 2;   // B4 Cost per item ($)

// ---- Compute cached values for a 3-month projection ----
const months = ['August', 'September', 'October'];
const rows = months.map((mn, i) => {
  const units = volume * Math.pow(1 + growth, i);
  const revenue = units * price;
  const cost = units * costPerItem;
  const profit = revenue - cost;
  return { mn, units, revenue, cost, profit };
});

const ws = {};
// Assumptions (col A label, col B value) — these are the inputs.
cell(ws, 'A1', 'Sales Volume (month 1)'); cell(ws, 'B1', volume);
cell(ws, 'A2', 'Sale Price ($)');         cell(ws, 'B2', price);
cell(ws, 'A3', 'Monthly Growth Rate');    cell(ws, 'B3', growth);
cell(ws, 'A4', 'Cost per Item ($)');      cell(ws, 'B4', costPerItem);

// Projection table header row (row 6): A=Month label col, B..E metrics
cell(ws, 'A6', 'Month');
cell(ws, 'B6', 'Units');
cell(ws, 'C6', 'Revenue');
cell(ws, 'D6', 'Cost');
cell(ws, 'E6', 'Profit');

// Data rows 7,8,9 — one month per row. Column A holds the month label so the
// table output shows "August / September / October" as each row's label.
rows.forEach((r, i) => {
  const row = 7 + i;
  cell(ws, `A${row}`, r.mn);
  // Units: month 1 = B1; later months = previous units * (1 + growth)
  if (i === 0) {
    cell(ws, `B${row}`, r.units, 'B1');
  } else {
    cell(ws, `B${row}`, r.units, `B${row - 1}*(1+$B$3)`);
  }
  cell(ws, `C${row}`, r.revenue, `B${row}*$B$2`);
  cell(ws, `D${row}`, r.cost, `B${row}*$B$4`);
  cell(ws, `E${row}`, r.profit, `C${row}-D${row}`);
});

// A totals row (row 10) exercising SUM across the profit column.
cell(ws, 'A10', 'Total Profit');
cell(ws, 'E10', rows.reduce((s, r) => s + r.profit, 0), 'SUM(E7:E9)');

// ---- Clean "Monthly Profit" table block (rows 13-15) ----
// The table output renders one row per cell as [Cell | Label | Value], where
// the Label is taken from the cell immediately to the LEFT. So we place the
// month name in col G and the profit in col H right beside it: binding the
// table to H13:H15 yields clean month-labelled rows.
cell(ws, 'G12', 'Month'); cell(ws, 'H12', 'Profit');
rows.forEach((r, i) => {
  const row = 13 + i;
  cell(ws, `G${row}`, r.mn);
  // Profit for the month references the projection's profit cell.
  cell(ws, `H${row}`, r.profit, `E${7 + i}`);
});

ws['!ref'] = 'A1:H15';

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Sales');
XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
rows.forEach(r => console.log(`${r.mn}: units ${r.units}, revenue ${r.revenue}, cost ${r.cost}, profit ${r.profit}`));
console.log('Total profit:', rows.reduce((s, r) => s + r.profit, 0));
