/**
 * Creates (or refreshes) the "masterdemo-lemonade" project in the database, with every page and
 * canvas node already placed. It demonstrates each feature of the simulation canvas.
 *
 * THE SCENARIO
 *   You run a lemonade stand for one day, and the question is: can you make a profit?
 *   You choose the price per cup, the number of cups to make, and the ingredient costs; the
 *   weather (sunny, cloudy or rainy) is a condition that changes how many customers show up.
 *   Roughly: sunny 100 customers, cloudy 70, rainy 40, minus 10 for every $1 on the price.
 *   Cups you make but don't sell are wasted money. Try a rainy day at a high price and you lose
 *   money; make fewer cups and you recover. It is deliberately simple so anyone can follow it
 *   without finance knowledge. The model itself lives in masterdemo-lemonade-build.js.
 *
 * FEATURES COVERED
 *
 *   text        headings / body / hint text in different sizes, colours and weights   (all pages)
 *   inputs      number, slider, dropdown                                             (pages 1-2)
 *   override    typing into a FORMULA cell (manual override + "Reset to formula")     (page 3)
 *   outputs     number, text, currency, percentage                                   (pages 1, 3)
 *   charts      bar chart, pie chart, table                                          (page 2)
 *   pages       3 pages with independent per-page values                             (all)
 *
 * Prerequisites:
 *   1. cd backend && npm install
 *   2. backend/.env has SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   3. node scripts/masterdemo-lemonade-build.js      (creates the .xlsx this script loads)
 *
 * Usage (from anywhere):
 *   node scripts/masterdemo-lemonade-seed.js --user <username>            # dry run (default)
 *   node scripts/masterdemo-lemonade-seed.js --user <username> --write    # actually write
 *   Optional: --name <project name>   (default: masterdemo-lemonade)
 *
 * Safe to re-run: if the project already exists for that user it is UPDATED in place (workbook
 * data and page contents are reset to the demo layout; pages are matched by position so their
 * ids, and any student progress pointing at them, are kept). Nothing is ever deleted.
 *
 * WARNING: this writes with the service-role key straight to whichever database backend/.env
 * points at. The dry run prints that database's host - check it before using --write.
 */
const fs = require('fs');
const path = require('path');

const BACKEND = path.resolve(__dirname, '../backend');
const XLSX_PATH = path.resolve(__dirname, '../sample-excel-sheets/masterdemo-lemonade.xlsx');

require(path.join(BACKEND, 'node_modules/dotenv')).config({ path: path.join(BACKEND, '.env'), quiet: true });
// Explicit options so this works from any cwd (ts-node would otherwise not find backend/tsconfig.json).
require(path.join(BACKEND, 'node_modules/ts-node')).register({
  transpileOnly: true,
  compilerOptions: { module: 'commonjs', target: 'ES2020', esModuleInterop: true, ignoreDeprecations: '6.0' },
});
const { createClient } = require(path.join(BACKEND, 'node_modules/@supabase/supabase-js'));
const { buildExcelData } = require(path.join(BACKEND, 'src/excel/excelDataBuilder.ts'));
const { expandRange } = require(path.resolve(__dirname, '../frontend/src/utils/FormulaEngine.ts'));

// -- CLI ----------------------------------------------------------------------
const args = process.argv.slice(2);
const argVal = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : undefined; };
const WRITE = args.includes('--write');
const USERNAME = argVal('--user');
const PROJECT_NAME = argVal('--name') || 'masterdemo-lemonade';
const DESCRIPTION = 'Master demo: a one-day lemonade stand that exercises every simulation canvas feature.';

// -- Element builders (same shape the designer produces) -------------------------
let seq = 0;
const nextId = () => `elem_ml_${++seq}`;

const COLORS = { heading: '#b45309', body: '#374151', hint: '#6b7280', note: '#92400e' };

const text = (x, y, w, h, content, { fontSize = 16, color = COLORS.body, bold = false } = {}) =>
  ({ id: nextId(), type: 'text', x, y, w, h, props: { content, fontSize, color, bold } });

