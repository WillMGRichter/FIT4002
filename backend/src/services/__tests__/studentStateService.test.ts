import { createSupabaseMock } from './supabaseMock';

const mock = createSupabaseMock();
jest.mock('../../config/supabase', () => ({
  get supabase() {
    return mock.client;
  },
}));

import {
  getOrCreateState,
  updateInputValues,
  updateCurrentPage,
  completeAttempt,
  getStudentResults,
} from '../studentStateService';

const PROJECT = 'proj-1';
const USER = 'user-1';
const STATE = 'state-1';

beforeEach(() => mock.reset());

describe('getOrCreateState', () => {
  it('returns the existing incomplete state without touching anything else', async () => {
    const existing = { id: STATE, attempt_number: 1, is_completed: false };
    mock.queue('student_simulation_state', { data: existing });

    await expect(getOrCreateState(PROJECT, USER)).resolves.toBe(existing);
    expect(mock.calls).toHaveLength(1); // no participant / insert queries
  });

  it('throws when the user is not a participant of the project', async () => {
    mock.queue('student_simulation_state', { data: null });
    mock.queue('project_participants', { data: null });

    await expect(getOrCreateState(PROJECT, USER)).rejects.toThrow('Not a participant of this project');
  });

  it('throws "No attempts remaining" once every allowed attempt has a state row', async () => {
    mock.queue('student_simulation_state', { data: null }, { data: [{ attempt_number: 2 }] });
    mock.queue('project_participants', { data: { attempts_used: 2, max_attempts: 2 } });

    await expect(getOrCreateState(PROJECT, USER)).rejects.toThrow('No attempts remaining');
  });

  it('derives the next attempt number from existing rows, not from attempts_used', async () => {
    const created = { id: 'new', attempt_number: 2 };
    // attempts_used is deliberately stale (0) while a state row for attempt 1 exists.
    mock.queue('student_simulation_state', { data: null }, { data: [{ attempt_number: 1 }] }, { error: null }, { data: created });
    mock.queue('project_participants', { data: { attempts_used: 0, max_attempts: 3 } });
    mock.queue('project_pages', { data: { id: 'page-1' } });

    await expect(getOrCreateState(PROJECT, USER)).resolves.toBe(created);

    const upsert = mock.calls.find((c) => c.ops.some((o) => o.method === 'upsert'))!;
    const [rows, options] = mock.opsOf(upsert, 'upsert')[0];
    expect(rows).toEqual([
      {
        project_id: PROJECT,
        user_id: USER,
        attempt_number: 2,
        current_page_id: 'page-1',
        input_values: {},
      },
    ]);
    expect(options).toEqual({ onConflict: 'project_id,user_id,attempt_number', ignoreDuplicates: true });
  });

  it('starts at attempt 1 with a null page when there are no rows and no pages', async () => {
    mock.queue('student_simulation_state', { data: null }, { data: [] }, { error: null }, { data: { id: 'new' } });
    mock.queue('project_participants', { data: { max_attempts: 1 } });
    mock.queue('project_pages', { data: null });

    await getOrCreateState(PROJECT, USER);

    const upsert = mock.calls.find((c) => c.ops.some((o) => o.method === 'upsert'))!;
    const [rows] = mock.opsOf(upsert, 'upsert')[0] as [Array<Record<string, unknown>>];
    expect(rows[0]).toMatchObject({ attempt_number: 1, current_page_id: null });
  });

  it('is race-safe: an ignored duplicate upsert resolves to the row the winner created', async () => {
    // Loser of a concurrent insert: upsert is a silent no-op (no error), and the
    // read-back returns the row the winning request already created.
    const winnerRow = { id: 'winner', attempt_number: 1 };
    mock.queue('student_simulation_state', { data: null }, { data: [] }, { error: null }, { data: winnerRow });
    mock.queue('project_participants', { data: { max_attempts: 1 } });
    mock.queue('project_pages', { data: { id: 'page-1' } });

    await expect(getOrCreateState(PROJECT, USER)).resolves.toBe(winnerRow);

    const readBack = mock.calls[mock.calls.length - 1];
    expect(mock.opsOf(readBack, 'eq')).toContainEqual(['attempt_number', 1]);
  });

  it('propagates an upsert error', async () => {
    mock.queue('student_simulation_state', { data: null }, { data: [] }, { error: { message: 'boom' } });
    mock.queue('project_participants', { data: { max_attempts: 1 } });
    mock.queue('project_pages', { data: null });

    await expect(getOrCreateState(PROJECT, USER)).rejects.toMatchObject({ message: 'boom' });
  });

  it('propagates a read-back error', async () => {
    mock.queue('student_simulation_state', { data: null }, { data: [] }, { error: null }, { error: { message: 'read failed' } });
    mock.queue('project_participants', { data: { max_attempts: 1 } });
    mock.queue('project_pages', { data: null });

    await expect(getOrCreateState(PROJECT, USER)).rejects.toMatchObject({ message: 'read failed' });
  });
});

