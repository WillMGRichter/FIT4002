/**
 * Builds a SIMPLE single-sheet workbook to demonstrate FORMULA-CELL OVERRIDES.
 *
 * Chain:   Price x Quantity = Subtotal ; Subtotal - Discount = Total ; Total + Tax = FinalPrice
 *
 *   B1 Price       (input, literal)     = 100
 *   B2 Quantity    (input, literal)     = 10
 *   B3 Subtotal    (formula) = B1*B2    -> OVERRIDABLE (B4 & B5 depend on it)
 *   B4 Discount    (input, literal)     = 50
 *   B5 Total       (formula) = B3-B4    -> OVERRIDABLE (B7 depends on it)
 *   B6 Tax Rate    (input, literal)     = 0.1
 *   B7 Final Price (formula) = B5*(1+B6)  (terminal output - NOT overridable)
 *
 * Demonstrates:
 *   - Overriding B3 (Subtotal): B5 and B7 recompute from the pinned value.
 *   - Auto-revert: changing Price (B1) or Quantity (B2) clears the B3 override,
 *     since B3 depends on them.
 *   - B7 (Final Price) is referenced by nothing, so it is NOT offered as an input.
 *
 * Run:  cd backend && node ../scripts/build-override-demo.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

const OUT = path.resolve(__dirname, '../sample-excel-sheets/override-demo.xlsx');

function cell(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}

// Compute correct cached values in JS.
const price = 100, qty = 10, discount = 50, taxRate = 0.1;
const subtotal = price * qty;          // 1000
const total = subtotal - discount;     // 950
const finalPrice = total * (1 + taxRate); // 1045

const ws = {};
cell(ws, 'A1', 'Price');        cell(ws, 'B1', price);
cell(ws, 'A2', 'Quantity');     cell(ws, 'B2', qty);
cell(ws, 'A3', 'Subtotal');     cell(ws, 'B3', subtotal, 'B1*B2');
cell(ws, 'A4', 'Discount');     cell(ws, 'B4', discount);
cell(ws, 'A5', 'Total');        cell(ws, 'B5', total, 'B3-B4');
cell(ws, 'A6', 'Tax Rate');     cell(ws, 'B6', taxRate);
cell(ws, 'A7', 'Final Price');  cell(ws, 'B7', finalPrice, 'B5*(1+B6)');
ws['!ref'] = 'A1:B7';

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Pricing');
XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
console.log('Cached: Subtotal', subtotal, '| Total', total, '| Final', finalPrice);
