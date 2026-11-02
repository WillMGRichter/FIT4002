import React from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardPage } from '../DashboardPage';

// ── Mocks ────────────────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockSetSearchParams = jest.fn();
let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch), mockSetSearchParams],
}));

// Auth is swapped per test (teacher / student / signed-out).
let mockAuth: { user: { role: string } | null; token: string | null };
jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

// AppShell pulls in the sidebar, search box etc. Keep only what the page uses; the star button
// mirrors the real one's accessible name (title "Star" / "Unstar").
jest.mock('../../components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ProjectBadge: () => <span />,
  StarButton: ({ active, onClick }: { active?: boolean; onClick?: (e: React.MouseEvent) => void }) => (
    <button title={active ? 'Unstar' : 'Star'} onClick={onClick} />
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────
const projects = [
  { id: 'p1', name: 'Override Demo', description: 'Formula inputs', created_at: '2026-01-01', visibility: 'private' },
  { id: 'p2', name: 'Client Table Output', description: 'Shows a TABLE of results', created_at: '2026-01-02', visibility: 'private' },
];

// participants per project; a role other than "student" must not be counted
const participants: Record<string, Array<{ role: string }>> = {
  p1: [{ role: 'student' }, { role: 'student' }, { role: 'teacher' }],
  p2: [{ role: 'student' }],
};

let fetchCalls: Array<{ method: string; url: string; headers?: Record<string, string> }>;
let apiFailures: { list?: boolean; participantsFor?: string[]; delete?: boolean };

function installFetch() {
  fetchCalls = [];
  (global as any).fetch = jest.fn((url: string, init?: any) => {
    const method = init?.method || 'GET';
    fetchCalls.push({ method, url, headers: init?.headers });
    const res = (ok: boolean, data: unknown = {}) =>
      Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(data) });

    if (method === 'DELETE') return res(!apiFailures.delete);
    if (url.endsWith('/teacher/projects') || url.endsWith('/student/projects')) {
      return apiFailures.list ? res(false) : res(true, projects);
    }
    const m = url.match(/\/projects\/([^/]+)\/participants$/);
    if (m) return apiFailures.participantsFor?.includes(m[1]) ? res(false) : res(true, participants[m[1]] ?? []);
    return res(true);
  });
}

const callsTo = (method: string, suffix: string) =>
  fetchCalls.filter(c => c.method === method && c.url.endsWith(suffix));

// jsdom's window.location can't be assigned a new host, so swap the whole object for the join-link tests.
const realLocation = window.location;
function setLocation(loc: { protocol: string; hostname: string; port: string }) {
  delete (window as any).location;
  (window as any).location = { ...realLocation, ...loc };
}

let writeText: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  mockSearch = '';
  mockAuth = { user: { role: 'teacher' }, token: 'tok' };
  apiFailures = {};
  installFetch();
  writeText = jest.fn(() => Promise.resolve());
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => {
  (window as any).location = realLocation;
});

async function renderLoaded() {
  render(<DashboardPage />);
  await screen.findByText('Override Demo');
  // wait for the per-project student counts to land too
  await screen.findByText('2 students');
}

// The card's "..." menu button is the only button with no accessible name or title in a card.
function menuButtonFor(projectName: string): HTMLElement {
  const heading = screen.getByRole('heading', { name: projectName });
  // eslint-disable-next-line testing-library/no-node-access -- the card has no accessible name; climb from its heading
  const card = heading.closest('.simulation-card') as HTMLElement;
  const unnamed = within(card).getAllByRole('button').filter(b => !b.getAttribute('title') && !b.textContent);
  return unnamed[0];
}

