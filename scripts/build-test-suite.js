/**
 * Builds four COMPREHENSIVE test workbooks that, together with the multi-page
 * projects created by build-test-projects, exercise EVERY implemented feature:
 *
 *   Input types ....... number, slider (range), dropdown
 *   Output types ...... number, text, currency, percentage, bar-chart, pie-chart, table
 *   Functions ......... SUM, AVERAGE/AVG, MIN, MAX, COUNT, PRODUCT
 *   IF ................ nested, embedded in arithmetic, TEXT return values, ops = <> >= <= > <
 *   Operators ......... + - * / ^ (power) and unary minus
 *   Multi-sheet ....... cross-sheet references
 *   Overrides ......... a formula cell exposed as an input (auto-revert)
 *   Per-page .......... multiple scenario pages reuse the same refs independently
 *
 *   A) sales-ops.xlsx      3 sheets: Products / Regions / Summary
 *   B) finance.xlsx        2 sheets: Loan / Investment  (power operator, text verdicts)
 *   C) pricing.xlsx        1 sheet:  nested IF, <> operator, overridable formula cell
 *   D) aggregates.xlsx     2 sheets: Data / Stats (all six functions, huge/tiny numbers)
 *
 * Run:  cd backend && node ../scripts/build-test-suite.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));
const DIR = path.resolve(__dirname, '../sample-excel-sheets');

function C(ws, addr, value, formula) {
  const t = typeof value === 'number' ? 'n' : (typeof value === 'boolean' ? 'b' : 's');
  ws[addr] = formula ? { t, v: value, f: formula } : { t, v: value };
}
function save(name, sheets) {
  const wb = XLSX.utils.book_new();
  for (const [sname, ws, ref] of sheets) { ws['!ref'] = ref; XLSX.utils.book_append_sheet(wb, ws, sname); }
  XLSX.writeFile(wb, path.join(DIR, name));
  console.log('wrote', name);
}

/* ============================================================
 * A) sales-ops.xlsx — 3 sheets, all aggregate funcs, cross-sheet, text verdict
 * ============================================================ */
(function () {
  // --- Products sheet: 4 products with cost/price/units ---
  const prod = {};
  const products = [
    { name: 'Widget',  cost: 4,  price: 10, units: 1200 },
    { name: 'Gadget',  cost: 7,  price: 18, units: 800 },
    { name: 'Gizmo',   cost: 12, price: 25, units: 500 },
    { name: 'Doohickey',cost: 2, price: 6,  units: 2000 },
  ];
  C(prod, 'A1', 'Product'); C(prod, 'B1', 'Unit Cost'); C(prod, 'C1', 'Unit Price');
  C(prod, 'D1', 'Units'); C(prod, 'E1', 'Margin/Unit'); C(prod, 'F1', 'Revenue'); C(prod, 'G1', 'Profit');
  products.forEach((p, i) => {
    const r = i + 2;
    C(prod, `A${r}`, p.name); C(prod, `B${r}`, p.cost); C(prod, `C${r}`, p.price); C(prod, `D${r}`, p.units);
    C(prod, `E${r}`, p.price - p.cost, `C${r}-B${r}`);
    C(prod, `F${r}`, p.price * p.units, `C${r}*D${r}`);
    C(prod, `G${r}`, (p.price - p.cost) * p.units, `E${r}*D${r}`);
  });
  const totRev = products.reduce((s, p) => s + p.price * p.units, 0);
  const totProfit = products.reduce((s, p) => s + (p.price - p.cost) * p.units, 0);
  const avgMargin = products.reduce((s, p) => s + (p.price - p.cost), 0) / products.length;
  C(prod, 'A6', 'Total Revenue');  C(prod, 'F6', totRev, 'SUM(F2:F5)');
  C(prod, 'A7', 'Total Profit');   C(prod, 'G7', totProfit, 'SUM(G2:G5)');
  C(prod, 'A8', 'Avg Margin/Unit'); C(prod, 'E8', avgMargin, 'AVERAGE(E2:E5)');
  C(prod, 'A9', 'Product Count');  C(prod, 'D9', products.length, 'COUNT(D2:D5)');

  // --- Regions sheet: sales by region ---
  const reg = {};
  const regions = [['North', 45000], ['South', 62000], ['East', 38000], ['West', 71000]];
  C(reg, 'A1', 'Region'); C(reg, 'B1', 'Sales');
  regions.forEach(([n, v], i) => { C(reg, `A${i + 2}`, n); C(reg, `B${i + 2}`, v); });
  const rvals = regions.map(r => r[1]);
  C(reg, 'A6', 'Total Sales'); C(reg, 'B6', rvals.reduce((a, b) => a + b, 0), 'SUM(B2:B5)');
  C(reg, 'A7', 'Best Region');  C(reg, 'B7', Math.max(...rvals), 'MAX(B2:B5)');
  C(reg, 'A8', 'Worst Region'); C(reg, 'B8', Math.min(...rvals), 'MIN(B2:B5)');
  C(reg, 'A9', 'Avg per Region'); C(reg, 'B9', rvals.reduce((a, b) => a + b, 0) / rvals.length, 'AVERAGE(B2:B5)');

  // --- Summary sheet: cross-sheet, IF TEXT verdict ---
  const sm = {};
  C(sm, 'A1', 'Company Profit'); C(sm, 'B1', totProfit, 'Products!G7');
  C(sm, 'A2', 'Company Sales');  C(sm, 'B2', rvals.reduce((a, b) => a + b, 0), 'Regions!B6');
  const profitMargin = totProfit / rvals.reduce((a, b) => a + b, 0);
  C(sm, 'A3', 'Profit Margin');  C(sm, 'B3', profitMargin, 'B1/B2');
  // TEXT verdict via nested IF (returns strings)
  const verdict = profitMargin >= 0.4 ? 'Excellent' : profitMargin >= 0.2 ? 'Healthy' : 'At Risk';
  C(sm, 'A4', 'Health Verdict'); C(sm, 'B4', verdict, 'IF(B3>=0.4,"Excellent",IF(B3>=0.2,"Healthy","At Risk"))');

  save('sales-ops.xlsx', [
    ['Products', prod, 'A1:G9'],
    ['Regions', reg, 'A1:B9'],
    ['Summary', sm, 'A1:B4'],
  ]);
})();

