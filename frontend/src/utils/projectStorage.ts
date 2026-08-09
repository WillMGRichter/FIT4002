export interface ProjectBrief {
  id: string;
  name: string;
}

const STARRED_KEY = 'starredProjects';
const RECENT_KEY = 'recentProjects';
const MAX_RECENT = 8;

export function getStarredProjects(): ProjectBrief[] {
  try {
    const raw = localStorage.getItem(STARRED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setStarredProjects(projects: ProjectBrief[]): void {
  localStorage.setItem(STARRED_KEY, JSON.stringify(projects));
}

export function toggleStar(project: ProjectBrief): void {
  const current = getStarredProjects();
  const idx = current.findIndex(p => p.id === project.id);
  if (idx >= 0) {
    current.splice(idx, 1);
  } else {
    current.push(project);
  }
  setStarredProjects(current);
}

export function isStarred(projectId: string): boolean {
  return getStarredProjects().some(p => p.id === projectId);
}

export function addRecent(project: ProjectBrief): void {
  const current = getRecentProjects();
  const filtered = current.filter(p => p.id !== project.id);
  const updated = [project, ...filtered].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
}

export function getRecentProjects(): ProjectBrief[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
