/**
 * Builds four complex test workbooks for comprehensive feature testing.
 * Each workbook is designed to exercise specific features of the simulator.
 *
 *   1. loan-calc.xlsx        - IF() logic, percentages, single-value outputs, sliders
 *   2. startup-budget.xlsx   - multi-sheet, SUM/cross-sheet refs, bar + pie charts, table
 *   3. pricing-tiers.xlsx    - dropdown inputs, nested IF, formula-cell overrides
 *   4. scale-stress.xlsx     - very large / very small numbers (tokenizer exponent fix)
 *
 * Run:  cd backend && node ../scripts/build-test-suite.js
 */
const path = require('path');
const XLSX = require(path.resolve(__dirname, '../backend/node_modules/xlsx'));
const DIR = path.resolve(__dirname, '../sample-excel-sheets');

function C(ws, addr, value, formula) {
  ws[addr] = formula
    ? { t: typeof value === 'number' ? 'n' : 's', v: value, f: formula }
    : { t: typeof value === 'number' ? 'n' : 's', v: value };
}
function save(wb, name, sheets) {
  for (const [sname, ws, ref] of sheets) { ws['!ref'] = ref; XLSX.utils.book_append_sheet(wb, ws, sname); }
  const out = path.join(DIR, name);
  XLSX.writeFile(wb, out);
  console.log('wrote', out);
}

/* ============================================================
 * 1. loan-calc.xlsx  — IF logic, %, single-value outputs
 *    Simple mortgage-style monthly payment + affordability verdict.
 * ============================================================ */
(function () {
  const ws = {};
  const P = 300000, annualRate = 0.06, years = 30, income = 90000;
  C(ws, 'A1', 'Loan Principal ($)');    C(ws, 'B1', P);
  C(ws, 'A2', 'Annual Rate');           C(ws, 'B2', annualRate);
  C(ws, 'A3', 'Term (years)');          C(ws, 'B3', years);
  C(ws, 'A4', 'Annual Income ($)');     C(ws, 'B4', income);
  // monthly rate + n
  const r = annualRate / 12, n = years * 12;
  C(ws, 'A6', 'Monthly Rate');          C(ws, 'B6', r, 'B2/12');
  C(ws, 'A7', 'Num Payments');          C(ws, 'B7', n, 'B3*12');
  // payment = P*r/(1-(1+r)^-n)
  const pay = P * r / (1 - Math.pow(1 + r, -n));
  C(ws, 'A8', 'Monthly Payment');       C(ws, 'B8', pay, 'B1*B6/(1-(1+B6)^(-B7))');
  const annualPay = pay * 12;
  C(ws, 'A9', 'Annual Payment');        C(ws, 'B9', annualPay, 'B8*12');
  // ratio of payment to income
  const ratio = annualPay / income;
  C(ws, 'A10', 'Payment/Income Ratio'); C(ws, 'B10', ratio, 'B9/B4');
  // affordability verdict via IF embedded in a comparison
  const affordable = ratio <= 0.36 ? 1 : 0;
  C(ws, 'A11', 'Affordable (1/0)');     C(ws, 'B11', affordable, 'IF(B10<=0.36,1,0)');
  // total interest paid over life
  const totalInterest = annualPay * years - P;
  C(ws, 'A12', 'Total Interest ($)');   C(ws, 'B12', totalInterest, 'B9*B3-B1');
  save(XLSX.utils.book_new(), 'loan-calc.xlsx', [['Loan', ws, 'A1:B12']]);
})();

/* ============================================================
 * 2. startup-budget.xlsx — multi-sheet, cross-sheet SUM, charts+table
 *    Sheet "Expenses": category costs. Sheet "Summary": totals + funding.
 * ============================================================ */
