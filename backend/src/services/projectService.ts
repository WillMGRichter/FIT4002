import { supabase } from '../config/supabase';
import { Project, ProjectParticipant } from '../types';

/**
 * Creates a new simulation project.
 * @param name - Project name
 * @param createdBy - User ID of the creator
 * @param organisationId - Organisation the project belongs to
 * @param description - Optional description
 * @param excelData - Parsed Excel data (cells, formulas, etc.)
 * @returns The newly created Project
 */
export async function createProject(
  name: string,
  createdBy: string,
  organisationId: string,
  description?: string,
  excelData?: any,
  defaultMaxAttempts?: number
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        name,
        description,
        created_by: createdBy,
        organisation_id: organisationId,
        excel_data: excelData,
        visibility: 'private',
        default_max_attempts: defaultMaxAttempts && defaultMaxAttempts > 0 ? defaultMaxAttempts : 1,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Fetches a single project by its ID */
export async function getProjectById(projectId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

/** Fetches all projects belonging to an organisation */
export async function getProjectsByOrganisation(organisationId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return data || [];
}

/** Fetches all projects created by a specific teacher */
export async function getProjectsByTeacher(teacherId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('created_by', teacherId);

  if (error) throw error;
  return data || [];
}

/**
 * Updates an existing project with partial data.
 * @param projectId - ID of the project to update
 * @param updates - Partial Project object with fields to update
 */
export async function updateProject(
  projectId: string,
  updates: Partial<Project>
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Deletes a project by its ID */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

/**
 * Adds a user as a participant to a project.
 * @param projectId - Project to add the user to
 * @param userId - User to add
 * @param role - Either 'teacher' or 'student'
 * @param maxAttempts - Maximum simulation attempts allowed (default: 1)
 */
export async function addProjectParticipant(
  projectId: string,
  userId: string,
  role: 'teacher' | 'student',
  maxAttempts?: number
): Promise<ProjectParticipant> {
  const { data, error } = await supabase
    .from('project_participants')
    .insert([
      {
        project_id: projectId,
        user_id: userId,
        role,
        max_attempts: maxAttempts || 1,
        attempts_used: 0,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Fetches all participants for a given project */
export async function getProjectParticipants(projectId: string): Promise<ProjectParticipant[]> {
  const { data, error } = await supabase
    .from('project_participants')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data || [];
}

/** Fetches participants with their usernames via a join on the users table */
export async function getProjectParticipantsWithUsernames(projectId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('project_participants')
    .select(`
      *,
      users:user_id ( username )
    `)
    .eq('project_id', projectId);

  if (error) throw error;
  return (data || []).map((p: any) => ({
    ...p,
    username: p.users?.username || null,
  }));
}

/**
 * Removes a student from a project.
 *
 * Student accounts are project-scoped (see migration 005): one `users` row per
 * student per project, with `users.project_id` set, and every child table
 * (project_participants, simulation_progress, student_simulation_state,
 * project_results) declares ON DELETE CASCADE on its user_id. So for a project
 * student we delete the `users` row itself, which cascades away the participant
 * link, progress, state and results, and frees the username for re-add.
 *
 * Deleting only the join row (the previous behaviour) left an orphaned `users`
 * row: the student appeared to be removed but their account lingered, which
 * both re-populated the list and tripped the uniq_users_username_per_project
 * index when the same username was added again.
 *
 * For any non-student / global account (project_id IS NULL) we never delete the
 * user; we only detach the participant row, as before.
 */
export async function removeProjectParticipant(projectId: string, userId: string): Promise<void> {
  const { data: user, error: lookupError } = await supabase
    .from('users')
    .select('id, role, project_id')
    .eq('id', userId)
    .maybeSingle();

  if (lookupError) throw lookupError;

  const isProjectStudent =
    !!user && user.role === 'student' && user.project_id === projectId;

  if (isProjectStudent) {
    // Deleting the student user cascades to project_participants,
    // simulation_progress, student_simulation_state and project_results.
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .eq('project_id', projectId);

    if (error) throw error;
    return;
  }

  // Non-student (or mismatched project): only detach from this project.
  const { error } = await supabase
    .from('project_participants')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Fetches all projects a student is enrolled in.
 * Uses the project_participants join table to find associated projects.
 */
export async function getStudentProjects(studentId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('project_participants')
    .select('project_id')
    .eq('user_id', studentId)
    .eq('role', 'student');

  if (error) throw error;
  if (!data || data.length === 0) return [];

  const projectIds = data.map((p) => p.project_id);

  const { data: projects, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .in('id', projectIds);

  if (projectError) throw projectError;
  return projects || [];
}
