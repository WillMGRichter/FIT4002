/**
 * Builds the "masterdemo-lemonade" workbook: a lemonade stand for one day. It is deliberately
 * simple (no finance knowledge needed) but has just enough structure to exercise every feature
 * of the simulation canvas - see masterdemo-lemonade-seed.js for the canvas layout.
 *
 * The rules, in plain words:
 *   - Weather decides how many people show up: Sunny 100, Cloudy 70, Rainy 40.
 *   - Every $1 you add to the price loses you 10 customers.
 *   - You pay for every cup you make, even the ones you don't sell.
 *
 * Cells (column A = label, column B = value). Refs are bare because the workbook has one sheet.
 *   Inputs   B1 price, B2 weather code, B3 cups made, B4-B6 cost per cup (lemons, sugar, cup+ice)
 *   Formulas B7..B18 (see below)
 *
 * The weather is a numeric code (1/2/3) rather than text because only numeric literals are
 * detected as inputs; B7 turns the code back into a word for display.
 *
 * Every formula cell is written with its correctly computed cached value (evaluated below in
 * plain JS) so the file is self-consistent when opened in Excel/Numbers/Sheets.
 *
 * Run (from anywhere):  node scripts/masterdemo-lemonade-build.js
 * Output:               sample-excel-sheets/masterdemo-lemonade.xlsx
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

const OUT = path.resolve(__dirname, '../sample-excel-sheets/masterdemo-lemonade.xlsx');

function cell(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}

// ---- Inputs (defaults) ----
const price = 2;        // B1  $ per cup
const weather = 1;      // B2  1 = Sunny, 2 = Cloudy, 3 = Rainy
const made = 100;       // B3  cups made
const lemons = 0.2;     // B4  $ per cup
const sugar = 0.1;      // B5  $ per cup
const cupIce = 0.1;     // B6  $ per cup

// ---- Model, evaluated in JS for the cached values ----
const weatherName = weather === 1 ? 'Sunny' : weather === 2 ? 'Cloudy' : 'Rainy';
const baseCustomers = weather === 1 ? 100 : weather === 2 ? 70 : 40;
const customers = Math.max(0, baseCustomers - 10 * price);
const sold = Math.min(made, customers);
const wasted = made - sold;
const soldPct = made > 0 ? sold / made : 0;
const revenue = sold * price;
const lemonsCost = made * lemons;
const sugarCost = made * sugar;
const cupIceCost = made * cupIce;
const totalCost = lemonsCost + sugarCost + cupIceCost;
const profit = revenue - totalCost;
const verdict = profit > 0 ? 'Nice profit!' : profit === 0 ? 'Broke even' : 'Loss - try again';

const ws = {};
cell(ws, 'A1', 'Price per cup ($)');          cell(ws, 'B1', price);
cell(ws, 'A2', 'Weather code');               cell(ws, 'B2', weather);
cell(ws, 'A3', 'Cups made');                  cell(ws, 'B3', made);
cell(ws, 'A4', 'Lemons per cup ($)');         cell(ws, 'B4', lemons);
cell(ws, 'A5', 'Sugar per cup ($)');          cell(ws, 'B5', sugar);
cell(ws, 'A6', 'Cup and ice per cup ($)');    cell(ws, 'B6', cupIce);
cell(ws, 'A7', 'Weather today');              cell(ws, 'B7', weatherName, 'IF(B2=1,"Sunny",IF(B2=2,"Cloudy","Rainy"))');
cell(ws, 'A8', 'Customers who show up');      cell(ws, 'B8', customers, 'MAX(0,IF(B2=1,100,IF(B2=2,70,40))-10*B1)');
cell(ws, 'A9', 'Cups sold');                  cell(ws, 'B9', sold, 'MIN(B3,B8)');
cell(ws, 'A10', 'Cups wasted');               cell(ws, 'B10', wasted, 'B3-B9');
cell(ws, 'A11', 'Share of cups sold');        cell(ws, 'B11', soldPct, 'IF(B3>0,B9/B3,0)');
cell(ws, 'A12', 'Revenue ($)');               cell(ws, 'B12', revenue, 'B9*B1');
cell(ws, 'A13', 'Lemons cost ($)');           cell(ws, 'B13', lemonsCost, 'B3*B4');
cell(ws, 'A14', 'Sugar cost ($)');            cell(ws, 'B14', sugarCost, 'B3*B5');
cell(ws, 'A15', 'Cups and ice cost ($)');     cell(ws, 'B15', cupIceCost, 'B3*B6');
cell(ws, 'A16', 'Total cost ($)');            cell(ws, 'B16', totalCost, 'B13+B14+B15');
cell(ws, 'A17', 'Profit ($)');                cell(ws, 'B17', profit, 'B12-B16');
cell(ws, 'A18', 'Verdict');                   cell(ws, 'B18', verdict, 'IF(B17>0,"Nice profit!",IF(B17=0,"Broke even","Loss - try again"))');
ws['!ref'] = 'A1:B18';
ws['!cols'] = [{ wch: 28 }, { wch: 18 }];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Lemonade');
XLSX.writeFile(wb, OUT);

console.log('Wrote', OUT);
console.log(`Defaults: ${weatherName}, $${price}/cup, ${made} cups -> sold ${sold}, wasted ${wasted}, revenue $${revenue}, cost $${totalCost}, profit $${profit} (${verdict})`);
