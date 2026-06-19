import { supabase } from '../config/supabase';
import { Project, ProjectParticipant } from '../types';

export async function createProject(
  name: string,
  createdBy: string,
  organisationId: string,
  description?: string,
  excelData?: any
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
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectById(projectId: string): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectsByOrganisation(organisationId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('organisation_id', organisationId);

  if (error) throw error;
  return data || [];
}

export async function getProjectsByTeacher(teacherId: string): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('created_by', teacherId);

  if (error) throw error;
  return data || [];
}

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

export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId);

  if (error) throw error;
}

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

export async function getProjectParticipants(projectId: string): Promise<ProjectParticipant[]> {
  const { data, error } = await supabase
    .from('project_participants')
    .select('*')
    .eq('project_id', projectId);

  if (error) throw error;
  return data || [];
}

export async function removeProjectParticipant(projectId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('project_participants')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
}

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
