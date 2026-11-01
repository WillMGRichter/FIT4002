import { createSupabaseMock } from './supabaseMock';

const mock = createSupabaseMock();
jest.mock('../../config/supabase', () => ({
  get supabase() {
    return mock.client;
  },
}));
// Hashing/JWT are covered by authService tests; keep these fast and deterministic.
jest.mock('../authService', () => ({
  generateToken: jest.fn(() => 'test-token'),
  hashPassword: jest.fn(async () => 'hashed-password'),
}));

import { joinProjectAsStudent } from '../studentJoinService';
import { generateToken } from '../authService';

const PROJECT = { id: 'proj-1', organisation_id: 'org-1', default_max_attempts: 3 };

/** Queue the three queries a successful join makes. */
function queueHappyPath(project: Record<string, unknown> = PROJECT) {
  mock.queue('projects', { data: project });
  mock.queue('users', { data: { id: 'user-1' } });
  mock.queue('project_participants', { error: null });
}

const insertedUser = () =>
  (mock.opsOf(mock.calls.find((c) => c.table === 'users')!, 'insert')[0][0] as Array<Record<string, unknown>>)[0];

beforeEach(() => mock.reset());

describe('joinProjectAsStudent - validation', () => {
  it.each([
    ['', 'a@b.com', 'Display name is required'],
    ['   ', 'a@b.com', 'Display name is required'],
    ['Alice', '', 'Email is required'],
    ['Alice', '   ', 'Email is required'],
  ])('rejects name=%j email=%j with "%s" before touching the database', async (name, email, message) => {
    await expect(joinProjectAsStudent('proj-1', name, email)).rejects.toThrow(message);
    expect(mock.calls).toHaveLength(0);
  });

  it('throws "Project not found" when the project does not exist', async () => {
    mock.queue('projects', { data: null, error: { message: 'no rows' } });
    await expect(joinProjectAsStudent('missing', 'Alice', 'a@b.com')).rejects.toThrow('Project not found');
  });
});

describe('joinProjectAsStudent - success', () => {
  it('creates a project-scoped student, enrols them, and returns a token', async () => {
    queueHappyPath();

    const result = await joinProjectAsStudent('proj-1', 'Alice Smith', 'alice@example.com');

    expect(result).toEqual({
      token: 'test-token',
      userId: 'user-1',
      displayName: 'Alice Smith',
      email: 'alice@example.com',
      maxAttempts: 3,
    });
    expect(generateToken).toHaveBeenCalledWith('user-1');

    expect(insertedUser()).toEqual({
      username: expect.stringMatching(/^alice_smith_[0-9a-f]{8}$/),
      email: 'alice@example.com',
      password_hash: 'hashed-password',
      role: 'student',
      organisation_id: 'org-1',
      project_id: 'proj-1', // regression guard: join-created students must be project-scoped
    });

    const participant = mock.calls.find((c) => c.table === 'project_participants')!;
    expect(mock.opsOf(participant, 'insert')[0]).toEqual([
      [{ project_id: 'proj-1', user_id: 'user-1', role: 'student', max_attempts: 3, attempts_used: 0 }],
    ]);
  });

  it('trims the typed name and email', async () => {
    queueHappyPath();
    const result = await joinProjectAsStudent('proj-1', '  Bob  ', '  bob@example.com ');
    expect(result.displayName).toBe('Bob');
    expect(result.email).toBe('bob@example.com');
  });

  it('defaults to 1 attempt when the project has no attempts setting', async () => {
    queueHappyPath({ ...PROJECT, default_max_attempts: null });
    const result = await joinProjectAsStudent('proj-1', 'Alice', 'a@b.com');
    expect(result.maxAttempts).toBe(1);
  });

  it('gives each joiner a unique username even for the same name', async () => {
    queueHappyPath();
    await joinProjectAsStudent('proj-1', 'Alice', 'a@b.com');
    const first = insertedUser().username;

    mock.reset();
    queueHappyPath();
    await joinProjectAsStudent('proj-1', 'Alice', 'a@b.com');
    expect(insertedUser().username).not.toBe(first);
  });

  it('sanitises unusual names into a safe username', async () => {
    queueHappyPath();
    await joinProjectAsStudent('proj-1', "  Zoë O'Brien!! ", 'z@b.com');
    expect(insertedUser().username).toMatch(/^[a-z0-9_]+_[0-9a-f]{8}$/);
  });

  it('falls back to "student" when the name has no usable characters', async () => {
    queueHappyPath();
    await joinProjectAsStudent('proj-1', '!!!', 'a@b.com');
    expect(insertedUser().username).toMatch(/^student_[0-9a-f]{8}$/);
  });

  it('truncates very long names to 20 characters before the suffix', async () => {
    queueHappyPath();
    await joinProjectAsStudent('proj-1', 'A'.repeat(60), 'a@b.com');
    expect(insertedUser().username).toMatch(/^a{20}_[0-9a-f]{8}$/);
  });
});

describe('joinProjectAsStudent - failures', () => {
  it('throws "Could not create student session" and does not enrol if the user insert fails', async () => {
    mock.queue('projects', { data: PROJECT });
    mock.queue('users', { data: null, error: { message: 'insert failed' } });

    await expect(joinProjectAsStudent('proj-1', 'Alice', 'a@b.com')).rejects.toThrow('Could not create student session');
    expect(mock.calls.some((c) => c.table === 'project_participants')).toBe(false);
  });

  it('throws "Could not enrol student" if the participant insert fails', async () => {
    mock.queue('projects', { data: PROJECT });
    mock.queue('users', { data: { id: 'user-1' } });
    mock.queue('project_participants', { error: { message: 'insert failed' } });

    await expect(joinProjectAsStudent('proj-1', 'Alice', 'a@b.com')).rejects.toThrow('Could not enrol student');
  });
});