const numberInput = (x, y, label, cellRef, placeholder) =>
  ({ id: nextId(), type: 'input-field', x, y, w: 260, h: 64, props: { label, cellRef, format: 'number', placeholder } });

const sliderInput = (x, y, label, cellRef, min, max, stepSize) =>
  ({ id: nextId(), type: 'input-field', x, y, w: 260, h: 80, props: { label, cellRef, format: 'range', min, max, stepSize } });

const dropdownInput = (x, y, label, cellRef, options, placeholder) =>
  ({ id: nextId(), type: 'input-field', x, y, w: 260, h: 64, props: { label, cellRef, format: 'dropdown', options, placeholder } });

// An input bound to a FORMULA cell: typing a value overrides it. Taller to fit the override notice.
const overrideInput = (x, y, label, cellRef, placeholder) =>
  ({ id: nextId(), type: 'input-field', x, y, w: 260, h: 100, props: { label, cellRef, format: 'number', placeholder } });

const output = (x, y, label, cellRef, format) =>
  ({ id: nextId(), type: 'output-field', x, y, w: 260, h: 64, props: { label, cellRef, cellRange: '', format, chartTitle: '', xAxisTitle: '', yAxisTitle: '' } });

const barChart = (x, y, w, h, cellRange, chartTitle, xAxisTitle, yAxisTitle) =>
  ({ id: nextId(), type: 'output-field', x, y, w, h, props: { label: 'Chart', cellRef: '', cellRange, format: 'bar-chart', chartTitle, xAxisTitle, yAxisTitle } });

const pieChart = (x, y, w, h, cellRange, chartTitle) =>
  ({ id: nextId(), type: 'output-field', x, y, w, h, props: { label: 'Chart', cellRef: '', cellRange, format: 'pie-chart', chartTitle, xAxisTitle: '', yAxisTitle: '' } });

const table = (x, y, w, h, cellRange, chartTitle) =>
  ({ id: nextId(), type: 'output-field', x, y, w, h, props: { label: 'Report', cellRef: '', cellRange, format: 'table', chartTitle, showCellRef: false, xAxisTitle: '', yAxisTitle: '' } });

