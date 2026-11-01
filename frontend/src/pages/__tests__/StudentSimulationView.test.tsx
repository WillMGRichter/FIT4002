import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StudentSimulationView } from '../StudentSimulationView';

// ── Mocks ────────────────────────────────────────────────────────────────────
// Router: this page reads useParams (projectId), useNavigate, useLocation. The stub in
// src/test-utils covers these, but we override to supply a concrete projectId and location.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: 'proj-1' }),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
}));

// Auth: supply a token so the load effect runs its fetches.
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' }),
}));

// AppShell wraps the page in nav chrome we don't care about here; render children only.
jest.mock('../../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// projectStorage.addRecent touches localStorage; stub it out.
jest.mock('../../utils/projectStorage', () => ({
  addRecent: jest.fn(),
}));

// ── Test fixtures ──────────────────────────────────────────────────────────────
// Workbook: A1 is a literal input (5); B1 is a formula =A1*2 (default 10).
const excelData = {
  cells: {
    A1: { value: 5, formula: null, type: 'n' },
    B1: { value: 10, formula: '=A1*2', type: 'n' },
  },
  inputCells: [{ ref: 'A1', title: 'Alpha' }],
  outputCells: [{ ref: 'B1', title: 'Beta' }],
};

// Each page has an input for A1, an input for B1 (so B1 can be overridden), and a B1 output.
const makePage = (id: string, name: string) => ({
  id,
  name,
  sort_order: 0,
  elements: [
    {
      id: `${id}-inA1`,
      type: 'input-field',
      x: 0, y: 0, w: 100, h: 40,
      props: { label: 'A1 input', cellRef: 'A1', format: 'number' },
    },
    {
      id: `${id}-inB1`,
      type: 'input-field',
      x: 0, y: 60, w: 100, h: 40,
      props: { label: 'B1 override', cellRef: 'B1', format: 'number' },
    },
    {
      id: `${id}-outB1`,
      type: 'output-field',
      x: 0, y: 120, w: 100, h: 40,
      props: { label: 'B1 output', cellRef: 'B1', format: 'number' },
    },
  ],
});

const pages = [makePage('page-1', 'Page One'), makePage('page-2', 'Page Two')];
const project = { name: 'Test Sim', excel_data: excelData };

// Route fetch() calls by URL to the right fixture. Order-independent.
function installFetchMock() {
  (global as any).fetch = jest.fn((url: string, _opts?: any) => {
    const body = (data: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    if (url.endsWith('/projects/proj-1')) return body(project);
    if (url.endsWith('/projects/proj-1/pages')) return body(pages);
    if (url.includes('/student-state/proj-1/state')) return body({ id: 'state-1', attempt_number: 1 });
    if (url.endsWith('/projects/proj-1/participants')) return body([]);
    // PUT/POST saves during interaction.
    return body({});
  });
}

// Read the rendered value of the single B1 output field.
function getB1Output(): string {
  // The output-field renders <label>B1 output</label> then a sibling value div.
  const label = screen.getByText('B1 output');
  // eslint-disable-next-line testing-library/no-node-access -- the value div is a sibling of the label (no htmlFor/role to query by)
  const container = label.parentElement as HTMLElement;
  // The value div is the last child text; grab all text and strip the label.
  return (container.textContent || '').replace('B1 output', '').trim();
}

// The component renders <label>{text}</label> as a SIBLING of the input (no htmlFor), so
// getByLabelText won't associate them. Find the input by locating its label then querying
// the input within the shared .fieldElem parent.
function getInputByLabel(labelText: string): HTMLElement {
  const label = screen.getByText(labelText);
  // eslint-disable-next-line testing-library/no-node-access -- the label is a sibling of the input (no htmlFor), so go via the shared parent
  const container = label.parentElement as HTMLElement;
  const input = within(container).getByRole('spinbutton'); // number inputs expose role "spinbutton"
  return input;
}

beforeEach(() => {
  jest.clearAllMocks();
  installFetchMock();
});

describe('StudentSimulationView', () => {
  it('computes formula outputs from spreadsheet defaults on load', async () => {
    render(<StudentSimulationView />);
    // Wait for load to finish (Page One heading appears).
    expect(await screen.findByText('Page One')).toBeInTheDocument();
    // B1 = A1*2 = 5*2 = 10 by default.
    await waitFor(() => expect(getB1Output()).toBe('10'));
  });

  it('recomputes outputs when a student changes an input', async () => {
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    // Find A1 input by its label.
    const a1Input = getInputByLabel('A1 input');
    await userEvent.type(a1Input, '7');

    // B1 = A1*2 = 14 now.
    await waitFor(() => expect(getB1Output()).toBe('14'));
  });

  it('isolates inputs per page: page 2 does not inherit page 1 input', async () => {
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    // On page 1, set A1 = 7 -> B1 becomes 14.
    await userEvent.type(getInputByLabel('A1 input'), '7');
    await waitFor(() => expect(getB1Output()).toBe('14'));

    // Go to page 2 via the Next button.
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Page Two');

    // Page 2 has its OWN input map -> A1 empty -> B1 back to default 10.
    const a1OnPage2 = getInputByLabel('A1 input') as HTMLInputElement;
    expect(a1OnPage2.value).toBe('');
    await waitFor(() => expect(getB1Output()).toBe('10'));
  });

  it('honours a manual override of a formula cell, then auto-reverts when an upstream input changes', async () => {
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    // Override B1 (a formula cell) to 99.
    await userEvent.type(getInputByLabel('B1 override'), '99');
    await waitFor(() => expect(getB1Output()).toBe('99'));

    // The override UI should appear.
    expect(screen.getByText(/manual override/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset to formula/i })).toBeInTheDocument();

    // Now change A1 (upstream of B1). The override must auto-revert and B1 recompute = A1*2.
    await userEvent.type(getInputByLabel('A1 input'), '4');
    await waitFor(() => expect(getB1Output()).toBe('8'));

    // Override notice should be gone.
    expect(screen.queryByText(/manual override/i)).not.toBeInTheDocument();
  });

  it('clears an override via the Reset to formula button', async () => {
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    await userEvent.type(getInputByLabel('B1 override'), '99');
    await waitFor(() => expect(getB1Output()).toBe('99'));

    await userEvent.click(screen.getByRole('button', { name: /reset to formula/i }));

    // Back to default B1 = A1*2 = 10.
    await waitFor(() => expect(getB1Output()).toBe('10'));
    expect(screen.queryByText(/manual override/i)).not.toBeInTheDocument();
  });
});

// ── Table output element (2D rows x columns) ─────────────────────────────────
// These cover the renderTable path: header row, per-cell value mapping via each column's
// range, ragged/short ranges rendering empty cells, the legacy single-column cellRange
// fallback, and the optional chartTitle. A separate fetch mock supplies a workbook with two
// columns of numeric data (B2:B4 and C2:C4) so cell values are easy to assert.
describe('StudentSimulationView - table output', () => {
  // Workbook: two columns of literals. B2:B4 = 10/20/30, C2:C4 = 1/2/3.
  const tableExcel = {
    cells: {
      B2: { value: 10, formula: null, type: 'n' },
      B3: { value: 20, formula: null, type: 'n' },
      B4: { value: 30, formula: null, type: 'n' },
      C2: { value: 1, formula: null, type: 'n' },
      C3: { value: 2, formula: null, type: 'n' },
      C4: { value: 3, formula: null, type: 'n' },
    },
    inputCells: [],
    outputCells: [
      { ref: 'B2', title: '' }, { ref: 'B3', title: '' }, { ref: 'B4', title: '' },
      { ref: 'C2', title: '' }, { ref: 'C3', title: '' }, { ref: 'C4', title: '' },
    ],
  };

  // A page with a single table output element built from `props`.
  const tablePage = (props: Record<string, any>) => ([{
    id: 'tpage-1',
    name: 'Table Page',
    sort_order: 0,
    elements: [{
      id: 'tpage-1-table',
      type: 'output-field',
      x: 0, y: 0, w: 400, h: 300,
      props: { label: 'Report', format: 'table', ...props },
    }],
  }]);

  // Install a fetch mock that serves the given pages for this block's fixtures.
  function installTableFetchMock(pagesFixture: any) {
    (global as any).fetch = jest.fn((url: string, _opts?: any) => {
      const body = (data: any) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
      if (url.endsWith('/projects/proj-1')) return body({ name: 'Table Sim', excel_data: tableExcel });
      if (url.endsWith('/projects/proj-1/pages')) return body(pagesFixture);
      if (url.includes('/student-state/proj-1/state')) return body({ id: 'state-1', attempt_number: 1 });
      if (url.endsWith('/projects/proj-1/participants')) return body([]);
      return body({});
    });
  }

  // Return the rendered table's body as an array of row cell-text arrays.
  function getTableMatrix(): string[][] {
    const table = screen.getByRole('table');
    const bodyRows = within(table).getAllByRole('row').slice(1); // drop the header row
    return bodyRows.map(tr => within(tr).getAllByRole('cell').map(td => (td.textContent || '').trim()));
  }

  it('renders a 2D table: header row plus a value per (row, column) from each column range', async () => {
    installTableFetchMock(tablePage({
      tableRowHeader: 'Month',
      tableRows: ['Jan', 'Feb', 'Mar'],
      tableColumns: [
        { header: 'Sales', range: 'B2:B4' },
        { header: 'Units', range: 'C2:C4' },
      ],
    }));
    render(<StudentSimulationView />);
    await screen.findByText('Table Page');

    // Column headers present.
    expect(screen.getByRole('columnheader', { name: 'Sales' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Units' })).toBeInTheDocument();

    // Body: row label then the mapped value from each column's range, by row index.
    // Jan -> B2=10, C2=1 | Feb -> B3=20, C3=2 | Mar -> B4=30, C4=3
    await waitFor(() => expect(getTableMatrix()).toEqual([
      ['Jan', '10', '1'],
      ['Feb', '20', '2'],
      ['Mar', '30', '3'],
    ]));
  });

  it('renders empty cells when a column range is shorter than the row count (ragged ranges)', async () => {
    installTableFetchMock(tablePage({
      tableRows: ['Jan', 'Feb', 'Mar'],
      tableColumns: [
        { header: 'Sales', range: 'B2:B4' }, // 3 values
        { header: 'Units', range: 'C2:C3' }, // only 2 values -> 3rd row blank
      ],
    }));
    render(<StudentSimulationView />);
    await screen.findByText('Table Page');

    await waitFor(() => expect(getTableMatrix()).toEqual([
      ['Jan', '10', '1'],
      ['Feb', '20', '2'],
      ['Mar', '30', ''], // C4 not in range -> empty, not 0 or a crash
    ]));
  });

  it('falls back to a single-column table for the legacy cellRange shape', async () => {
    // No tableRows/tableColumns: legacy element with just cellRange.
    installTableFetchMock(tablePage({ cellRange: 'B2:B4' }));
    render(<StudentSimulationView />);
    await screen.findByText('Table Page');

    // Legacy path: one data column (header "Column 1"); row labels are the computed values.
    expect(screen.getByRole('columnheader', { name: 'Column 1' })).toBeInTheDocument();
    await waitFor(() => expect(getTableMatrix()).toEqual([
      ['10', '10'],
      ['20', '20'],
      ['30', '30'],
    ]));
  });

  it('renders the chartTitle above the table when provided', async () => {
    installTableFetchMock(tablePage({
      chartTitle: 'Quarterly Report',
      tableRows: ['Jan'],
      tableColumns: [{ header: 'Sales', range: 'B2:B2' }],
    }));
    render(<StudentSimulationView />);
    await screen.findByText('Table Page');

    expect(await screen.findByText('Quarterly Report')).toBeInTheDocument();
  });
});

// ── Persistence, submit, attempts and load failures ──────────────────────────
// These cover the server round-trips: resuming saved state, debounced auto-save, page-change
// saves, submit (success + failure), the attempts flow and load errors. A configurable fetch
// mock records every call so we can assert on method, URL and body.
describe('StudentSimulationView - server interaction', () => {
  interface ApiOpts {
    stateResponses?: Array<{ status: number; body: any }>; // consumed in order, last one repeats
    participants?: any[];
    projectOk?: boolean;
    completeOk?: boolean;
  }

  let calls: Array<{ method: string; url: string; body: any }>;

  function installApi(opts: ApiOpts = {}) {
    const stateResponses = opts.stateResponses ?? [{ status: 200, body: { id: 'state-1', attempt_number: 1 } }];
    let stateCall = 0;
    calls = [];
    (global as any).fetch = jest.fn((url: string, init?: any) => {
      const method = init?.method || 'GET';
      calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined });
      const res = (status: number, data: any) =>
        Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) });

      if (url.endsWith('/projects/proj-1')) return opts.projectOk === false ? res(500, {}) : res(200, project);
      if (url.endsWith('/projects/proj-1/pages')) return res(200, pages);
      if (url.endsWith('/projects/proj-1/participants')) return res(200, opts.participants ?? []);
      if (url.endsWith('/state/complete')) return opts.completeOk === false ? res(500, {}) : res(200, {});
      if (url.endsWith('/student-state/proj-1/state') && method === 'GET') {
        const r = stateResponses[Math.min(stateCall++, stateResponses.length - 1)];
        return res(r.status, r.body);
      }
      return res(200, {}); // PUT /state/inputs, PUT /state/page
    });
  }

  const callsTo = (method: string, suffix: string) =>
    calls.filter(c => c.method === method && c.url.endsWith(suffix));

  // Go to the last page, where the Submit button lives.
  async function goToLastPage() {
    await screen.findByText('Page One');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Page Two');
  }

  it('resumes saved inputs and the saved page from the server state', async () => {
    installApi({
      stateResponses: [{
        status: 200,
        body: {
          id: 'state-1',
          attempt_number: 2,
          current_page_id: 'page-2',
          input_values: { 'page-2': { A1: 7 } },
        },
      }],
    });
    render(<StudentSimulationView />);

    // Lands on the saved page, not page 1, with the saved input applied.
    expect(await screen.findByText('Page Two')).toBeInTheDocument();
    expect((getInputByLabel('A1 input') as HTMLInputElement).value).toBe('7');
    await waitFor(() => expect(getB1Output()).toBe('14'));
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
  });

  it('auto-saves inputs after a debounce, as one PUT with the final value', async () => {
    installApi();
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    // Two quick keystrokes must coalesce into a single save.
    // Note: the component doesn't cancel its debounce timer on unmount, so saves left over from
    // earlier tests can fire into this test's fetch mock. Those never contain 9 or 3 (no other
    // test types them), so we only count saves carrying this test's own values.
    const savesWith = (v: string) =>
      callsTo('PUT', '/state/inputs').filter(c => c.body.inputValues['page-1']?.A1 === v);

    await userEvent.type(getInputByLabel('A1 input'), '93');
    expect(savesWith('93')).toHaveLength(0); // nothing sent yet

    await waitFor(() => expect(savesWith('93')).toHaveLength(1), { timeout: 3000 });
    expect(savesWith('93')[0].body.stateId).toBe('state-1');
    expect(savesWith('9')).toHaveLength(0); // the intermediate value was never saved
  });

  it('saves the new page to the server when the student navigates', async () => {
    installApi();
    render(<StudentSimulationView />);
    await screen.findByText('Page One');

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Page Two');

    await waitFor(() => expect(callsTo('PUT', '/state/page')).toHaveLength(1));
    expect(callsTo('PUT', '/state/page')[0].body).toEqual({ stateId: 'state-1', pageId: 'page-2' });
  });

  it('only shows Submit on the last page', async () => {
    installApi();
    render(<StudentSimulationView />);
    await screen.findByText('Page One');
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('submits the answers and shows the completion screen', async () => {
    installApi();
    render(<StudentSimulationView />);
    await screen.findByText('Page One');
    await userEvent.type(getInputByLabel('A1 input'), '7');
    await userEvent.click(screen.getByRole('button', { name: /next/i }));
    await screen.findByText('Page Two');

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText('Simulation Complete', { selector: 'h1' })).toBeInTheDocument();
    const complete = callsTo('POST', '/state/complete');
    expect(complete).toHaveLength(1);
    expect(complete[0].body.stateId).toBe('state-1');
    expect(complete[0].body.inputValues['page-1'].A1).toBe('7');
    // The full inputs are also flushed via the save endpoint before completing.
    expect(callsTo('PUT', '/state/inputs').length).toBeGreaterThanOrEqual(1);
  });

  it('shows an error and does not show completion when submit fails', async () => {
    installApi({ completeOk: false });
    render(<StudentSimulationView />);
    await goToLastPage();

    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText('Failed to submit')).toBeInTheDocument();
    expect(screen.queryByText('Simulation Complete', { selector: 'h1' })).not.toBeInTheDocument();
  });

  it('offers another attempt only while attempts remain, and starts a clean new attempt', async () => {
    installApi({
      participants: [{ user_id: 'stu-1', max_attempts: 3 }],
      stateResponses: [
        { status: 200, body: { id: 'state-1', attempt_number: 1 } },
        { status: 200, body: { id: 'state-2', attempt_number: 2 } },
      ],
    });
    render(<StudentSimulationView overrideUserId="stu-1" />);
    await goToLastPage();
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    const another = await screen.findByRole('button', { name: /do another attempt/i });
    expect(screen.getByText(/attempt 1 of 3 used/i)).toBeInTheDocument();

    await userEvent.click(another);

    // Back in the simulation on page 1 with the new attempt number and empty inputs.
    expect(await screen.findByText('Page One')).toBeInTheDocument();
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect((getInputByLabel('A1 input') as HTMLInputElement).value).toBe('');

    // Later saves target the NEW state id.
    await userEvent.type(getInputByLabel('A1 input'), '5');
    await waitFor(() => expect(callsTo('PUT', '/state/inputs').some(c => c.body.stateId === 'state-2')).toBe(true), { timeout: 3000 });
  });

  it('does not offer another attempt when the maximum has been used', async () => {
    installApi({
      participants: [{ user_id: 'stu-1', max_attempts: 1 }],
    });
    render(<StudentSimulationView overrideUserId="stu-1" />);
    await goToLastPage();
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));

    await screen.findByText('Simulation Complete', { selector: 'h1' });
    expect(screen.queryByRole('button', { name: /do another attempt/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /i'm finished/i })).toBeInTheDocument();
  });

  it('shows "used all your attempts" when the backend refuses a new attempt', async () => {
    installApi({
      participants: [{ user_id: 'stu-1', max_attempts: 3 }],
      stateResponses: [
        { status: 200, body: { id: 'state-1', attempt_number: 1 } },
        { status: 400, body: { error: 'No attempts remaining' } },
      ],
    });
    render(<StudentSimulationView overrideUserId="stu-1" />);
    await goToLastPage();
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    await userEvent.click(await screen.findByRole('button', { name: /do another attempt/i }));

    expect(await screen.findByText(/used all your attempts/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /do another attempt/i })).not.toBeInTheDocument();
  });

  it('navigates to /done from the completion screen', async () => {
    installApi();
    render(<StudentSimulationView />);
    await goToLastPage();
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    await userEvent.click(await screen.findByRole('button', { name: /i'm finished/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/done');
  });

  it('shows an error when the simulation cannot be loaded', async () => {
    installApi({ projectOk: false });
    render(<StudentSimulationView />);

    expect(await screen.findByText('Failed to load simulation')).toBeInTheDocument();
    expect(screen.queryByText('Page One')).not.toBeInTheDocument();
  });

  it("surfaces the backend's reason when the student's state is refused", async () => {
    installApi({ stateResponses: [{ status: 400, body: { error: 'No attempts remaining' } }] });
    render(<StudentSimulationView />);

    expect(await screen.findByText('No attempts remaining')).toBeInTheDocument();
    expect(screen.queryByText('Page One')).not.toBeInTheDocument();
  });

  it('falls back to a generic message when a refused state has no error body', async () => {
    installApi({ stateResponses: [{ status: 500, body: {} }] });
    render(<StudentSimulationView />);

    expect(await screen.findByText('Unable to start this simulation.')).toBeInTheDocument();
  });
});
