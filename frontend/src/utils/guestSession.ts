// Anonymous "student" join session, persisted in localStorage so a student can
// refresh / come back and resume their saved simulation state. Keyed per project
// id so joining different projects doesn't clobber each other.
//
// A guest session holds a normal JWT (minted by POST /public/projects/:id/join),
// so once joined the student talks to the regular authenticated routes.

export interface GuestSession {
  token: string;
  userId: string;
  displayName: string;
  email: string;
  maxAttempts: number;
}

const keyFor = (projectId: string) => `smartsim_guest_${projectId}`;

export function getGuestSession(projectId: string): GuestSession | null {
  try {
    const raw = localStorage.getItem(keyFor(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.token === 'string') return parsed as GuestSession;
    return null;
  } catch {
    return null;
  }
}

export function saveGuestSession(projectId: string, session: GuestSession): void {
  try {
    localStorage.setItem(keyFor(projectId), JSON.stringify(session));
  } catch { /* storage unavailable - session just won't persist */ }
}

export function clearGuestSession(projectId: string): void {
  try {
    localStorage.removeItem(keyFor(projectId));
  } catch { /* ignore */ }
}
