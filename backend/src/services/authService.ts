import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { supabase } from './supabase';
import { User, AuthResponse } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-prod';
const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): string | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId;
  } catch {
    return null;
  }
}

export async function registerUser(
  username: string,
  password: string,
  role: string,
  organisationId?: string
): Promise<AuthResponse> {
  // Check if user exists
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .single();

  if (existingUser) {
    throw new Error('Username already exists');
  }

  const passwordHash = await hashPassword(password);

  // Create user
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

  const token = generateToken(user.id);
  return { token, user };
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
  // Get user
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  // Compare password
  const isValidPassword = await comparePassword(password, user.password_hash);
  if (!isValidPassword) {
    throw new Error('Invalid password');
  }

  const token = generateToken(user.id);
  return { token, user };
}

export async function getUserById(userId: string): Promise<User> {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !user) {
    throw new Error('User not found');
  }

  return user;
}

export async function createOrganisation(name: string): Promise<string> {
  const { data, error } = await supabase
    .from('organisations')
    .insert([{ name }])
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}
