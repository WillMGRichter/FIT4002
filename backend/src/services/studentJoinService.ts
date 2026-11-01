import { randomUUID } from 'crypto';
import { supabase } from '../config/supabase';
import { generateToken, hashPassword } from './authService';

export interface StudentJoinResult {
  token: string;
  userId: string;
  displayName: string;
  email: string;
  maxAttempts: number;
}

/**
 * Anonymous student join for a shareable project link.
 *
 * Creates a lightweight "student" user row (so the existing state/results
 * machinery, which keys off users.id, works unchanged), enrols it as a
 * participant using the project's per-project attempts setting, and returns a
 * standard JWT. From the caller's perspective the student is then just an
 * authenticated student and uses the normal project/pages/student-state routes.
 *
 * @param projectId   the project being joined
 * @param displayName the name the student typed on the join screen
 * @param email       the email the student typed on the join screen
 */
export async function joinProjectAsStudent(
  projectId: string,
  displayName: string,
  email: string
): Promise<StudentJoinResult> {
  const name = (displayName || '').trim();
  const mail = (email || '').trim();
  if (!name) throw new Error('Display name is required');
  if (!mail) throw new Error('Email is required');

  // Project must exist; pull the org + attempts setting.
  const { data: project, error: projErr } = await supabase
    .from('projects')
    .select('id, organisation_id, default_max_attempts')
    .eq('id', projectId)
    .single();
  if (projErr || !project) throw new Error('Project not found');

  const maxAttempts = project.default_max_attempts ?? 1;

  // Create a unique student user. Username must be unique, so we base it on the
  // typed name plus a short random token; the typed email is stored as-is so the
  // teacher's results view can show it.
  const suffix = randomUUID().slice(0, 8);
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20) || 'student';
  const username = `${safeName}_${suffix}`;
  const randomPassword = randomUUID() + randomUUID();
  const passwordHash = await hashPassword(randomPassword);

  const { data: user, error: userErr } = await supabase
    .from('users')
    .insert([{
      username,
      email: mail,
      password_hash: passwordHash,
      role: 'student',
      organisation_id: project.organisation_id,
      // Scope the account to this project (migration 005). Without it the row is
      // treated as a global account and project-scoped logic (login lookup,
      // student removal) can't recognise it as belonging to this project.
      project_id: projectId,
    }])
    .select('id')
    .single();
  if (userErr || !user) throw new Error('Could not create student session');

  // Enrol as a participant with the project's attempts allowance.
  const { error: partErr } = await supabase
    .from('project_participants')
    .insert([{
      project_id: projectId,
      user_id: user.id,
      role: 'student',
      max_attempts: maxAttempts,
      attempts_used: 0,
    }]);
  if (partErr) throw new Error('Could not enrol student');

  return {
    token: generateToken(user.id),
    userId: user.id,
    displayName: name,
    email: mail,
    maxAttempts,
  };
}