// ── Loading and data ─────────────────────────────────────────────────────────
describe('DashboardPage - loading projects', () => {
  it('redirects to /login and fetches nothing when signed out', () => {
    mockAuth = { user: null, token: null };
    render(<DashboardPage />);

    expect(mockNavigate).toHaveBeenCalledWith('/login');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('shows a loading state, then the teacher\'s projects fetched with their token', async () => {
    render(<DashboardPage />);
    expect(screen.getByText('Loading simulations...')).toBeInTheDocument();

    expect(await screen.findByText('Override Demo')).toBeInTheDocument();
    expect(screen.getByText('Client Table Output')).toBeInTheDocument();
    expect(screen.getByText('Formula inputs')).toBeInTheDocument();

    const list = callsTo('GET', '/projects/teacher/projects');
    expect(list).toHaveLength(1);
    expect(list[0].headers?.Authorization).toBe('Bearer tok');
  });

  it('counts only students per project, with correct singular / plural', async () => {
    await renderLoaded();

    expect(screen.getByText('2 students')).toBeInTheDocument(); // p1: two students + one teacher
    expect(screen.getByText('1 student')).toBeInTheDocument(); // p2
  });

  it('still shows a project, with 0 students, when its participants request fails', async () => {
    apiFailures = { participantsFor: ['p1'] };
    render(<DashboardPage />);

    expect(await screen.findByText('Override Demo')).toBeInTheDocument();
    await screen.findByText('1 student');
    expect(screen.getByText('0 students')).toBeInTheDocument();
  });

  it('shows an error instead of the list when projects cannot be loaded', async () => {
    apiFailures = { list: true };
    render(<DashboardPage />);

    expect(await screen.findByText('Failed to fetch projects')).toBeInTheDocument();
    expect(screen.queryByText('Override Demo')).not.toBeInTheDocument();
  });

  it('uses the student endpoint for students and hides teacher-only controls', async () => {
    mockAuth = { user: { role: 'student' }, token: 'stu-tok' };
    render(<DashboardPage />);
    await screen.findByText('Override Demo');

    expect(callsTo('GET', '/projects/student/projects')).toHaveLength(1);
    expect(callsTo('GET', '/projects/teacher/projects')).toHaveLength(0);
    // no "..." menu (edit / share / delete) for students
    expect(screen.getAllByRole('button').filter(b => !b.getAttribute('title') && !b.textContent)).toHaveLength(0);
  });
});

// ── Navigation ───────────────────────────────────────────────────────────────
describe('DashboardPage - navigation', () => {
  it('opens a project in the designer for teachers and records it as recent', async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole('heading', { name: 'Override Demo' }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1/design');
    expect(JSON.parse(localStorage.getItem('recentProjects') || '[]')[0]).toEqual({ id: 'p1', name: 'Override Demo' });
  });

  it('opens a project in the player for students', async () => {
    mockAuth = { user: { role: 'student' }, token: 'stu-tok' };
    render(<DashboardPage />);
    await userEvent.click(await screen.findByRole('heading', { name: 'Override Demo' }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/p1/play');
  });

  it('opens a project from the keyboard (Enter)', async () => {
    await renderLoaded();
    const card = screen.getAllByRole('button').find(b => b.textContent?.includes('Client Table Output')) as HTMLElement;
    card.focus();
    await userEvent.keyboard('{enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/projects/p2/design');
  });

  it('goes to the create page from the "Create New Simulation" card', async () => {
    await renderLoaded();
    await userEvent.click(screen.getByRole('button', { name: /create new simulation/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/create');
  });
});

// ── Search ───────────────────────────────────────────────────────────────────
describe('DashboardPage - search', () => {
  it('filters by name or description, case-insensitively, and hides the create card', async () => {
    mockSearch = 'q=table';
    render(<DashboardPage />);

    expect(await screen.findByText('Client Table Output')).toBeInTheDocument();
    expect(screen.queryByText('Override Demo')).not.toBeInTheDocument();
    expect(screen.getByText(/Results for "table" \(1 project\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create new simulation/i })).not.toBeInTheDocument();
  });

  it('matches on description text too', async () => {
    mockSearch = 'q=FORMULA';
    render(<DashboardPage />);

    expect(await screen.findByText('Override Demo')).toBeInTheDocument();
    expect(screen.queryByText('Client Table Output')).not.toBeInTheDocument();
  });

  it('pluralises the result count and says so when nothing matches', async () => {
    mockSearch = 'q=zzz';
    render(<DashboardPage />);

    expect(await screen.findByText(/Results for "zzz" \(0 projects\)/)).toBeInTheDocument();
    expect(screen.getByText('No projects match "zzz"')).toBeInTheDocument();
  });

  it('clears the search through the URL params', async () => {
    mockSearch = 'q=table';
    render(<DashboardPage />);
    await screen.findByText('Client Table Output');

    await userEvent.click(screen.getByRole('button', { name: 'Clear' }));

    expect(mockSetSearchParams).toHaveBeenCalledWith({}, { replace: true });
  });
});

// ── Starring ─────────────────────────────────────────────────────────────────
describe('DashboardPage - starring', () => {
  it('stars and unstars a project, persists it, and does not open the project', async () => {
    await renderLoaded();
    const stars = screen.getAllByTitle('Star');

    await userEvent.click(stars[0]);
    expect(screen.getAllByTitle('Unstar')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('starredProjects') || '[]')).toEqual([{ id: 'p1', name: 'Override Demo' }]);
    expect(mockNavigate).not.toHaveBeenCalled(); // click must not bubble to the card

    await userEvent.click(screen.getByTitle('Unstar'));
    expect(screen.queryByTitle('Unstar')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('starredProjects') || '[]')).toEqual([]);
  });

  it('shows previously starred projects as starred on load', async () => {
    localStorage.setItem('starredProjects', JSON.stringify([{ id: 'p2', name: 'Client Table Output' }]));
    await renderLoaded();

    expect(screen.getAllByTitle('Unstar')).toHaveLength(1);
  });
});

// ── Card menu ────────────────────────────────────────────────────────────────
describe('DashboardPage - card menu', () => {
  it('opens the edit page from the menu', async () => {
    await renderLoaded();
    await userEvent.click(menuButtonFor('Override Demo'));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));

    expect(mockNavigate).toHaveBeenCalledWith('/projects/create?edit=p1');
    expect(mockNavigate).not.toHaveBeenCalledWith('/projects/p1/design'); // menu click must not open the project
  });

  it('closes the menu when clicking elsewhere', async () => {
    await renderLoaded();
    await userEvent.click(menuButtonFor('Override Demo'));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

    await userEvent.click(document.body);

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });
});

// ── Delete ───────────────────────────────────────────────────────────────────
describe('DashboardPage - delete project', () => {
  async function openDeleteDialog(name = 'Override Demo') {
    await userEvent.click(menuButtonFor(name));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await screen.findByText(/are you sure you want to delete this simulation/i);
  }

  // Click the dialog's own Delete button (the menu item is gone once the dialog opens). The click
  // kicks off async work (DELETE, then a list reload), so wrap it in act to let that settle cleanly.
  async function confirmDelete() {
    // eslint-disable-next-line testing-library/no-node-access -- scope to the modal; the page has other "Delete" text
    const modal = screen.getByText('Delete Simulation').closest('.modal') as HTMLElement;
    // eslint-disable-next-line testing-library/no-unnecessary-act -- the click itself starts fetches whose results land outside any later waitFor
    await act(async () => {
      userEvent.click(within(modal).getByRole('button', { name: 'Delete' }));
    });
  }

  it('asks for confirmation and deletes nothing if cancelled', async () => {
    await renderLoaded();
    await openDeleteDialog();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument();
    expect(fetchCalls.filter(c => c.method === 'DELETE')).toHaveLength(0);
  });

  it('deletes the chosen project with the token, drops it from storage and reloads the list', async () => {
    localStorage.setItem('starredProjects', JSON.stringify([{ id: 'p1', name: 'Override Demo' }]));
    await renderLoaded();
    await openDeleteDialog();
    const listCallsBefore = callsTo('GET', '/projects/teacher/projects').length;

    await confirmDelete();

    await waitFor(() => expect(callsTo('DELETE', '/projects/p1')).toHaveLength(1));
    expect(callsTo('DELETE', '/projects/p1')[0].headers?.Authorization).toBe('Bearer tok');
    await waitFor(() => expect(screen.queryByText(/are you sure/i)).not.toBeInTheDocument());
    await waitFor(() => expect(callsTo('GET', '/projects/teacher/projects').length).toBe(listCallsBefore + 1));
    // let the reload finish (list + student counts) so no state updates land after the test ends
    await screen.findByText('2 students');
    expect(JSON.parse(localStorage.getItem('starredProjects') || '[]')).toEqual([]);
  });

  it('alerts and keeps the dialog open when the delete fails', async () => {
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
    apiFailures = { delete: true };
    await renderLoaded();
    await openDeleteDialog();

    await confirmDelete();

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Failed to delete'));
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    alertSpy.mockRestore();
  });
});

// ── Join link ────────────────────────────────────────────────────────────────
describe('DashboardPage - join link', () => {
  async function openShare(name = 'Override Demo') {
    await userEvent.click(menuButtonFor(name));
    await userEvent.click(screen.getByRole('button', { name: 'Copy join link' }));
    await screen.findByText('Student join link');
  }
  const linkInput = () => screen.getByDisplayValue(/\/join\/p\d$/) as HTMLInputElement;
  const baseInput = () => screen.getByPlaceholderText('http://192.168.x.x:3000') as HTMLInputElement;

  it('builds the link from the live origin including whatever port the dev server is on', async () => {
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare();

    expect(baseInput().value).toBe('http://localhost:3002');
    expect(linkInput().value).toBe('http://localhost:3002/join/p1');
  });

  it('warns that localhost only works on this computer', async () => {
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare();

    expect(screen.getByText(/only works on this computer/i)).toBeInTheDocument();
  });

  it('on localhost, swaps in the saved LAN host but keeps the LIVE port (a stale port never resurfaces)', async () => {
    localStorage.setItem('smartsim_join_host', '192.168.0.252');
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare();

    expect(linkInput().value).toBe('http://192.168.0.252:3002/join/p1');
    expect(screen.queryByText(/only works on this computer/i)).not.toBeInTheDocument();
  });

  it('on a real hostname, ignores any saved host and uses the live origin', async () => {
    localStorage.setItem('smartsim_join_host', '192.168.0.252');
    setLocation({ protocol: 'https:', hostname: 'smartsim.example.com', port: '' });
    await renderLoaded();
    await openShare();

    expect(linkInput().value).toBe('https://smartsim.example.com/join/p1'); // no ":" suffix when there is no port
  });

  it('updates the link as the address is edited and trims trailing slashes', async () => {
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare('Client Table Output');

    await userEvent.clear(baseInput());
    await userEvent.type(baseInput(), '  http://192.168.1.5:3000///  ');

    expect(linkInput().value).toBe('http://192.168.1.5:3000/join/p2');
  });

  it('copies the link, shows "Copied!", and remembers only the HOST (no scheme or port)', async () => {
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare();
    await userEvent.clear(baseInput());
    await userEvent.type(baseInput(), 'https://192.168.1.5:3000');

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(writeText).toHaveBeenCalledWith('https://192.168.1.5:3000/join/p1');
    expect(localStorage.getItem('smartsim_join_host')).toBe('192.168.1.5');
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument();
  });

  it('closes the dialog with Close', async () => {
    setLocation({ protocol: 'http:', hostname: 'localhost', port: '3002' });
    await renderLoaded();
    await openShare();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.queryByText('Student join link')).not.toBeInTheDocument();
  });
});
