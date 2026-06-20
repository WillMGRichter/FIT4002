import { supabase } from '../config/supabase';
import { ProjectPage } from '../types';

/** Fetches all pages for a project, ordered by sort_order */
export async function getPagesByProject(projectId: string): Promise<ProjectPage[]> {
  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/** Fetches a single page by its ID */
export async function getPageById(pageId: string): Promise<ProjectPage> {
  const { data, error } = await supabase
    .from('project_pages')
    .select('*')
    .eq('id', pageId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Creates a new page in a project.
 * @param sortOrder - Position in the page sequence (0-based)
 */
export async function createPage(
  projectId: string,
  name: string,
  sortOrder: number
): Promise<ProjectPage> {
  const { data, error } = await supabase
    .from('project_pages')
    .insert([{ project_id: projectId, name, sort_order: sortOrder }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Updates a page with partial data */
export async function updatePage(
  pageId: string,
  updates: Partial<ProjectPage>
): Promise<ProjectPage> {
  const { data, error } = await supabase
    .from('project_pages')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', pageId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Deletes a page by its ID */
export async function deletePage(pageId: string): Promise<void> {
  const { error } = await supabase
    .from('project_pages')
    .delete()
    .eq('id', pageId);

  if (error) throw error;
}

/**
 * Reorders pages by accepting an ordered array of page IDs.
 * Each page's sort_order is set to its index in the array.
 */
export async function reorderPages(
  projectId: string,
  pageIds: string[]
): Promise<void> {
  const updates = pageIds.map((id, index) => ({
    id,
    sort_order: index,
  }));

  const { error } = await supabase
    .from('project_pages')
    .upsert(updates);

  if (error) throw error;
}