/* ============================================================
 * B) finance.xlsx — 2 sheets, POWER operator, TEXT verdicts, compounding
 * ============================================================ */
(function () {
  // --- Loan sheet ---
  const loan = {};
  const P = 350000, rate = 0.065, years = 30, income = 95000;
  C(loan, 'A1', 'Principal ($)');  C(loan, 'B1', P);
  C(loan, 'A2', 'Annual Rate');    C(loan, 'B2', rate);
  C(loan, 'A3', 'Term (years)');   C(loan, 'B3', years);
  C(loan, 'A4', 'Annual Income');  C(loan, 'B4', income);
  const mr = rate / 12, n = years * 12;
  C(loan, 'A5', 'Monthly Rate');   C(loan, 'B5', mr, 'B2/12');
  C(loan, 'A6', 'Payments');       C(loan, 'B6', n, 'B3*12');
  const pay = P * mr / (1 - Math.pow(1 + mr, -n));
  C(loan, 'A7', 'Monthly Payment'); C(loan, 'B7', pay, 'B1*B5/(1-(1+B5)^(-B6))');
  const ratio = pay * 12 / income;
  C(loan, 'A8', 'Income Ratio');   C(loan, 'B8', ratio, 'B7*12/B4');
  // nested IF TEXT verdict with <= and >
  const v = ratio <= 0.28 ? 'Affordable' : ratio <= 0.4 ? 'Stretch' : 'Unaffordable';
  C(loan, 'A9', 'Verdict');        C(loan, 'B9', v, 'IF(B8<=0.28,"Affordable",IF(B8<=0.4,"Stretch","Unaffordable"))');

  // --- Investment sheet: compound growth using ^ ---
  const inv = {};
  const principal = 10000, annual = 0.08, yrs = 10, contrib = 2000;
  C(inv, 'A1', 'Initial ($)');     C(inv, 'B1', principal);
  C(inv, 'A2', 'Annual Return');   C(inv, 'B2', annual);
  C(inv, 'A3', 'Years');           C(inv, 'B3', yrs);
  C(inv, 'A4', 'Yearly Add ($)');  C(inv, 'B4', contrib);
  // FV of principal = P*(1+r)^n
  const fvP = principal * Math.pow(1 + annual, yrs);
  C(inv, 'A5', 'FV of Initial');   C(inv, 'B5', fvP, 'B1*(1+B2)^B3');
  // year-by-year balance (compounding), rows 8..17 for a 10-yr table
  C(inv, 'A7', 'Year'); C(inv, 'B7', 'Balance');
  let bal = principal;
  for (let y = 1; y <= yrs; y++) {
    bal = bal * (1 + annual) + contrib;
    const row = 7 + y;
    C(inv, `A${row}`, y);
    // balance_y = balance_(y-1)*(1+r)+contrib ; year1 references B1
    if (y === 1) C(inv, `B${row}`, bal, 'B1*(1+$B$2)+$B$4');
    else C(inv, `B${row}`, bal, `B${row - 1}*(1+$B$2)+$B$4`);
  }
  C(inv, 'A18', 'Final Balance');  C(inv, 'B18', bal, 'B17');

  save('finance.xlsx', [
    ['Loan', loan, 'A1:B9'],
    ['Investment', inv, 'A1:B18'],
  ]);
})();

