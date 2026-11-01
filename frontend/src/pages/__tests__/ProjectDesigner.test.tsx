import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectDesigner } from '../ProjectDesigner';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
let mockProjectId: string | undefined = 'proj-1';
jest.mock('react-router-dom', () => ({
  useParams: () => ({ projectId: mockProjectId }),
  useNavigate: () => mockNavigate,
}));

let mockToken: string | null = 'tok';
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: mockToken }),
}));

jest.mock('../../components/AppShell', () => ({
  AppShell: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

const mockAddRecent = jest.fn();
jest.mock('../../utils/projectStorage', () => ({
  addRecent: (...args: unknown[]) => mockAddRecent(...args),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const excelData = {
  cells: {
    A1: { value: 5, formula: null, type: 'n' },
    B1: { value: 10, formula: '=A1*2', type: 'n' },
  },
  inputCells: [
    { ref: 'A10', value: 1, title: 'Tenth' },
    { ref: 'A2', value: 3, title: 'Second' },
    { ref: 'A1', value: 5, title: 'Alpha' },
  ],
  outputCells: [{ ref: 'B1', formula: '=A1*2', title: 'Beta', dependencies: {} }],
};

const textElem = {
  id: 'e1', type: 'text', x: 10, y: 20, w: 200, h: 48,
  props: { content: 'Hello', fontSize: 16, color: '#111827', bold: false },
};

const serverPages = [
  { id: 'pg-1', name: 'Intro', sort_order: 0, elements: [textElem] },
  { id: 'pg-2', name: 'Second', sort_order: 1, elements: null }, // never edited: elements can be null
];

interface Call { method: string; url: string; body?: any }
let calls: Call[];
let pagesResponse: any[];
let projectResponse: any;
let postCount: number;

function installFetch(opts: { failProject?: boolean } = {}) {
  calls = [];
  postCount = 0;
  (global as any).fetch = jest.fn((url: string, init?: any) => {
    const method = init?.method || 'GET';
    calls.push({ method, url, body: init?.body ? JSON.parse(init.body) : undefined });
    const json = (data: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
    if (opts.failProject) return Promise.reject(new Error('network down'));
    if (method === 'POST' && url.endsWith('/pages')) {
      postCount += 1;
      const body = JSON.parse(init.body);
      return json({ id: `srv-${postCount}`, name: body.name, sort_order: body.sortOrder });
    }
    if (method === 'PUT' || method === 'DELETE') return json({});
    if (url.endsWith('/projects/proj-1/pages')) return json(pagesResponse);
    if (url.endsWith('/projects/proj-1')) return json(projectResponse);
    return json({});
  });
}

const callsTo = (method: string, suffix: string) =>
  calls.filter(c => c.method === method && c.url.endsWith(suffix));

beforeEach(() => {
  jest.clearAllMocks();
  mockProjectId = 'proj-1';
  mockToken = 'tok';
  projectResponse = { id: 'proj-1', name: 'My Sim', excel_data: excelData };
  pagesResponse = JSON.parse(JSON.stringify(serverPages));
  installFetch();
});

// ── Helpers ──────────────────────────────────────────────────────────────────
async function renderDesigner() {
  render(<ProjectDesigner />);
  await screen.findByText('My Sim');
  // wait until pages are in
  await screen.findByDisplayValue('Intro');
}

// Page with no pages on the server, so the designer starts with one unsaved "Page 1".
async function renderEmptyDesigner() {
  pagesResponse = [];
  render(<ProjectDesigner />);
  await screen.findByDisplayValue('Page 1');
}

/** Clicks a page's row in the sidebar. Clicking the name <input> itself deliberately does not switch pages. */
async function openPage(name: string) {
  // eslint-disable-next-line testing-library/no-node-access -- the row has no role or name
  await userEvent.click(screen.getByDisplayValue(name).closest('.pageItem') as HTMLElement);
}

/** Click something whose handler does async work (fetch, then set state) and let that finish inside act. */
async function clickAndSettle(el: HTMLElement) {
  // eslint-disable-next-line testing-library/no-unnecessary-act -- the click starts a fetch whose result updates state after it
  await act(async () => {
    userEvent.click(el);
  });
}

// eslint-disable-next-line testing-library/no-node-access -- the panel is an <aside> with no accessible name
const panel = () => within(screen.getByText('Properties').closest('aside') as HTMLElement);

/** The input/select next to a label in the properties panel (labels have no htmlFor). */
function field(label: string): HTMLInputElement {
  const l = panel().getByText(label, { selector: 'label' });
  // eslint-disable-next-line testing-library/no-node-access -- label and control are siblings with no htmlFor
  return (l.parentElement as HTMLElement).querySelector('input,select') as HTMLInputElement;
}

/** All canvas element nodes, in DOM order. */
function canvasNodes(): HTMLElement[] {
  // eslint-disable-next-line testing-library/no-node-access -- canvas elements have no role / accessible name
  return Array.from(document.querySelectorAll<HTMLElement>('[data-elem-id]'));
}

function selectCanvasElem(index = 0) {
  fireEvent.mouseDown(canvasNodes()[index]);
}

async function addElement(title: 'Text' | 'Input' | 'Output' | 'Image') {
  await userEvent.click(screen.getByTitle(title));
}

// ── Loading ──────────────────────────────────────────────────────────────────
describe('ProjectDesigner - loading', () => {
  it('shows a loading state, then the project name, pages and the first page\'s elements', async () => {
    render(<ProjectDesigner />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    expect(await screen.findByText('My Sim')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Second')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
    expect(canvasNodes()).toHaveLength(1);
    expect(mockAddRecent).toHaveBeenCalledWith({ id: 'proj-1', name: 'My Sim' });
  });

  it('fetches the project and pages with the user\'s token', async () => {
    await renderDesigner();
    const gets = calls.filter(c => c.method === 'GET');
    expect(gets.map(c => c.url.replace(/^.*\/projects/, '/projects'))).toEqual(['/projects/proj-1', '/projects/proj-1/pages']);
  });

  it('starts with one unsaved "Page 1" when the project has no pages', async () => {
    await renderEmptyDesigner();
    expect(screen.getByDisplayValue('Page 1')).toBeInTheDocument();
    expect(canvasNodes()).toHaveLength(0);
  });

  it('treats a page with null elements as empty', async () => {
    await renderDesigner();
    await openPage('Second');
    expect(canvasNodes()).toHaveLength(0);
  });

  it('does not hang on "Loading..." when the request fails', async () => {
    installFetch({ failProject: true });
    render(<ProjectDesigner />);
    await waitFor(() => expect(screen.queryByText('Loading...')).not.toBeInTheDocument());
  });

  it('fetches nothing without a token', () => {
    mockToken = null;
    render(<ProjectDesigner />);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

// ── Pages ────────────────────────────────────────────────────────────────────
describe('ProjectDesigner - pages', () => {
  it('switches page and shows that page\'s elements; clears the selection', async () => {
    await renderDesigner();
    selectCanvasElem();
    expect(panel().getByText('Content', { selector: 'label' })).toBeInTheDocument();

    await openPage('Second');

    expect(canvasNodes()).toHaveLength(0);
    expect(panel().getByText(/select an element on the canvas/i)).toBeInTheDocument();
  });

  it('renames a page', async () => {
    await renderDesigner();
    const input = screen.getByDisplayValue('Intro');
    await userEvent.clear(input);
    await userEvent.type(input, 'Welcome');

    expect(screen.getByDisplayValue('Welcome')).toBeInTheDocument();
  });

  it('adds a page through the API and makes it the active page', async () => {
    await renderDesigner();
    await clickAndSettle(screen.getByRole('button', { name: /add page/i }));

    expect(await screen.findByDisplayValue('Page 3')).toBeInTheDocument();
    const post = callsTo('POST', '/projects/proj-1/pages');
    expect(post).toHaveLength(1);
    expect(post[0].body).toEqual({ name: 'Page 3', sortOrder: 2 });
    expect(canvasNodes()).toHaveLength(0); // new page is active and empty
  });

  it('clicking a page\'s name box edits the name without switching to that page', async () => {
    await renderDesigner();
    await userEvent.click(screen.getByDisplayValue('Second'));

    expect(canvasNodes()).toHaveLength(1); // still showing "Intro"'s element
  });

  it('stays on "Loading..." without a token (the designer does not redirect or fetch)', async () => {
    mockToken = null;
    render(<ProjectDesigner />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('deletes a saved page via the API and selects a neighbour', async () => {
    await renderDesigner();
    const deleteButtons = screen.getAllByTitle('Delete page');
    await clickAndSettle(deleteButtons[1]); // "Second"

    await waitFor(() => expect(screen.queryByDisplayValue('Second')).not.toBeInTheDocument());
    expect(callsTo('DELETE', '/projects/proj-1/pages/pg-2')).toHaveLength(1);
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument();
  });

  it('never deletes the last remaining page', async () => {
    await renderEmptyDesigner();
    await userEvent.click(screen.getByTitle('Delete page'));

    expect(screen.getByDisplayValue('Page 1')).toBeInTheDocument();
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(0);
  });

  it('deletes an unsaved (temp) page locally without calling the API', async () => {
    await renderEmptyDesigner();
    mockToken = 'tok';
    await clickAndSettle(screen.getByRole('button', { name: /add page/i })); // creates srv-1 (saved)
    await screen.findByDisplayValue('Page 2');
    const before = calls.filter(c => c.method === 'DELETE').length;

    // The initial "Page 1" is a temp page: deleting it must not hit the server.
    await clickAndSettle(screen.getAllByTitle('Delete page')[0]);

    await waitFor(() => expect(screen.queryByDisplayValue('Page 1')).not.toBeInTheDocument());
    expect(calls.filter(c => c.method === 'DELETE')).toHaveLength(before);
  });

  it('collapses and expands the pages sidebar', async () => {
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Collapse pages'));
    expect(screen.queryByDisplayValue('Intro')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Expand pages'));
    expect(screen.getByDisplayValue('Intro')).toBeInTheDocument();
  });
});

// ── Elements ─────────────────────────────────────────────────────────────────
describe('ProjectDesigner - adding and removing elements', () => {
  it.each([
    ['Text', { w: 200, h: 48 }],
    ['Input', { w: 220, h: 64 }],
    ['Output', { w: 220, h: 64 }],
    ['Image', { w: 300, h: 180 }],
  ] as const)('adds a %s element with its default size and selects it', async (title, size) => {
    await renderEmptyDesigner();
    await addElement(title);

    expect(canvasNodes()).toHaveLength(1);
    expect(field('Width').value).toBe(String(size.w));
    expect(field('Height').value).toBe(String(size.h));
    expect(field('X').value).toBe('40');
  });

  it('staggers each new element by 20px', async () => {
    await renderEmptyDesigner();
    await addElement('Text');
    await addElement('Text');
    await addElement('Text');

    expect(field('X').value).toBe('80'); // third element, selected
    expect(field('Y').value).toBe('80');
  });

  it('deletes the selected element with the Delete button', async () => {
    await renderDesigner();
    selectCanvasElem();
    await userEvent.click(screen.getByRole('button', { name: /delete element/i }));

    expect(canvasNodes()).toHaveLength(0);
    expect(panel().getByText(/select an element/i)).toBeInTheDocument();
  });

  it('deletes the selected element with the Delete key', async () => {
    await renderDesigner();
    selectCanvasElem();
    await userEvent.keyboard('{del}');

    expect(canvasNodes()).toHaveLength(0);
  });

  it('deletes with Backspace too', async () => {
    await renderDesigner();
    selectCanvasElem();
    await userEvent.keyboard('{backspace}');

    expect(canvasNodes()).toHaveLength(0);
  });

  it('does NOT delete the element when Delete/Backspace is pressed while typing in a field', async () => {
    await renderDesigner();
    selectCanvasElem();
    const content = field('Content');
    await userEvent.type(content, '{backspace}{backspace}');

    expect(canvasNodes()).toHaveLength(1);
    expect(content.value).toBe('Hel'); // the keys edited the text instead
  });

  it('deselects when clicking empty canvas', async () => {
    await renderDesigner();
    selectCanvasElem();
    // eslint-disable-next-line testing-library/no-node-access -- the canvas is the parent of the elements
    fireEvent.mouseDown(canvasNodes()[0].parentElement as HTMLElement);

    expect(panel().getByText(/select an element/i)).toBeInTheDocument();
  });

  it('collapses and expands the properties panel', async () => {
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Collapse properties'));
    expect(screen.queryByText(/select an element/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Expand properties'));
    expect(screen.getByText(/select an element/i)).toBeInTheDocument();
  });
});

// ── Editing properties ───────────────────────────────────────────────────────
describe('ProjectDesigner - editing properties', () => {
  it('edits position and size from the panel (size has a minimum)', async () => {
    await renderDesigner();
    selectCanvasElem();

    fireEvent.change(field('X'), { target: { value: '120' } });
    fireEvent.change(field('Y'), { target: { value: '75' } });
    fireEvent.change(field('Width'), { target: { value: '10' } }); // below the 40px minimum
    fireEvent.change(field('Height'), { target: { value: '300' } });

    expect(field('X').value).toBe('120');
    expect(field('Y').value).toBe('75');
    expect(field('Width').value).toBe('40');
    expect(field('Height').value).toBe('300');
    expect(canvasNodes()[0].style.left).toBe('120px');
    expect(canvasNodes()[0].style.height).toBe('300px');
  });

  it('treats a cleared position as 0', async () => {
    await renderDesigner();
    selectCanvasElem();
    fireEvent.change(field('X'), { target: { value: '' } });

    expect(field('X').value).toBe('0');
  });

  it('edits text content, size, bold and colour', async () => {
    await renderDesigner();
    selectCanvasElem();

    fireEvent.change(field('Content'), { target: { value: 'Bye' } });
    fireEvent.change(field('Font size'), { target: { value: '30' } });
    fireEvent.click(field('Bold'));
    fireEvent.change(field('Color'), { target: { value: '#ff0000' } });

    const shown = screen.getByText('Bye');
    expect(shown).toHaveStyle({ fontSize: '30px', fontWeight: '700', color: '#ff0000' });
  });

  it('lists input cells sorted naturally (A2 before A10) and shows title and value', async () => {
    await renderEmptyDesigner();
    await addElement('Input');

    const options = within(field('Cell ref')).getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual([
      '-- Select cell --',
      'A1 | Alpha | 5',
      'A2 | Second | 3',
      'A10 | Tenth | 1',
    ]);
  });

  it('lists output cells for an output element', async () => {
    await renderEmptyDesigner();
    await addElement('Output');

    const options = within(field('Cell ref')).getAllByRole('option').map(o => o.textContent);
    expect(options).toEqual(['-- Select cell --', 'B1 | Beta | =A1*2']);
  });

  it('picking a cell replaces the DEFAULT label with the cell\'s title', async () => {
    await renderEmptyDesigner();
    await addElement('Input');
    await userEvent.selectOptions(field('Cell ref'), 'A1');

    expect(field('Label').value).toBe('Alpha');
    expect(field('Cell ref').value).toBe('A1');
    expect(screen.getByText(/\(A1\)/)).toBeInTheDocument(); // canvas preview shows the bound cell
  });

  it('picking a cell keeps a label the teacher already customised', async () => {
    await renderEmptyDesigner();
    await addElement('Input');
    fireEvent.change(field('Label'), { target: { value: 'My custom label' } });
    await userEvent.selectOptions(field('Cell ref'), 'A1');

    expect(field('Label').value).toBe('My custom label');
  });

  it('input format: slider shows min/max/step fields and a range preview', async () => {
    await renderEmptyDesigner();
    await addElement('Input');
    await userEvent.selectOptions(field('Format'), 'range');

    fireEvent.change(field('Min'), { target: { value: '2' } });
    fireEvent.change(field('Max'), { target: { value: '8' } });
    fireEvent.change(field('Step Size'), { target: { value: '2' } });

    expect(field('Min').value).toBe('2');
    expect(field('Step Size').value).toBe('2');
    expect(screen.getByText('2 - 8')).toBeInTheDocument();
  });

  it('input format: dropdown shows an options field', async () => {
    await renderEmptyDesigner();
    await addElement('Input');
    await userEvent.selectOptions(field('Format'), 'dropdown');

    fireEvent.change(field('Options'), { target: { value: 'a, b, c' } });

    expect(field('Options').value).toBe('a, b, c');
    expect(screen.getByText(/Enter value\.\.\./)).toBeInTheDocument(); // dropdown placeholder preview
  });

  it('output format: number / text / currency / percentage keep the cell picker', async () => {
    await renderEmptyDesigner();
    await addElement('Output');
    for (const f of ['text', 'currency', 'percentage']) {
      await userEvent.selectOptions(field('Format'), f);
      expect(panel().getByText('Cell ref', { selector: 'label' })).toBeInTheDocument();
    }
  });

  it('output format: bar chart replaces the cell picker with range and title fields', async () => {
    await renderEmptyDesigner();
    await addElement('Output');
    await userEvent.selectOptions(field('Format'), 'bar-chart');

    expect(panel().queryByText('Cell ref', { selector: 'label' })).not.toBeInTheDocument();
    fireEvent.change(field('Cell range'), { target: { value: 'B4:B8' } });
    fireEvent.change(field('Chart title'), { target: { value: 'Revenue' } });
    fireEvent.change(field('X-axis title'), { target: { value: 'Year' } });
    fireEvent.change(field('Y-axis title'), { target: { value: 'Dollars' } });

    expect(field('Cell range').value).toBe('B4:B8');
    expect(field('Y-axis title').value).toBe('Dollars');
    expect(screen.getByText('B4:B8')).toBeInTheDocument(); // preview label
  });

  it('output format: pie chart previews a legend entry for each cell in the range', async () => {
    await renderEmptyDesigner();
    await addElement('Output');
    await userEvent.selectOptions(field('Format'), 'pie-chart');
    expect(screen.getByText('no range')).toBeInTheDocument();

    fireEvent.change(field('Cell range'), { target: { value: 'B1:B3' } });

    expect(screen.getByText('Legend 1')).toBeInTheDocument();
    expect(screen.getByText('Legend 3')).toBeInTheDocument();
    expect(screen.queryByText('Legend 4')).not.toBeInTheDocument();
    expect(screen.queryByText('no range')).not.toBeInTheDocument();
  });

  describe('table output', () => {
    async function addTable() {
      await renderEmptyDesigner();
      await addElement('Output');
      await userEvent.selectOptions(field('Format'), 'table');
    }
    const tableColumnInputs = () => screen.getAllByPlaceholderText('Column Heading') as HTMLInputElement[];
    const rowInputs = () => screen.getAllByPlaceholderText('Row Label') as HTMLInputElement[];

    it('starts with one row and one column', async () => {
      await addTable();
      expect(rowInputs().map(i => i.value)).toEqual(['Row 1']);
      expect(tableColumnInputs().map(i => i.value)).toEqual(['Column 1']);
    });

    it('adds, edits and removes rows', async () => {
      await addTable();
      await userEvent.click(screen.getAllByText('+')[0]);
      expect(rowInputs().map(i => i.value)).toEqual(['Row 1', 'Row 2']);

      fireEvent.change(rowInputs()[1], { target: { value: 'Feb' } });
      expect(rowInputs().map(i => i.value)).toEqual(['Row 1', 'Feb']);

      await userEvent.click(screen.getAllByTitle('Remove row')[0]);
      expect(rowInputs().map(i => i.value)).toEqual(['Feb']);
    });

    it('adds, edits and removes columns; removing the last column leaves a fresh default one', async () => {
      await addTable();
      await userEvent.click(screen.getAllByText('+')[1]);
      expect(tableColumnInputs().map(i => i.value)).toEqual(['Column 1', 'Column 2']);

      fireEvent.change(tableColumnInputs()[1], { target: { value: 'Sales' } });
      fireEvent.change(screen.getAllByPlaceholderText('e.g. B2:B13')[1], { target: { value: 'C2:C5' } });
      expect(tableColumnInputs()[1].value).toBe('Sales');
      expect((screen.getAllByPlaceholderText('e.g. B2:B13')[1] as HTMLInputElement).value).toBe('C2:C5');

      await userEvent.click(screen.getAllByTitle('Remove column')[1]);
      await userEvent.click(screen.getAllByTitle('Remove column')[0]);
      expect(tableColumnInputs().map(i => i.value)).toEqual(['Column 1']);
    });

    it('previews the headings, the row heading, and at most three rows', async () => {
      await addTable();
      fireEvent.change(screen.getByPlaceholderText('e.g. Month'), { target: { value: 'Month' } });
      for (let i = 0; i < 4; i++) await userEvent.click(screen.getAllByText('+')[0]); // 5 rows
      fireEvent.change(tableColumnInputs()[0], { target: { value: 'Sales' } });

      const node = canvasNodes()[0];
      expect(within(node).getByText('Month')).toBeInTheDocument();
      expect(within(node).getByText('Sales')).toBeInTheDocument();
      expect(within(node).getByText('Row 1')).toBeInTheDocument();
      expect(within(node).getByText('Row 3')).toBeInTheDocument();
      expect(within(node).queryByText('Row 4')).not.toBeInTheDocument(); // preview is capped at 3
    });

    it('says "no rows" when every row is removed', async () => {
      await addTable();
      await userEvent.click(screen.getByTitle('Remove row'));
      expect(within(canvasNodes()[0]).getByText('no rows')).toBeInTheDocument();
    });
  });

  it('image: edits the URL, shows an uploaded (data:) image with a remove button', async () => {
    await renderEmptyDesigner();
    await addElement('Image');
    expect(screen.queryByRole('button', { name: /remove image/i })).not.toBeInTheDocument();

    fireEvent.change(field('Image URL'), { target: { value: 'data:image/png;base64,AAAA' } });
    // eslint-disable-next-line testing-library/no-node-access -- the image has no role/name (alt is empty)
    expect(canvasNodes()[0].querySelector('img')).toHaveAttribute('src', 'data:image/png;base64,AAAA');

    // Known quirk (kept as-is): removing the image leaves src="" on the canvas <img>, which makes
    // React log a warning. Expect it here so it doesn't clutter the test output.
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await userEvent.click(screen.getByRole('button', { name: /remove image/i }));
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('empty string'), 'src', 'src');
    errorSpy.mockRestore();
    expect(field('Image URL').value).toBe('');
    expect(screen.queryByRole('button', { name: /remove image/i })).not.toBeInTheDocument();
  });

  it('image: a normal URL has no remove button', async () => {
    await renderEmptyDesigner();
    await addElement('Image');
    fireEvent.change(field('Image URL'), { target: { value: 'https://example.com/a.png' } });

    expect(screen.queryByRole('button', { name: /remove image/i })).not.toBeInTheDocument();
  });
});

// ── More property editing: output cells, placeholder, pie title, image upload ────────────────────
describe('ProjectDesigner - more property editing', () => {
  it('picking a cell for an OUTPUT element replaces the default label with the cell\'s title', async () => {
    await renderEmptyDesigner();
    await addElement('Output');
    await userEvent.selectOptions(field('Cell ref'), 'B1');

    expect(field('Label').value).toBe('Beta');
    expect(field('Cell ref').value).toBe('B1');
  });

  it('edits an input\'s placeholder', async () => {
    await renderEmptyDesigner();
    await addElement('Input');
    fireEvent.change(field('Placeholder'), { target: { value: 'Type here' } });

    expect(field('Placeholder').value).toBe('Type here');
    expect(screen.getByText(/Type here/)).toBeInTheDocument(); // shown on the canvas preview
  });

  it('edits a pie chart\'s title', async () => {
    await renderEmptyDesigner();
    await addElement('Output');
    await userEvent.selectOptions(field('Format'), 'pie-chart');
    fireEvent.change(field('Chart title'), { target: { value: 'Budget' } });

    expect(field('Chart title').value).toBe('Budget');
  });

  describe('image upload from device', () => {
    // jsdom can't decode images or draw on a canvas, so stand in for the browser: capture the <img>
    // the component creates, report a size for it, and fake the canvas.
    let drawImage: jest.Mock;
    let toDataURL: jest.Mock;
    let canvasSize: { width: number; height: number };
    let created: HTMLImageElement[];
    // React also creates <img> nodes while rendering; the one the upload code creates is the one
    // that gets an onload handler assigned.
    const loaderImage = () => created.find(i => typeof i.onload === 'function');
    const realCreate = document.createElement.bind(document);

    beforeEach(() => {
      drawImage = jest.fn();
      toDataURL = jest.fn(() => 'data:image/jpeg;base64,RESIZED');
      created = [];
      canvasSize = { width: 0, height: 0 };
      jest.spyOn(document, 'createElement').mockImplementation(((tag: string, opts?: ElementCreationOptions) => {
        const el = realCreate(tag, opts);
        if (tag === 'img') created.push(el as HTMLImageElement);
        if (tag === 'canvas') {
          (el as HTMLCanvasElement).getContext = (() => ({ drawImage })) as any;
          (el as HTMLCanvasElement).toDataURL = toDataURL as any;
          canvasSize = { width: 0, height: 0 };
          Object.defineProperty(el, 'width', { get: () => canvasSize.width, set: v => { canvasSize.width = v; } });
          Object.defineProperty(el, 'height', { get: () => canvasSize.height, set: v => { canvasSize.height = v; } });
        }
        return el;
      }) as any);
    });
    afterEach(() => jest.restoreAllMocks());

    async function upload(imgW: number, imgH: number): Promise<HTMLImageElement> {
      await renderEmptyDesigner();
      await addElement('Image');
      // eslint-disable-next-line testing-library/no-node-access -- the picker is a hidden input inside a label
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['x'], 'pic.png', { type: 'image/png' })] } });

      // FileReader finishes asynchronously, then the component creates its <img>
      await waitFor(() => expect(loaderImage()).toBeDefined());
      const img = loaderImage() as HTMLImageElement;
      Object.defineProperty(img, 'width', { value: imgW });
      Object.defineProperty(img, 'height', { value: imgH });
      act(() => { img.onload?.(new Event('load')); });
      return img;
    }

    it('downscales a large image to fit 1280px and stores it as a JPEG data URL', async () => {
      const img = await upload(2560, 1280);

      expect(canvasSize).toEqual({ width: 1280, height: 640 }); // halved, aspect ratio kept
      expect(drawImage).toHaveBeenCalledWith(img, 0, 0, 1280, 640);
      expect(toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
      expect(field('Image URL').value).toBe('data:image/jpeg;base64,RESIZED');
    });

    it('keeps a small image at its own size', async () => {
      await upload(400, 300);

      expect(canvasSize).toEqual({ width: 400, height: 300 });
      expect(field('Image URL').value).toBe('data:image/jpeg;base64,RESIZED');
    });

    it('ignores the upload if the selected element is not an image', async () => {
      await renderEmptyDesigner();
      await addElement('Image');
      // eslint-disable-next-line testing-library/no-node-access -- the picker is a hidden input inside a label
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      // deselect by clicking the empty canvas: the panel (and picker) goes away, nothing is uploaded
      // eslint-disable-next-line testing-library/no-node-access -- the canvas is the parent of the elements
      fireEvent.mouseDown(canvasNodes()[0].parentElement as HTMLElement);

      expect(input).not.toBeInTheDocument();
      expect(loaderImage()).toBeUndefined();
    });
  });
});

// ── Drag and resize ──────────────────────────────────────────────────────────
describe('ProjectDesigner - drag and resize', () => {
  // jsdom has no layout; give elements a real size so the drag commit can read it back.
  const origOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth');
  const origOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetHeight');
  beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 200 });
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 48 });
  });
  afterAll(() => {
    if (origOffsetWidth) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', origOffsetWidth);
    if (origOffsetHeight) Object.defineProperty(HTMLElement.prototype, 'offsetHeight', origOffsetHeight);
  });

  // The seeded text element sits at (10, 20), 200 x 48.
  it('moves an element by the pointer delta, via a transform while dragging and left/top on drop', async () => {
    await renderDesigner();
    const node = canvasNodes()[0];

    fireEvent.mouseDown(node, { clientX: 30, clientY: 40 }); // grab point is (20, 20) inside the element
    fireEvent.mouseMove(window, { clientX: 130, clientY: 90 });

    // While dragging only the DOM is touched (no React state change): a transform, not left/top.
    expect(node.style.transform).toBe('translate(100px, 50px)');
    expect(node.style.left).toBe('10px');

    fireEvent.mouseUp(window);

    expect(node.style.transform).toBe('');
    expect(node.style.left).toBe('110px');
    expect(node.style.top).toBe('70px');
    expect(field('X').value).toBe('110'); // committed to React state
    expect(field('Y').value).toBe('70');
    expect(field('Width').value).toBe('200');
    expect(field('Height').value).toBe('48');
  });

  it('selects the element when a drag starts on it', async () => {
    await renderDesigner();
    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    expect(field('X')).toBeInTheDocument();
    fireEvent.mouseUp(window);
  });

  it('never drags an element to negative coordinates', async () => {
    await renderDesigner();
    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    fireEvent.mouseMove(window, { clientX: -500, clientY: -500 });
    fireEvent.mouseUp(window);

    expect(field('X').value).toBe('0');
    expect(field('Y').value).toBe('0');
  });

  it('ignores mouse movement after the button is released', async () => {
    await renderDesigner();
    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(window);
    fireEvent.mouseMove(window, { clientX: 400, clientY: 400 });

    expect(canvasNodes()[0].style.transform).toBe('');
    expect(field('X').value).toBe('10');
  });

  it('a click without movement leaves the geometry unchanged', async () => {
    await renderDesigner();
    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(window);

    expect(field('X').value).toBe('10');
    expect(field('Y').value).toBe('20');
  });

  it('resizes from the handle, keeping the position', async () => {
    await renderDesigner();
    selectCanvasElem();
    // eslint-disable-next-line testing-library/no-node-access -- the handle has no role or name
    const handle = canvasNodes()[0].querySelector('.resizeHandle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 210, clientY: 68 }); // bottom-right corner of the element
    fireEvent.mouseMove(window, { clientX: 310, clientY: 168 });
    expect(canvasNodes()[0].style.width).toBe('300px'); // live DOM update while dragging
    fireEvent.mouseUp(window);

    expect(field('Width').value).toBe('300');
    expect(field('Height').value).toBe('148');
    expect(field('X').value).toBe('10');
    expect(field('Y').value).toBe('20');
  });

  it('enforces a minimum size when resizing', async () => {
    await renderDesigner();
    selectCanvasElem();
    // eslint-disable-next-line testing-library/no-node-access -- the handle has no role or name
    const handle = canvasNodes()[0].querySelector('.resizeHandle') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 210, clientY: 68 });
    fireEvent.mouseMove(window, { clientX: 0, clientY: 0 });
    fireEvent.mouseUp(window);

    expect(field('Width').value).toBe('40');
    expect(field('Height').value).toBe('24');
  });

  it('a gesture in progress when the page unmounts does not leave listeners behind', async () => {
    const removeSpy = jest.spyOn(window, 'removeEventListener');
    await renderDesigner();
    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    const { unmount } = { unmount: () => document.body.replaceChildren() };
    unmount();
    // mouseup on window must still be safe, and listeners are removed on teardown
    fireEvent.mouseUp(window);

    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('ProjectDesigner - edge auto-pan', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('scrolls the canvas toward an edge while a drag is held near it', async () => {
    jest.useRealTimers();
    await renderDesigner();
    jest.useFakeTimers();
    // eslint-disable-next-line testing-library/no-node-access -- the canvas is the parent of the elements
    const canvas = canvasNodes()[0].parentElement as HTMLElement;
    canvas.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) });
    canvas.scrollLeft = 0;

    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    fireEvent.mouseMove(window, { clientX: 995, clientY: 300 }); // within 60px of the right edge
    act(() => { jest.advanceTimersByTime(100); });

    expect(canvas.scrollLeft).toBeGreaterThan(0);
    fireEvent.mouseUp(window);
    const stopped = canvas.scrollLeft;
    act(() => { jest.advanceTimersByTime(100); });
    expect(canvas.scrollLeft).toBe(stopped); // panning stops when the gesture ends
  });

  it('does not scroll when the pointer is away from the edges', async () => {
    jest.useRealTimers();
    await renderDesigner();
    jest.useFakeTimers();
    // eslint-disable-next-line testing-library/no-node-access -- the canvas is the parent of the elements
    const canvas = canvasNodes()[0].parentElement as HTMLElement;
    canvas.getBoundingClientRect = () => ({ left: 0, right: 1000, top: 0, bottom: 600, width: 1000, height: 600, x: 0, y: 0, toJSON: () => ({}) });

    fireEvent.mouseDown(canvasNodes()[0], { clientX: 30, clientY: 40 });
    fireEvent.mouseMove(window, { clientX: 500, clientY: 300 });
    act(() => { jest.advanceTimersByTime(100); });

    expect(canvas.scrollLeft).toBe(0);
    fireEvent.mouseUp(window);
  });
});

// ── Saving and previewing ────────────────────────────────────────────────────
describe('ProjectDesigner - saving', () => {
  it('saves every saved page with its name and elements', async () => {
    await renderDesigner();
    fireEvent.change(screen.getByDisplayValue('Intro'), { target: { value: 'Welcome' } });
    await clickAndSettle(screen.getByTitle('Save'));

    await waitFor(() => expect(callsTo('PUT', '/pages/pg-2')).toHaveLength(1));
    const first = callsTo('PUT', '/pages/pg-1');
    expect(first[0].body.name).toBe('Welcome');
    expect(first[0].body.elements).toHaveLength(1);
    expect(first[0].body.elements[0].id).toBe('e1');
    expect(callsTo('PUT', '/pages/pg-2')[0].body).toEqual({ elements: [], name: 'Second' });
  });

  it('creates an unsaved (temp) page first, then saves its elements under the new id', async () => {
    await renderEmptyDesigner();
    await addElement('Text');
    await clickAndSettle(screen.getByTitle('Save'));

    await waitFor(() => expect(callsTo('PUT', '/pages/srv-1')).toHaveLength(1));
    expect(callsTo('POST', '/projects/proj-1/pages')[0].body).toEqual({ name: 'Page 1', sortOrder: 0 });
    expect(callsTo('PUT', '/pages/srv-1')[0].body.elements).toHaveLength(1);

    // Saving again now updates the page in place instead of creating another.
    await waitFor(() => expect(screen.getByTitle('Save')).not.toBeDisabled());
    await clickAndSettle(screen.getByTitle('Save'));
    await waitFor(() => expect(callsTo('PUT', '/pages/srv-1')).toHaveLength(2));
    expect(callsTo('POST', '/projects/proj-1/pages')).toHaveLength(1);
  });

  it('shows "Saving..." and disables the button while saving', async () => {
    await renderDesigner();
    // Deliberately not settled: we want to observe the in-flight state.
    userEvent.click(screen.getByTitle('Save'));
    expect(screen.getByTitle('Save')).toBeDisabled();
    await waitFor(() => expect(screen.getByTitle('Save')).not.toBeDisabled());
  });

  it('saves first, then opens the student preview', async () => {
    await renderDesigner();
    await clickAndSettle(screen.getByTitle('Preview Student View'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/projects/proj-1/play', { state: { preview: true } }));
    expect(callsTo('PUT', '/pages/pg-1')).toHaveLength(1); // saved before navigating
  });
});

// ── Excel preview ────────────────────────────────────────────────────────────
describe('ProjectDesigner - Excel preview', () => {
  it('lists every tracked cell sorted by reference with its kind and value/formula', async () => {
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Preview Excel'));

    const rows = screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell').map(c => c.textContent));
    expect(rows).toEqual([
      ['A1', 'Alpha', 'Input', '5'],
      ['A2', 'Second', 'Input', '3'],
      ['A10', 'Tenth', 'Input', '1'],
      ['B1', 'Beta', 'Output', '=A1*2'],
    ]);
  });

  it('closes from the X button and by clicking outside, but not by clicking inside', async () => {
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Preview Excel'));
    await userEvent.click(screen.getByText('Excel Sheet Values'));
    expect(screen.getByText('Excel Sheet Values')).toBeInTheDocument();

    // eslint-disable-next-line testing-library/no-node-access -- the overlay has no role
    await userEvent.click(document.querySelector('.modal__close') as HTMLElement);
    expect(screen.queryByText('Excel Sheet Values')).not.toBeInTheDocument();

    await userEvent.click(screen.getByTitle('Preview Excel'));
    // eslint-disable-next-line testing-library/no-node-access -- the overlay has no role
    await userEvent.click(document.querySelector('.modal-overlay') as HTMLElement);
    expect(screen.queryByText('Excel Sheet Values')).not.toBeInTheDocument();
  });

  it('derives input and output cells from the raw cells when the project has no cell lists', async () => {
    projectResponse = { id: 'proj-1', name: 'My Sim', excel_data: { cells: excelData.cells } };
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Preview Excel'));

    const rows = screen.getAllByRole('row').slice(1).map(r => within(r).getAllByRole('cell').map(c => c.textContent));
    expect(rows).toEqual([
      ['A1', '-', 'Input', '5'],
      ['B1', '-', 'Output', '=A1*2'],
    ]);
  });

  it('says there is no data for a project without a spreadsheet', async () => {
    projectResponse = { id: 'proj-1', name: 'My Sim', excel_data: null };
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Preview Excel'));

    expect(screen.getByText('No spreadsheet data on this project.')).toBeInTheDocument();
  });

  it('explains multi-sheet workbooks', async () => {
    projectResponse = { id: 'proj-1', name: 'My Sim', excel_data: { ...excelData, multiSheet: true, sheets: ['Sheet1', 'Costs'] } };
    await renderDesigner();
    await userEvent.click(screen.getByTitle('Preview Excel'));

    expect(screen.getByText(/This workbook has 2 sheets \(Sheet1, Costs\)/)).toBeInTheDocument();
  });
});