// -- Pages --------------------------------------------------------------------
// Cell map (see masterdemo-lemonade-build.js): B1 price, B2 weather code, B3 cups made,
// B4-B6 cost per cup, B7 weather name, B9 cups sold, B10 wasted, B11 share sold, B12 revenue,
// B13-B15 cost by ingredient, B16 total cost, B17 profit, B18 verdict.
function buildPages() {
  const WEATHER_HINT = '1 = Sunny, 2 = Cloudy, 3 = Rainy';

  const page1 = [
    text(40, 30, 620, 48, 'Lemonade Stand Simulator', { fontSize: 28, color: COLORS.heading, bold: true }),
    text(40, 88, 620, 64, 'You run a lemonade stand for one day. Pick a price, check the weather and decide how many cups to make. Can you make a profit?'),
    text(40, 156, 620, 28, "Tip: cups you make but don't sell are wasted money.", { fontSize: 13, color: COLORS.hint }),
    // left column: things you choose
    sliderInput(40, 210, 'Price per cup ($)', 'B1', '0.5', '3.5', '0.25'),
    dropdownInput(40, 306, 'Weather', 'B2', '1,2,3', 'Pick 1, 2 or 3 (default 1)'),
    text(40, 372, 260, 24, WEATHER_HINT, { fontSize: 12, color: COLORS.hint }),
    numberInput(40, 408, 'Cups to make', 'B3', 'e.g. 100'),
    // right column: what happens
    output(400, 210, 'Weather today', 'B7', 'text'),
    output(400, 290, 'Cups sold', 'B9', 'number'),
    output(400, 370, 'Money coming in', 'B12', 'currency'),
    output(400, 450, 'Profit', 'B17', 'currency'),
    output(400, 530, 'Verdict', 'B18', 'text'),
  ];

  const page2 = [
    text(40, 30, 700, 44, 'Costs, cups and profit at a glance', { fontSize: 26, color: COLORS.heading, bold: true }),
    text(40, 78, 860, 28, 'This page keeps its own settings - changing them here does not change the other pages.', { fontSize: 13, color: COLORS.note, bold: true }),
    // costs + cups (number inputs)
    numberInput(40, 130, 'Lemons per cup ($)', 'B4', '0.20'),
    numberInput(40, 210, 'Sugar per cup ($)', 'B5', '0.10'),
    numberInput(40, 290, 'Cup and ice per cup ($)', 'B6', '0.10'),
    numberInput(40, 370, 'Cups to make', 'B3', 'e.g. 100'),
    // price + weather so the charts can be played with on this page too
    sliderInput(310, 130, 'Price per cup ($)', 'B1', '0.5', '3.5', '0.25'),
    dropdownInput(310, 226, 'Weather', 'B2', '1,2,3', 'Pick 1, 2 or 3 (default 1)'),
    text(310, 292, 240, 24, WEATHER_HINT, { fontSize: 12, color: COLORS.hint }),
    output(310, 330, 'Share of cups sold', 'B11', 'percentage'),
    // outputs
    table(590, 130, 310, 260, 'B3,B9,B10,B12,B16,B17', 'Daily report'),
    pieChart(40, 470, 340, 250, 'B13:B15', 'Cost of each ingredient'),
    barChart(420, 470, 380, 260, 'B3,B9,B10', 'Cups: made, sold and wasted', 'Cups', 'Number'),
  ];

  const page3 = [
    text(40, 30, 700, 44, 'Test your own scenario', { fontSize: 26, color: COLORS.heading, bold: true }),
    text(40, 80, 700, 48, 'Real life is unpredictable. Type your own number of cups sold below and see what happens to your money.'),
    text(40, 132, 700, 28, 'Then change the price or weather: your number resets, because the answer it replaced has changed.', { fontSize: 13, color: COLORS.hint }),
    sliderInput(40, 190, 'Price per cup ($)', 'B1', '0.5', '3.5', '0.25'),
    dropdownInput(40, 286, 'Weather', 'B2', '1,2,3', 'Pick 1, 2 or 3 (default 1)'),
    text(40, 352, 260, 24, WEATHER_HINT, { fontSize: 12, color: COLORS.hint }),
    numberInput(40, 388, 'Cups to make', 'B3', 'e.g. 100'),
    overrideInput(40, 468, 'Cups sold (type your own number)', 'B9', 'Type to override'),
    output(400, 190, 'Money coming in', 'B12', 'currency'),
    output(400, 270, 'Total cost', 'B16', 'currency'),
    output(400, 350, 'Profit', 'B17', 'currency'),
    output(400, 430, 'Verdict', 'B18', 'text'),
  ];

  return [
    { name: 'Meet the Stand', elements: page1 },
    { name: 'Where Does the Money Go?', elements: page2 },
    { name: 'What If?', elements: page3 },
  ];
}

// -- Sanity checks ------------------------------------------------------------
function validate(pages, excelData) {
  const problems = [];
  const known = new Set(Object.keys(excelData.cells));
  for (const page of pages) {
    for (const el of page.elements) {
      if (el.type === 'text') continue;
      const refs = [];
      if (el.props.cellRef) refs.push(el.props.cellRef);
      if (el.props.cellRange) refs.push(...expandRange(el.props.cellRange));
      for (const ref of refs) {
        if (!known.has(ref.toUpperCase())) problems.push(`${page.name}: ${el.props.label || el.type} references unknown cell ${ref}`);
      }
      if (el.props.cellRef && el.type === 'input-field' && el.props.format === 'range') {
        const mid = (Number(el.props.min) + Number(el.props.max)) / 2;
        const def = Number(excelData.cells[el.props.cellRef.toUpperCase()]?.value);
        if (mid !== def) problems.push(`${page.name}: slider ${el.props.cellRef} shows midpoint ${mid} untouched but the model default is ${def}`);
      }
    }
  }
  return problems;
}

