import { supabase } from '../config/supabase';
import { StudentSimulationState } from '../types';

export async function getOrCreateState(
  projectId: string,
  userId: string
): Promise<StudentSimulationState | null> {
  const { data: existing } = await supabase
    .from('student_simulation_state')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .single();

  if (existing) return existing;

  const { data: participant } = await supabase
    .from('project_participants')
    .select('attempts_used, max_attempts')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single();

  if (!participant) throw new Error('Not a participant of this project');
  if (participant.attempts_used >= participant.max_attempts) {
    throw new Error('No attempts remaining');
  }

  const newAttemptNumber = participant.attempts_used + 1;

  const { data: firstPage } = await supabase
    .from('project_pages')
    .select('id')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from('student_simulation_state')
    .insert([{
      project_id: projectId,
      user_id: userId,
      attempt_number: newAttemptNumber,
      current_page_id: firstPage?.id || null,
      input_values: {},
    }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateInputValues(
  stateId: string,
  inputValues: any
): Promise<StudentSimulationState> {
  const { data, error } = await supabase
    .from('student_simulation_state')
    .update({ input_values: inputValues, updated_at: new Date().toISOString() })
    .eq('id', stateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCurrentPage(
  stateId: string,
  pageId: string
): Promise<StudentSimulationState> {
  const { data, error } = await supabase
    .from('student_simulation_state')
    .update({ current_page_id: pageId, updated_at: new Date().toISOString() })
    .eq('id', stateId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeAttempt(
  stateId: string,
  projectId: string,
  userId: string,
  finalInputValues: any
): Promise<void> {
  const { error: stateError } = await supabase
    .from('student_simulation_state')
    .update({ is_completed: true, input_values: finalInputValues, updated_at: new Date().toISOString() })
    .eq('id', stateId);

  if (stateError) throw stateError;

  const { error: incrementError } = await supabase.rpc('increment_attempts_used', {
    p_project_id: projectId,
    p_user_id: userId,
  });

  if (incrementError) {
    const { data: participant } = await supabase
      .from('project_participants')
      .select('attempts_used')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single();

    if (participant) {
      await supabase
        .from('project_participants')
        .update({ attempts_used: (participant.attempts_used || 0) + 1 })
        .eq('project_id', projectId)
        .eq('user_id', userId);
    }
  }

  // Also store in project_results
  const { error: resultError } = await supabase
    .from('project_results')
    .insert([{
      project_id: projectId,
      user_id: userId,
      final_state: { input_values: finalInputValues, attempt_number: 0 },
    }]);

  if (resultError) throw resultError;
}

export async function getStudentResults(projectId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('project_results')
    .select('*, users:user_id(username, email)')
    .eq('project_id', projectId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