describe('updateInputValues / updateCurrentPage', () => {
  it('updateInputValues writes the inputs for the given state id and returns the row', async () => {
    const row = { id: STATE, input_values: { a: 1 } };
    mock.queue('student_simulation_state', { data: row });

    await expect(updateInputValues(STATE, { a: 1 })).resolves.toBe(row);

    const [payload] = mock.opsOf(mock.calls[0], 'update')[0] as [Record<string, unknown>];
    expect(payload.input_values).toEqual({ a: 1 });
    expect(typeof payload.updated_at).toBe('string');
    expect(mock.opsOf(mock.calls[0], 'eq')).toContainEqual(['id', STATE]);
  });

  it('updateInputValues throws on a database error', async () => {
    mock.queue('student_simulation_state', { error: { message: 'nope' } });
    await expect(updateInputValues(STATE, {})).rejects.toMatchObject({ message: 'nope' });
  });

  it('updateCurrentPage writes the page id and returns the row', async () => {
    const row = { id: STATE, current_page_id: 'p2' };
    mock.queue('student_simulation_state', { data: row });

    await expect(updateCurrentPage(STATE, 'p2')).resolves.toBe(row);

    const [payload] = mock.opsOf(mock.calls[0], 'update')[0] as [Record<string, unknown>];
    expect(payload.current_page_id).toBe('p2');
  });

  it('updateCurrentPage throws on a database error', async () => {
    mock.queue('student_simulation_state', { error: { message: 'nope' } });
    await expect(updateCurrentPage(STATE, 'p2')).rejects.toMatchObject({ message: 'nope' });
  });
});

describe('completeAttempt', () => {
  const FINAL = { x: 42 };

  it('throws when the state does not exist', async () => {
    mock.queue('student_simulation_state', { data: null });
    await expect(completeAttempt(STATE, PROJECT, USER, FINAL)).rejects.toThrow('Simulation state not found');
  });

  it('is idempotent: completing an already-completed state does nothing', async () => {
    mock.queue('student_simulation_state', { data: { is_completed: true, attempt_number: 1 } });

    await expect(completeAttempt(STATE, PROJECT, USER, FINAL)).resolves.toBeUndefined();

    expect(mock.calls).toHaveLength(1); // only the guard read
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('marks complete, increments attempts via RPC, and stores the result', async () => {
    mock.queue('student_simulation_state', { data: { is_completed: false, attempt_number: 2 } }, { error: null });
    mock.queue('project_results', { error: null });
    mock.rpc.mockResolvedValue({ error: null });

    await expect(completeAttempt(STATE, PROJECT, USER, FINAL)).resolves.toBeUndefined();

    const stateUpdate = mock.calls[1];
    const [payload] = mock.opsOf(stateUpdate, 'update')[0] as [Record<string, unknown>];
    expect(payload).toMatchObject({ is_completed: true, input_values: FINAL });

    expect(mock.rpc).toHaveBeenCalledWith('increment_attempts_used', { p_project_id: PROJECT, p_user_id: USER });

    const results = mock.calls.find((c) => c.table === 'project_results')!;
    expect(mock.opsOf(results, 'insert')[0]).toEqual([
      [{ project_id: PROJECT, user_id: USER, final_state: { input_values: FINAL, attempt_number: 2 } }],
    ]);
    // RPC succeeded, so the manual fallback must not run.
    expect(mock.calls.some((c) => c.table === 'project_participants')).toBe(false);
  });

  it('falls back to a manual increment when the RPC is unavailable', async () => {
    mock.queue('student_simulation_state', { data: { is_completed: false, attempt_number: 1 } }, { error: null });
    mock.queue('project_participants', { data: { attempts_used: 1 } }, { error: null });
    mock.queue('project_results', { error: null });
    mock.rpc.mockResolvedValue({ error: { message: 'function does not exist' } });

    await completeAttempt(STATE, PROJECT, USER, FINAL);

    const participantUpdate = mock.calls.filter((c) => c.table === 'project_participants')[1];
    expect(mock.opsOf(participantUpdate, 'update')[0]).toEqual([{ attempts_used: 2 }]);
  });

  it('stops before incrementing or storing a result if marking complete fails', async () => {
    mock.queue('student_simulation_state', { data: { is_completed: false, attempt_number: 1 } }, { error: { message: 'write failed' } });

    await expect(completeAttempt(STATE, PROJECT, USER, FINAL)).rejects.toMatchObject({ message: 'write failed' });

    expect(mock.rpc).not.toHaveBeenCalled();
    expect(mock.calls.some((c) => c.table === 'project_results')).toBe(false);
  });

  it('throws when storing the result fails', async () => {
    mock.queue('student_simulation_state', { data: { is_completed: false, attempt_number: 1 } }, { error: null });
    mock.queue('project_results', { error: { message: 'insert failed' } });
    mock.rpc.mockResolvedValue({ error: null });

    await expect(completeAttempt(STATE, PROJECT, USER, FINAL)).rejects.toMatchObject({ message: 'insert failed' });
  });
});

describe('getStudentResults', () => {
  it('returns results newest-first for the project', async () => {
    const rows = [{ id: 'r1' }, { id: 'r2' }];
    mock.queue('project_results', { data: rows });

    await expect(getStudentResults(PROJECT)).resolves.toBe(rows);

    expect(mock.opsOf(mock.calls[0], 'eq')).toContainEqual(['project_id', PROJECT]);
    expect(mock.opsOf(mock.calls[0], 'order')[0]).toEqual(['completed_at', { ascending: false }]);
  });

  it('returns an empty array when there are no results', async () => {
    mock.queue('project_results', { data: null });
    await expect(getStudentResults(PROJECT)).resolves.toEqual([]);
  });

  it('throws on a database error', async () => {
    mock.queue('project_results', { error: { message: 'bad' } });
    await expect(getStudentResults(PROJECT)).rejects.toMatchObject({ message: 'bad' });
  });
});