/* ============================================================
 * C) pricing.xlsx — dropdown, nested IF, <> operator, OVERRIDABLE formula cell
 * ============================================================ */
(function () {
  const ws = {};
  const base = 100, qty = 500, tier = 2, promo = 0;
  C(ws, 'A1', 'Base Price ($)'); C(ws, 'B1', base);
  C(ws, 'A2', 'Quantity');       C(ws, 'B2', qty);
  C(ws, 'A3', 'Tier');           C(ws, 'B3', tier);
  C(ws, 'A4', 'Promo Code (0/1)'); C(ws, 'B4', promo);
  // nested IF discount by tier
  const disc = tier === 1 ? 0 : tier === 2 ? 0.1 : 0.2;
  C(ws, 'A5', 'Tier Discount'); C(ws, 'B5', disc, 'IF(B3=1,0,IF(B3=2,0.1,0.2))');
  // promo adds 5% when code <> 0  (exercises the <> operator)
  const promoDisc = promo !== 0 ? 0.05 : 0;
  C(ws, 'A6', 'Promo Discount'); C(ws, 'B6', promoDisc, 'IF(B4<>0,0.05,0)');
  // net unit price — OVERRIDABLE formula cell (referenced by revenue below)
  const net = base * (1 - disc - promoDisc);
  C(ws, 'A7', 'Net Unit Price'); C(ws, 'B7', net, 'B1*(1-B5-B6)');
  const revenue = net * qty;
  C(ws, 'A8', 'Revenue');       C(ws, 'B8', revenue, 'B7*B2');
  // bulk flag TEXT
  const bulk = qty >= 1000 ? 'Bulk' : 'Standard';
  C(ws, 'A9', 'Order Type');    C(ws, 'B9', bulk, 'IF(B2>=1000,"Bulk","Standard")');
  save('pricing.xlsx', [['Pricing', ws, 'A1:B9']]);
})();

/* ============================================================
 * D) aggregates.xlsx — ALL six functions + huge/tiny numbers
 * ============================================================ */
(function () {
  // --- Data sheet: a spread of magnitudes ---
  const data = {};
  const nums = [5, 120, 3.5, 8e11, 42, 3e-4, 900, 6e11];
  C(data, 'A1', 'Label'); C(data, 'B1', 'Value');
  nums.forEach((v, i) => { C(data, `A${i + 2}`, `item${i + 1}`); C(data, `B${i + 2}`, v); });

  // --- Stats sheet: every aggregate over Data!B2:B9 ---
  const st = {};
  const sum = nums.reduce((a, b) => a + b, 0);
  const avg = sum / nums.length;
  C(st, 'A1', 'SUM');     C(st, 'B1', sum, 'SUM(Data!B2:Data!B9)');
  C(st, 'A2', 'AVERAGE'); C(st, 'B2', avg, 'AVERAGE(Data!B2:Data!B9)');
  C(st, 'A3', 'MIN');     C(st, 'B3', Math.min(...nums), 'MIN(Data!B2:Data!B9)');
  C(st, 'A4', 'MAX');     C(st, 'B4', Math.max(...nums), 'MAX(Data!B2:Data!B9)');
  C(st, 'A5', 'COUNT');   C(st, 'B5', nums.length, 'COUNT(Data!B2:Data!B9)');
  // PRODUCT of the small ones only (B2:B4) to avoid Infinity
  const smallProd = nums[0] * nums[1] * nums[2];
  C(st, 'A6', 'PRODUCT(first3)'); C(st, 'B6', smallProd, 'PRODUCT(Data!B2:Data!B4)');
  // huge * huge to test tokenizer exponent + power
  C(st, 'A7', 'MAX^2'); C(st, 'B7', Math.pow(Math.max(...nums), 2), 'B4^2');
  C(st, 'A8', 'Scale Verdict'); C(st, 'B8', Math.max(...nums) > 1e11 ? 'Huge' : 'Normal', 'IF(B4>100000000000,"Huge","Normal")');

  save('aggregates.xlsx', [
    ['Data', data, 'A1:B9'],
    ['Stats', st, 'A1:B8'],
  ]);
})();

console.log('\nAll comprehensive test workbooks written to', DIR);