// -- Main ---------------------------------------------------------------------
(async () => {
  if (!USERNAME) {
    console.error('Missing --user <username>.  Example: node scripts/masterdemo-lemonade-seed.js --user admin');
    process.exit(1);
  }
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`Workbook not found: ${XLSX_PATH}\nRun first: node scripts/masterdemo-lemonade-build.js`);
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set (expected in backend/.env).');
    process.exit(1);
  }

  const excelData = buildExcelData(fs.readFileSync(XLSX_PATH));
  const pages = buildPages();
  const problems = validate(pages, excelData);
  if (problems.length) {
    console.error('Layout problems:\n - ' + problems.join('\n - '));
    process.exit(1);
  }

  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: user, error: userErr } = await sb.from('users').select('id,username,organisation_id').eq('username', USERNAME).maybeSingle();
  if (userErr) throw userErr;
  if (!user) throw new Error(`No user with username "${USERNAME}".`);
  if (!user.organisation_id) throw new Error(`User "${USERNAME}" has no organisation; projects need one.`);

  const { data: existing, error: exErr } = await sb.from('projects').select('id').eq('created_by', user.id).eq('name', PROJECT_NAME);
  if (exErr) throw exErr;
  if (existing.length > 1) throw new Error(`"${PROJECT_NAME}" matches ${existing.length} projects for ${USERNAME}; refusing to guess. Use --name.`);
  const project = existing[0] || null;

  let existingPages = [];
  if (project) {
    const { data, error } = await sb.from('project_pages').select('id,name,sort_order').eq('project_id', project.id).order('sort_order', { ascending: true });
    if (error) throw error;
    existingPages = data;
  }

  console.log(`Database : ${new URL(process.env.SUPABASE_URL).host}`);
  console.log(`User     : ${user.username}`);
  console.log(`Project  : "${PROJECT_NAME}" -> ${project ? `UPDATE existing (${project.id})` : 'CREATE new'}`);
  pages.forEach((p, i) => {
    const target = existingPages[i];
    console.log(`  Page ${i + 1} "${p.name}": ${p.elements.length} elements -> ${target ? `overwrite page ${target.id}` : 'create'}`);
  });
  if (existingPages.length > pages.length) {
    console.log(`  Note: ${existingPages.length - pages.length} extra existing page(s) beyond the demo's ${pages.length} are left untouched.`);
  }

  if (!WRITE) {
    console.log('\nDRY RUN - nothing written. Re-run with --write to apply.');
    return;
  }

  let projectId;
  if (project) {
    projectId = project.id;
    const { error } = await sb.from('projects').update({ excel_data: excelData, description: DESCRIPTION, updated_at: new Date().toISOString() }).eq('id', projectId);
    if (error) throw error;
  } else {
    const { data, error } = await sb.from('projects')
      .insert([{ name: PROJECT_NAME, description: DESCRIPTION, created_by: user.id, organisation_id: user.organisation_id, excel_data: excelData, visibility: 'private' }])
      .select('id').single();
    if (error) throw error;
    projectId = data.id;
  }

  for (let i = 0; i < pages.length; i++) {
    const target = existingPages[i];
    if (target) {
      const { error } = await sb.from('project_pages')
        .update({ name: pages[i].name, sort_order: i, elements: pages[i].elements, updated_at: new Date().toISOString() })
        .eq('id', target.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from('project_pages')
        .insert([{ project_id: projectId, name: pages[i].name, sort_order: i, elements: pages[i].elements }]);
      if (error) throw error;
    }
  }

  console.log(`\nDone. Project id: ${projectId}. Open "${PROJECT_NAME}" from the dashboard.`);
})().catch((e) => { console.error('ERROR:', e.message || e); process.exit(1); });
