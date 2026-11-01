import { supabase } from '../config/supabase';
import { JsonObject, ProjectResult, StudentSimulationState } from '../types';

/** A stored result plus the student's username/email from the `users:user_id` join. */
export type StudentResultRow = ProjectResult & {
  users: { username: string; email: string | null } | null;
};

/**
 * Retrieves the current active state for a student, or creates a new one if none exists.
 * Checks participant validity and remaining attempts before creating new state.
 * @returns The existing or newly created StudentSimulationState
 */
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

  // Determine the next attempt number from the ACTUAL state rows for this
  // (project, user), not from attempts_used. attempts_used is maintained
  // separately (and can drift if an increment failed), so relying on it to
  // build the attempt_number risks reusing a value and violating the
  // UNIQUE(project_id, user_id, attempt_number) constraint ("duplicate key").
  const { data: attemptRows } = await supabase
    .from('student_simulation_state')
    .select('attempt_number')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('attempt_number', { ascending: false })
    .limit(1);

  const highestAttempt = attemptRows && attemptRows.length > 0 ? attemptRows[0].attempt_number : 0;

  // The student has used an attempt for every state row that already exists
  // (the current incomplete one was handled above). Gate on max_attempts.
  if (highestAttempt >= participant.max_attempts) {
    throw new Error('No attempts remaining');
  }

  const newAttemptNumber = highestAttempt + 1;

  const { data: firstPage } = await supabase
    .from('project_pages')
    .select('id')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
    .limit(1)
    .single();

  // Insert the new attempt row. Two requests can reach here concurrently (a
  // phone often fires the "get or create" call twice on mount), both compute
  // the same newAttemptNumber, and the second insert would violate
  // UNIQUE(project_id, user_id, attempt_number) ("duplicate key"). Upsert with
  // ignoreDuplicates makes the losing request a no-op instead of an error; we
  // then read back whichever row now exists for this attempt and return it, so
  // both callers get a valid, identical state.
  const { error } = await supabase
    .from('student_simulation_state')
    .upsert(
      [{
        project_id: projectId,
        user_id: userId,
        attempt_number: newAttemptNumber,
        current_page_id: firstPage?.id || null,
        input_values: {},
      }],
      { onConflict: 'project_id,user_id,attempt_number', ignoreDuplicates: true }
    );

  if (error) throw error;

  const { data, error: readError } = await supabase
    .from('student_simulation_state')
    .select('*')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('attempt_number', newAttemptNumber)
    .single();

  if (readError) throw readError;
  return data;
}

/** Updates the input values for a student's simulation state */
export async function updateInputValues(
  stateId: string,
  inputValues: JsonObject
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

/** Updates the current page the student is viewing in the simulation */
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

/**
 * Marks a simulation attempt as completed.
 * Marks the state as completed, increments attempts_used (via RPC with fallback),
 * and stores the final result in project_results.
 */
export async function completeAttempt(
  stateId: string,
  projectId: string,
  userId: string,
  finalInputValues: JsonObject
): Promise<void> {
  // Guard against completing a state that is already completed (e.g. a double
  // submit, or a retry after a flaky network). Without this, we would run the
  // attempts increment and results insert twice.
  const { data: current } = await supabase
    .from('student_simulation_state')
    .select('is_completed, attempt_number')
    .eq('id', stateId)
    .single();

  if (!current) throw new Error('Simulation state not found');
  if (current.is_completed) return; // already done - idempotent no-op

  const { error: stateError } = await supabase
    .from('student_simulation_state')
    .update({ is_completed: true, input_values: finalInputValues, updated_at: new Date().toISOString() })
    .eq('id', stateId);

  if (stateError) throw stateError;

  const { error: incrementError } = await supabase.rpc('increment_attempts_used', {
    p_project_id: projectId,
    p_user_id: userId,
  });

  // Fallback: if RPC function doesn't exist, increment manually
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

  const { error: resultError } = await supabase
    .from('project_results')
    .insert([{
      project_id: projectId,
      user_id: userId,
      final_state: { input_values: finalInputValues, attempt_number: current.attempt_number },
    }]);

  if (resultError) throw resultError;
}

/**
 * Fetches all student results for a project, including associated user data.
 * Joins with users table to include username and email.
 */
export async function getStudentResults(projectId: string): Promise<StudentResultRow[]> {
  const { data, error } = await supabase
    .from('project_results')
    .select('*, users:user_id(username, email)')
    .eq('project_id', projectId)
    .order('completed_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
