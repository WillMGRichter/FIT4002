import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { supabase } from '../config/supabase';
import { SafeUser, AuthResponse } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-prod';
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
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch {
    return null;
  }
}

/**
 * Creates a new user account.
 * @param username - Unique username for the new user
 * @param password - Plaintext password (hashed before storage)
 * @param role - User role (admin, teacher, student)
 * @param organisationId - Optional ID of the organisation to associate the user with
 * @returns AuthResponse containing JWT token and user data (without password_hash)
 */
export async function registerUser(
  username: string,
  password: string,
  role: string,
  organisationId?: string
): Promise<AuthResponse> {
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (existingUser) {
    throw new Error('Username already exists');
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
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
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
 * Fetches a user by their ID, stripping the password_hash.
 * @param userId - UUID of the user
 * @returns SafeUser object without password_hash
 */
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
