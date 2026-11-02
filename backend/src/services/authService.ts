import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';
import { SafeUser, AuthResponse } from '../types';

/**
 * Placeholder that used to be the silent fallback. It is public (it was in the
 * repo), so a deployment running with it would let anyone forge a valid token.
 * Rejecting it explicitly stops a copy-pasted example value from reaching prod.
 */
const INSECURE_PLACEHOLDER_SECRETS = new Set([
  'your-secret-key-change-in-prod',
  'your_super_secret_key_change_in_prod',
  'my-super-secret-key-please-change',
]);

/**
 * Reads JWT_SECRET and fails fast at startup if it is missing or a known
 * placeholder, rather than silently signing tokens with a guessable key.
 */
function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Missing JWT_SECRET env var. Set it to a long random string, e.g. ' +
        '`node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"`.'
    );
  }
  if (INSECURE_PLACEHOLDER_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET is set to a known placeholder value. Generate a real random secret.');
  }
  return secret;
}

const JWT_SECRET = requireJwtSecret();
const SALT_ROUNDS = 10;

/** Hashes a plaintext password using bcrypt */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/** Compares a plaintext password against a bcrypt hash */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Generates a JWT token for the given userId, valid for 7 days */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

/** Verifies a JWT token and returns the userId, or null if invalid/expired */
export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // jwt.verify may return a bare string payload; ours always carries a string userId.
    if (typeof decoded === 'string') return null;
    return typeof decoded.userId === 'string' ? decoded.userId : null;
  } catch {
    return null;
  }
}

/**
 * Creates a new user account.
 * @param username - Username for the new user (globally unique for real accounts;
 *                    unique within a project for student accounts)
 * @param password - Plaintext password (hashed before storage)
 * @param role - User role (admin, teacher, student)
 * @param organisationId - Optional ID of the organisation to associate the user with
 * @param projectId - Optional project to scope the account to. Set for student
 *                    accounts so the same username can be reused across projects;
 *                    omit (NULL) for real org/admin/teacher accounts.
 * @returns AuthResponse containing JWT token and user data (without password_hash)
 */
export async function registerUser(
  username: string,
  password: string,
  role: string,
  organisationId?: string,
  projectId?: string
): Promise<AuthResponse> {
  // Duplicate check is scoped: student accounts collide only within the same
  // project; real accounts (no projectId) collide globally.
  let dupQuery = supabase.from('users').select('id').eq('username', username);
  dupQuery = projectId ? dupQuery.eq('project_id', projectId) : dupQuery.is('project_id', null);
  const { data: existingUser } = await dupQuery.single();

  if (existingUser) {
    throw new Error(
      projectId ? 'Username already exists in this project' : 'Username already exists'
    );
  }

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabase
    .from('users')
    .insert([
      {
        username,
        password_hash: passwordHash,
        role,
        organisation_id: organisationId,
        project_id: projectId ?? null,
      },
    ])
    .select()
    .single();

  if (error) throw error;

  const { password_hash: _, ...safeUser } = user;
  const token = generateToken(user.id);
  return { token, user: safeUser as SafeUser };
}

/**
 * Authenticates a user by username and password.
 * @param username - The user's username
 * @param password - The user's plaintext password
 * @returns AuthResponse containing JWT token and user data
 */
export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  // Only real accounts (org/admin/teacher) log in through this global path.
  // Student accounts are project-scoped and authenticate via loginStudent, so we
  // exclude them here to avoid matching a same-named student from some project.
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .is('project_id', null)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  const { password_hash: _, ...safeUser } = user;
  const token = generateToken(user.id);
  return { token, user: safeUser as SafeUser };
}

/**
 * Authenticates a STUDENT within a specific project.
 *
 * Student accounts are scoped per project (see migration 005), so the same
 * username can exist in multiple projects. Resolving the login by
 * (project_id, username) guarantees we authenticate the student that belongs to
 * THIS project and never a same-named student from another project.
 *
 * @param projectId - The project the student is joining
 * @param username - The student's username (unique within the project)
 * @param password - The student's plaintext password
 * @returns AuthResponse containing JWT token and user data
 */
export async function loginStudent(
  projectId: string,
  username: string,
  password: string
): Promise<AuthResponse> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('project_id', projectId)
    .eq('username', username)
    .eq('role', 'student')
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  const { password_hash: _, ...safeUser } = user;
  const token = generateToken(user.id);
  return { token, user: safeUser as SafeUser };
}
export async function getUserById(userId: string): Promise<SafeUser> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  const { password_hash: _, ...safeUser } = user;
  return safeUser as SafeUser;
}

/** Fetches all organisations ordered by name */
export async function listOrganisations(): Promise<{ id: string; name: string; created_at: string }[]> {
  const { data, error } = await supabase
    .from('organisations')
    .select('id, name, created_at')
    .order('name');

  if (error) throw error;
  return data || [];
}

/**
 * Creates a new organisation.
 * @param name - Unique organisation name
 * @returns The ID of the newly created organisation
 */
export async function createOrganisation(name: string): Promise<string> {
  const { data, error } = await supabase
    .from('organisations')
    .insert([{ name }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
