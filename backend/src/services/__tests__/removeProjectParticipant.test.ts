import { createSupabaseMock } from './supabaseMock';

const mock = createSupabaseMock();
jest.mock('../../config/supabase', () => ({
  get supabase() {
    return mock.client;
  },
}));

import { removeProjectParticipant } from '../projectService';

const PROJECT = 'proj-1';
const OTHER_PROJECT = 'proj-2';
const USER = 'user-1';

/** Tables written to (delete) during the call, in order, with the table they hit. */
const deletes = () => mock.calls.filter((c) => c.ops.some((o) => o.method === 'delete')).map((c) => c.table);

beforeEach(() => mock.reset());

describe('removeProjectParticipant', () => {
  it('deletes the account of a student scoped to this project (cascades to enrolment/progress/results)', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: PROJECT } }, { error: null });

    await removeProjectParticipant(PROJECT, USER);

    expect(deletes()).toEqual(['users']);
    const del = mock.calls.filter((c) => c.table === 'users')[1];
    expect(mock.opsOf(del, 'eq')).toEqual(expect.arrayContaining([['id', USER], ['role', 'student']]));
  });

  it('deletes a legacy unscoped student whose only enrolment is this project', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: null } }, { error: null });
    mock.queue('project_participants', { data: [{ project_id: PROJECT }] });

    await removeProjectParticipant(PROJECT, USER);

    expect(deletes()).toEqual(['users']);
  });

  it('only detaches a legacy unscoped student who is also enrolled in another project', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: null } });
    mock.queue(
      'project_participants',
      { data: [{ project_id: PROJECT }, { project_id: OTHER_PROJECT }] },
      { error: null }
    );

    await removeProjectParticipant(PROJECT, USER);

    expect(deletes()).toEqual(['project_participants']); // account preserved
    const del = mock.calls.find((c) => c.ops.some((o) => o.method === 'delete'))!;
    expect(mock.opsOf(del, 'eq')).toEqual(
      expect.arrayContaining([['project_id', PROJECT], ['user_id', USER]])
    );
  });

  it('never deletes a student scoped to a DIFFERENT project; it only detaches', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: OTHER_PROJECT } });
    mock.queue('project_participants', { error: null });

    await removeProjectParticipant(PROJECT, USER);

    expect(deletes()).toEqual(['project_participants']);
  });

  it('never deletes a non-student account (e.g. a teacher); it only detaches', async () => {
    mock.queue('users', { data: { id: USER, role: 'teacher', project_id: null } });
    mock.queue('project_participants', { error: null });

    await removeProjectParticipant(PROJECT, USER);

    expect(deletes()).toEqual(['project_participants']);
    expect(mock.calls.some((c) => c.table === 'users' && c.ops.some((o) => o.method === 'delete'))).toBe(false);
  });

  it('detaches (and does not throw) when the user row no longer exists', async () => {
    mock.queue('users', { data: null });
    mock.queue('project_participants', { error: null });

    await expect(removeProjectParticipant(PROJECT, USER)).resolves.toBeUndefined();
    expect(deletes()).toEqual(['project_participants']);
  });

  it('propagates a user lookup error without deleting anything', async () => {
    mock.queue('users', { error: { message: 'lookup failed' } });

    await expect(removeProjectParticipant(PROJECT, USER)).rejects.toMatchObject({ message: 'lookup failed' });
    expect(deletes()).toEqual([]);
  });

  it('propagates an enrolment lookup error without deleting anything', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: null } });
    mock.queue('project_participants', { error: { message: 'enrol failed' } });

    await expect(removeProjectParticipant(PROJECT, USER)).rejects.toMatchObject({ message: 'enrol failed' });
    expect(deletes()).toEqual([]);
  });

  it('propagates a delete error', async () => {
    mock.queue('users', { data: { id: USER, role: 'student', project_id: PROJECT } }, { error: { message: 'delete failed' } });

    await expect(removeProjectParticipant(PROJECT, USER)).rejects.toMatchObject({ message: 'delete failed' });
  });
});
