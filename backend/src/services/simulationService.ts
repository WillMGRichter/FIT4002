import { supabase } from '../config/supabase';
import { SimulationProgress, ProjectResult } from '../types';

/**
 * Saves or updates simulation progress for a user.
 * Uses upsert on the (project_id, user_id) unique constraint.
 * @param state - Current simulation state as a key-value map
 */
export async function saveSimulationProgress(
  projectId: string,
  userId: string,
  state: any
): Promise<SimulationProgress> {
  const { data, error } = await supabase.from('simulation_progress').upsert(
    {
      project_id: projectId,
      user_id: userId,
      state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'project_id,user_id' }
  ).select().single();

  if (error) throw error;
  return data;
}

/**
 * Retrieves saved simulation progress for a user.
 * Returns null if no progress has been saved yet (PGRST116 = not found).
 */
export async function getSimulationProgress(
  projectId: string,
  userId: string
): Promise<SimulationProgress | null> {
  const { data, error } = await supabase
    .from('simulation_progress')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data || null;
}

/**
 * Records a completed simulation submission.
 * @param finalState - The final state of the simulation when submitted
 */
export async function completeSimulation(
  projectId: string,
  userId: string,
  finalState: any
): Promise<ProjectResult> {
  const { data, error } = await supabase
    .from('project_results')
    .insert([
      {
        project_id: projectId,
        user_id: userId,
        final_state: finalState,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Fetches all results for a project, ordered by most recent first */
export async function getProjectResults(projectId: string): Promise<ProjectResult[]> {
  const { data, error } = await supabase
    .from('project_results')
    .select('*')
    .eq('project_id', projectId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/** Fetches a specific user's results for a project */
export async function getUserProjectResults(
  projectId: string,
  userId: string
): Promise<ProjectResult[]> {
  const { data, error } = await supabase
    .from('project_results')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
