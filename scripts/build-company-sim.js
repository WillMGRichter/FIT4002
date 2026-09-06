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
 * Cached values: every formula cell is written with the CORRECT computed value
 * (evaluated below in `m`) as its cached value, so the file is self-consistent
 * when opened in Excel/Numbers/Sheets (no stale 0 placeholders).
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

/* ------------------------------------------------------------------ *
 * Compute the model once in JS so we can store correct cached values.
 * These mirror the formulas exactly.
 * ------------------------------------------------------------------ */
const m = {};
// Marketing inputs
m.mktBudget = 50000; m.costPerLead = 25; m.qualifyRate = 0.6;
m.leads = m.mktBudget / m.costPerLead;              // 2000
m.qualified = m.leads * m.qualifyRate;              // 1200
// Sales inputs
m.conversion = 0.2; m.dealSize = 1200; m.reps = 8; m.quota = 60;
m.capacity = m.reps * m.quota;                      // 480
m.potential = m.qualified * m.conversion;           // 240
m.dealsWon = Math.min(m.potential, m.capacity);     // 240
m.revenue = m.dealsWon * m.dealSize;                // 288000
// Operations inputs
m.costPerUnit = 180; m.fulfilCap = 500;
m.units = m.dealsWon;                               // 240
m.deliveryCost = m.units * m.costPerUnit;           // 43200
m.utilisation = m.units / m.fulfilCap;              // 0.48
m.overCapacity = m.units > m.fulfilCap ? 'YES' : 'NO';
// Finance inputs
m.overhead = 60000; m.taxRate = 0.3;
m.finRevenue = m.revenue;                           // 288000
m.finCosts = m.mktBudget + m.deliveryCost + m.overhead; // 153200
m.gross = m.finRevenue - m.finCosts;                // 134800
m.tax = m.gross > 0 ? m.gross * m.taxRate : 0;      // 40440
m.net = m.gross - m.tax;                            // 94360
m.margin = m.finRevenue > 0 ? m.net / m.finRevenue : 0; // 0.3276...
m.verdict = m.net > 0 ? 'Profitable' : (m.net === 0 ? 'Break-even' : 'Loss');

const wb = XLSX.utils.book_new();

/* ------------------------- Sheet 1: Marketing ------------------------- */
const mkt = {};
cell(mkt, 'A1', 'Marketing Department');
cell(mkt, 'A2', 'Marketing Budget ($)');      cell(mkt, 'B2', m.mktBudget);   // INPUT
cell(mkt, 'A3', 'Cost per Lead ($)');         cell(mkt, 'B3', m.costPerLead); // INPUT
cell(mkt, 'A4', 'Lead Qualify Rate (0-1)');   cell(mkt, 'B4', m.qualifyRate); // INPUT (slider)
cell(mkt, 'A5', 'Leads Generated');           cell(mkt, 'B5', m.leads, 'B2/B3');
cell(mkt, 'A6', 'Qualified Leads');           cell(mkt, 'B6', m.qualified, 'B5*B4');
setRange(mkt, 'A1:B6');
XLSX.utils.book_append_sheet(wb, mkt, 'Marketing');

/* ------------------------- Sheet 2: Sales ------------------------- */
const sales = {};
cell(sales, 'A1', 'Sales Department');
cell(sales, 'A2', 'Conversion Rate (0-1)');   cell(sales, 'B2', m.conversion); // INPUT (slider)
cell(sales, 'A3', 'Average Deal Size ($)');   cell(sales, 'B3', m.dealSize);   // INPUT
cell(sales, 'A4', 'Sales Reps');              cell(sales, 'B4', m.reps);       // INPUT
cell(sales, 'A5', 'Quota per Rep (deals)');   cell(sales, 'B5', m.quota);      // INPUT
cell(sales, 'A6', 'Team Capacity (deals)');   cell(sales, 'B6', m.capacity, 'B4*B5');
cell(sales, 'A7', 'Potential Deals');         cell(sales, 'B7', m.potential, 'Marketing!B6*B2');
cell(sales, 'A8', 'Deals Won');               cell(sales, 'B8', m.dealsWon, 'MIN(B7,B6)');
cell(sales, 'A9', 'Sales Revenue ($)');       cell(sales, 'B9', m.revenue, 'B8*B3');
setRange(sales, 'A1:B9');
XLSX.utils.book_append_sheet(wb, sales, 'Sales');

/* ------------------------- Sheet 3: Operations ------------------------- */
const ops = {};
cell(ops, 'A1', 'Operations Department');
cell(ops, 'A2', 'Cost per Unit Delivered ($)'); cell(ops, 'B2', m.costPerUnit); // INPUT
cell(ops, 'A3', 'Fulfilment Capacity (units)'); cell(ops, 'B3', m.fulfilCap);   // INPUT
cell(ops, 'A4', 'Units to Deliver');            cell(ops, 'B4', m.units, 'Sales!B8');
cell(ops, 'A5', 'Delivery Cost ($)');           cell(ops, 'B5', m.deliveryCost, 'B4*B2');
cell(ops, 'A6', 'Capacity Utilisation (0-1)');  cell(ops, 'B6', m.utilisation, 'B4/B3');
cell(ops, 'A7', 'Over Capacity?');              cell(ops, 'B7', m.overCapacity, 'IF(B4>B3,"YES","NO")');
setRange(ops, 'A1:B7');
XLSX.utils.book_append_sheet(wb, ops, 'Operations');

/* ------------------------- Sheet 4: Finance ------------------------- */
const fin = {};
cell(fin, 'A1', 'Finance Department');
cell(fin, 'A2', 'Company Overhead ($)');  cell(fin, 'B2', m.overhead);  // INPUT
cell(fin, 'A3', 'Tax Rate (0-1)');        cell(fin, 'B3', m.taxRate);   // INPUT (slider)
cell(fin, 'A4', 'Total Revenue ($)');     cell(fin, 'B4', m.finRevenue, 'Sales!B9');
cell(fin, 'A5', 'Total Costs ($)');       cell(fin, 'B5', m.finCosts, 'Marketing!B2+Operations!B5+B2');
cell(fin, 'A6', 'Gross Profit ($)');      cell(fin, 'B6', m.gross, 'B4-B5');
cell(fin, 'A7', 'Tax ($)');               cell(fin, 'B7', m.tax, 'IF(B6>0,B6*B3,0)');
cell(fin, 'A8', 'Net Profit ($)');        cell(fin, 'B8', m.net, 'B6-B7');
cell(fin, 'A9', 'Net Margin (0-1)');      cell(fin, 'B9', m.margin, 'IF(B4>0,B8/B4,0)');
cell(fin, 'A10', 'Verdict');              cell(fin, 'B10', m.verdict, 'IF(B8>0,"Profitable",IF(B8=0,"Break-even","Loss"))');
setRange(fin, 'A1:B10');
XLSX.utils.book_append_sheet(wb, fin, 'Finance');

XLSX.writeFile(wb, OUT);
console.log('Wrote', OUT);
console.log('Sheets:', wb.SheetNames.join(', '));
console.log('Finance cached: Gross', m.gross, '| Tax', m.tax, '| Net', m.net, '| Verdict', m.verdict);
