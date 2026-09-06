/**
 * Builds a company-sales simulation workbook where EACH SHEET is a DEPARTMENT,
 * and departments are linked by (illustrative) cross-sheet relationships so a
 * change in one department ripples through the others:
 *
 *   Marketing --> Sales --> Operations --> Finance
 *
 * Relationships (made up for demonstration, but internally consistent):
 *   Marketing: Leads       = Budget / CostPerLead
 *              Qualified   = Leads * QualifyRate
 *   Sales:     Capacity    = Reps * QuotaPerRep
 *              Potential   = Marketing!Qualified * ConversionRate
 *              DealsWon    = MIN(Potential, Capacity)
 *              Revenue     = DealsWon * AvgDealSize
 *   Operations:Units       = Sales!DealsWon
 *              DeliveryCost = Units * CostPerUnit
 *              Utilization = Units / FulfilmentCapacity
 *   Finance:   GrossProfit  = Sales!Revenue - Marketing!Budget - Operations!DeliveryCost - Overhead
 *              NetProfit    = GrossProfit * (1 - TaxRate)
 *              Margin       = NetProfit / Sales!Revenue
 *              Verdict      = IF(NetProfit>0,"Profitable",IF(NetProfit=0,"Break-even","Loss"))
 *
 * Run from the backend dir (where `xlsx` is installed):
 *   cd backend && node ../scripts/build-company-sim.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));

const OUT = path.resolve(__dirname, '../sample-excel-sheets/company-sales-sim.xlsx');

function cell(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}
function setRange(ws, ref) { ws['!ref'] = ref; }

const wb = XLSX.utils.book_new();

/* ------------------------- Sheet 1: Marketing ------------------------- */
const mkt = {};
cell(mkt, 'A1', 'Marketing Department');
cell(mkt, 'A2', 'Marketing Budget ($)');      cell(mkt, 'B2', 50000);   // INPUT
cell(mkt, 'A3', 'Cost per Lead ($)');         cell(mkt, 'B3', 25);      // INPUT
cell(mkt, 'A4', 'Lead Qualify Rate (0-1)');   cell(mkt, 'B4', 0.6);     // INPUT (slider)
cell(mkt, 'A5', 'Leads Generated');           cell(mkt, 'B5', 0, 'B2/B3');
cell(mkt, 'A6', 'Qualified Leads');           cell(mkt, 'B6', 0, 'B5*B4');
setRange(mkt, 'A1:B6');
XLSX.utils.book_append_sheet(wb, mkt, 'Marketing');

/* ------------------------- Sheet 2: Sales ------------------------- */
// Depends on Marketing!B6 (Qualified Leads)
const sales = {};
cell(sales, 'A1', 'Sales Department');
cell(sales, 'A2', 'Conversion Rate (0-1)');   cell(sales, 'B2', 0.2);    // INPUT (slider)
cell(sales, 'A3', 'Average Deal Size ($)');   cell(sales, 'B3', 1200);   // INPUT
cell(sales, 'A4', 'Sales Reps');              cell(sales, 'B4', 8);      // INPUT
cell(sales, 'A5', 'Quota per Rep (deals)');   cell(sales, 'B5', 60);     // INPUT
cell(sales, 'A6', 'Team Capacity (deals)');   cell(sales, 'B6', 0, 'B4*B5');
cell(sales, 'A7', 'Potential Deals');         cell(sales, 'B7', 0, 'Marketing!B6*B2');
cell(sales, 'A8', 'Deals Won');               cell(sales, 'B8', 0, 'MIN(B7,B6)');
cell(sales, 'A9', 'Sales Revenue ($)');       cell(sales, 'B9', 0, 'B8*B3');
setRange(sales, 'A1:B9');
XLSX.utils.book_append_sheet(wb, sales, 'Sales');

/* ------------------------- Sheet 3: Operations ------------------------- */
// Depends on Sales!B8 (Deals Won)
const ops = {};
cell(ops, 'A1', 'Operations Department');
cell(ops, 'A2', 'Cost per Unit Delivered ($)'); cell(ops, 'B2', 180);   // INPUT
cell(ops, 'A3', 'Fulfilment Capacity (units)'); cell(ops, 'B3', 500);   // INPUT
cell(ops, 'A4', 'Units to Deliver');            cell(ops, 'B4', 0, 'Sales!B8');
cell(ops, 'A5', 'Delivery Cost ($)');           cell(ops, 'B5', 0, 'B4*B2');
cell(ops, 'A6', 'Capacity Utilisation (0-1)');  cell(ops, 'B6', 0, 'B4/B3');
cell(ops, 'A7', 'Over Capacity?');              cell(ops, 'B7', '', 'IF(B4>B3,"YES","NO")');
setRange(ops, 'A1:B7');
XLSX.utils.book_append_sheet(wb, ops, 'Operations');

/* ------------------------- Sheet 4: Finance ------------------------- */
// Depends on Sales!B9 (Revenue), Marketing!B2 (Budget), Operations!B5 (Delivery Cost)
const fin = {};
cell(fin, 'A1', 'Finance Department');
cell(fin, 'A2', 'Company Overhead ($)');  cell(fin, 'B2', 60000);   // INPUT
cell(fin, 'A3', 'Tax Rate (0-1)');        cell(fin, 'B3', 0.3);     // INPUT (slider)
cell(fin, 'A4', 'Total Revenue ($)');     cell(fin, 'B4', 0, 'Sales!B9');
cell(fin, 'A5', 'Total Costs ($)');       cell(fin, 'B5', 0, 'Marketing!B2+Operations!B5+B2');
cell(fin, 'A6', 'Gross Profit ($)');      cell(fin, 'B6', 0, 'B4-B5');
cell(fin, 'A7', 'Tax ($)');               cell(fin, 'B7', 0, 'IF(B6>0,B6*B3,0)');
cell(fin, 'A8', 'Net Profit ($)');        cell(fin, 'B8', 0, 'B6-B7');
cell(fin, 'A9', 'Net Margin (0-1)');      cell(fin, 'B9', 0, 'IF(B4>0,B8/B4,0)');
cell(fin, 'A10', 'Verdict');              cell(fin, 'B10', '', 'IF(B8>0,"Profitable",IF(B8=0,"Break-even","Loss"))');
setRange(fin, 'A1:B10');
XLSX.utils.book_append_sheet(wb, fin, 'Finance');

XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
console.log('Sheets:', wb.SheetNames.join(', '));