(function () {
  const ex = {};
  // Expense categories (inputs) col B, labels col A
  const cats = [
    ['Salaries', 45000], ['Rent', 8000], ['Marketing', 12000],
    ['Software', 3500], ['Misc', 2500],
  ];
  C(ex, 'A1', 'Category'); C(ex, 'B1', 'Monthly $');
  cats.forEach(([name, val], i) => { C(ex, `A${i + 2}`, name); C(ex, `B${i + 2}`, val); });
  const totalExp = cats.reduce((s, [, v]) => s + v, 0);
  C(ex, 'A7', 'Total Monthly'); C(ex, 'B7', totalExp, 'SUM(B2:B6)');

  const sm = {};
  const runwayMonths = 12, funding = 900000;
  C(sm, 'A1', 'Funding Raised ($)');   C(sm, 'B1', funding);
  C(sm, 'A2', 'Monthly Burn ($)');     C(sm, 'B2', totalExp, 'Expenses!B7');
  C(sm, 'A3', 'Annual Burn ($)');      C(sm, 'B3', totalExp * 12, 'B2*12');
  const runway = funding / totalExp;
  C(sm, 'A4', 'Runway (months)');      C(sm, 'B4', runway, 'B1/B2');
  const surplus = funding - totalExp * runwayMonths;
  C(sm, 'A5', 'Yr-1 Surplus ($)');     C(sm, 'B5', surplus, 'B1-B2*12');
  // Healthy runway verdict (embedded IF)
  C(sm, 'A6', 'Healthy (>=18mo)');     C(sm, 'B6', runway >= 18 ? 1 : 0, 'IF(B4>=18,1,0)');
  save(XLSX.utils.book_new(), 'startup-budget.xlsx', [
    ['Expenses', ex, 'A1:B7'],
    ['Summary', sm, 'A1:B6'],
  ]);
})();

/* ============================================================
 * 3. pricing-tiers.xlsx — dropdown inputs + nested IF + formula overrides
 *    Tier drives a discount; a formula cell (unit price after discount)
 *    can itself be overridden.
 * ============================================================ */
(function () {
  const ws = {};
  const basePrice = 100, qty = 500, tier = 2;
  C(ws, 'A1', 'Base Unit Price ($)'); C(ws, 'B1', basePrice);
  C(ws, 'A2', 'Quantity');            C(ws, 'B2', qty);
  C(ws, 'A3', 'Tier (1-3)');          C(ws, 'B3', tier);
  // nested IF discount by tier: 1->0%, 2->10%, 3->20%
  const disc = tier === 1 ? 0 : tier === 2 ? 0.1 : 0.2;
  C(ws, 'A4', 'Discount');            C(ws, 'B4', disc, 'IF(B3=1,0,IF(B3=2,0.1,0.2))');
  // net unit price — this formula cell is intended to be overridable
  const netUnit = basePrice * (1 - disc);
  C(ws, 'A5', 'Net Unit Price ($)');  C(ws, 'B5', netUnit, 'B1*(1-B4)');
  // revenue depends on the overridable net unit price
  const revenue = netUnit * qty;
  C(ws, 'A6', 'Revenue ($)');         C(ws, 'B6', revenue, 'B5*B2');
  // bulk-order flag
  C(ws, 'A7', 'Bulk (>=1000)');       C(ws, 'B7', qty >= 1000 ? 1 : 0, 'IF(B2>=1000,1,0)');
  save(XLSX.utils.book_new(), 'pricing-tiers.xlsx', [['Pricing', ws, 'A1:B7']]);
})();

/* ============================================================
 * 4. scale-stress.xlsx — very large & very small numbers
 *    Exercises the tokenizer exponent-sign fix (values >= 1e21).
 * ============================================================ */
(function () {
  const ws = {};
  const bigA = 6e11, bigB = 8e11;   // product = 4.8e23 -> stringifies as 4.8e+23
  const tiny = 3e-7;
  C(ws, 'A1', 'Big A');      C(ws, 'B1', bigA);
  C(ws, 'A2', 'Big B');      C(ws, 'B2', bigB);
  C(ws, 'A3', 'Tiny');       C(ws, 'B3', tiny);
  C(ws, 'A4', 'A * B');      C(ws, 'B4', bigA * bigB, 'B1*B2');           // 4.8e23
  C(ws, 'A5', '(A*B)+1');    C(ws, 'B5', bigA * bigB + 1, 'B4+1');        // downstream of huge
  C(ws, 'A6', 'A * Tiny');   C(ws, 'B6', bigA * tiny, 'B1*B3');           // 180000
  C(ws, 'A7', 'Half of A*B');C(ws, 'B7', bigA * bigB / 2, 'B4/2');        // 2.4e23
  C(ws, 'A8', 'Verdict>1e20');C(ws, 'B8', bigA * bigB > 1e20 ? 1 : 0, 'IF(B4>100000000000000000000,1,0)');
  save(XLSX.utils.book_new(), 'scale-stress.xlsx', [['Scale', ws, 'A1:B8']]);
})();

console.log('\nAll test workbooks written to', DIR);
