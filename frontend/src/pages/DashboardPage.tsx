import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical, PlusCircle, Search as SearchIcon, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, ProjectBadge, StarButton } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent, getStarredProjects, toggleStar, pruneStoredProjects, removeProject } from '../utils/projectStorage';
import { getErrorMessage } from '../utils/errors';
import type { ParticipantRow } from '../types/simulation';
import './Dashboard.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  visibility: string;
}

const badgeColors = ['#6f98f6', '#ff4d1f', '#ffc400', '#ffc400', '#6f98f6', '#ffc400', '#9b55f4', '#9b55f4'];

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starred, setStarred] = useState<Set<string>>(() => new Set(getStarredProjects().map(p => p.id)));
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Menu state
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null);
  const [copiedProjectId, setCopiedProjectId] = useState<string | null>(null);
  // Project whose join link is being shared (null = dialog closed), and the
  // editable base URL for the link. The base URL defaults to the current origin
  // but the teacher can change it (e.g. to their LAN IP) and we remember it.
  const [shareProjectId, setShareProjectId] = useState<string | null>(null);
  const [shareBaseUrl, setShareBaseUrl] = useState<string>('');
  const menuRef = useRef<HTMLDivElement>(null);

  // Delete state
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuProjectId(null);
      }
    };
    if (menuProjectId) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuProjectId]);

  const fetchProjects = useCallback(async () => {
    if (!token) return;

    try {
      setLoading(true);
      const endpoint = user?.role === 'student'
        ? `${API_URL}/projects/student/projects`
        : `${API_URL}/projects/teacher/projects`;

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
      pruneStoredProjects(new Set(data.map((p: Project) => p.id)));

      const counts: Record<string, number> = {};
      await Promise.all(data.map(async (p: Project) => {
        try {
          const partRes = await fetch(`${API_URL}/projects/${p.id}/participants`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (partRes.ok) {
            const participants = await partRes.json();
            counts[p.id] = participants.filter((part: ParticipantRow) => part.role === 'student').length;
          }
        } catch { /* skip */ }
      }));
      setStudentCounts(counts);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [user?.role, token]);

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }
    fetchProjects();
  }, [token, navigate, fetchProjects]);

  const visibleProjects = projects;

  const filteredProjects = useMemo(() => {
    if (!searchQuery) return visibleProjects;
    const q = searchQuery.toLowerCase();
    return visibleProjects.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
  }, [visibleProjects, searchQuery]);

  const handleProjectClick = (projectId: string, projectName: string) => {
    addRecent({ id: projectId, name: projectName });
    if (user?.role === 'student') {
      navigate(`/projects/${projectId}/play`);
    } else {
      navigate(`/projects/${projectId}/design`);
    }
  };

  const handleToggleStar = (projectId: string, projectName: string, event: React.MouseEvent) => {
    event.stopPropagation();
    toggleStar({ id: projectId, name: projectName });
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const openEdit = (project: Project) => {
    setMenuProjectId(null);
    navigate(`/projects/create?edit=${project.id}`);
  };

  // Open the share dialog for a project.
  //
  // The base URL always tracks the CURRENT origin's scheme + port, so the link
  // works no matter which port the dev server started on (CRA bumps 3000 -> 3001
  // -> 3002 when ports are taken). We never trust a previously saved port.
  //
  // The only thing a teacher may override is the HOST, and only when the browser
  // origin is localhost/127.0.0.1 — which can't be opened from another device.
  // In that case we graft the saved host onto the live scheme + port so an old
  // saved port can never resurface.
  const JOIN_BASE_URL_KEY = 'smartsim_join_host';
  const copyJoinLink = (projectId: string) => {
    setMenuProjectId(null);

    const { protocol, hostname, port } = window.location;
    const portSuffix = port ? `:${port}` : '';
    const isLocal = /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(hostname);

    let base = `${protocol}//${hostname}${portSuffix}`;
    if (isLocal) {
      // Browser is on localhost; let a saved LAN host (hostname only) stand in,
      // but keep the live scheme + port.
      const savedHost = (() => {
        try { return (localStorage.getItem(JOIN_BASE_URL_KEY) || '').trim(); } catch { return ''; }
      })();
      if (savedHost) base = `${protocol}//${savedHost}${portSuffix}`;
    }

    setShareBaseUrl(base);
    setShareProjectId(projectId);
  };

  // Normalise the editable base URL (trim, strip trailing slashes) and build the
  // full join link for the project currently being shared.
  const normalisedBaseUrl = shareBaseUrl.trim().replace(/\/+$/, '');
  const shareLink = shareProjectId ? `${normalisedBaseUrl}/join/${shareProjectId}` : '';

  const persistAndCopyLink = () => {
    // Persist only the HOST portion (no scheme, no port) so an edited LAN IP is
    // remembered for localhost sessions, while the port always comes from the
    // live origin and can never go stale.
    try {
      const host = normalisedBaseUrl.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
      localStorage.setItem(JOIN_BASE_URL_KEY, host);
    } catch { /* ignore */ }
    if (shareLink) {
      navigator.clipboard?.writeText(shareLink).catch(() => {});
      if (shareProjectId) {
        setCopiedProjectId(shareProjectId);
        window.setTimeout(() => setCopiedProjectId(null), 2000);
      }
    }
  };

  const handleDelete = async () => {
    if (!deleteProjectId || !token) return;
    try {
      const res = await fetch(`${API_URL}/projects/${deleteProjectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteProjectId(null);
      removeProject(deleteProjectId);
      fetchProjects();
    } catch (err: unknown) {
      alert(getErrorMessage(err));
    }
  };

  const isTeacher = user?.role !== 'student';

  return (
    <AppShell title="Simulations" activeItem="home">
      <div className="dashboard-page">
        {loading ? (
          <div className="dashboard-state">Loading simulations...</div>
        ) : error ? (
          <div className="dashboard-state dashboard-state--error">{error}</div>
        ) : (
          <div className="dashboard-page__content">
            {searchQuery && (
              <div className="dashboard-search-header">
                <SearchIcon size={18} />
                <span>Results for &quot;{searchQuery}&quot; ({filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''})</span>
                <button className="dashboard-search-clear" onClick={() => setSearchParams({}, { replace: true })}>Clear</button>
              </div>
            )}
            <div className="dashboard-grid">
              {!searchQuery && (
                <button className="simulation-card simulation-card--create" onClick={() => navigate('/projects/create')}>
                  <PlusCircle size={43} strokeWidth={2.3} />
                  <span>Create New Simulation</span>
                </button>
              )}

              {filteredProjects.map((project, index) => {
                const count = studentCounts[project.id] ?? 0;
                return (
                  <div
                    key={project.id}
                    className="simulation-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleProjectClick(project.id, project.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleProjectClick(project.id, project.name);
                      }
                    }}
                  >
                    <div className="simulation-card__top">
                      <ProjectBadge color={badgeColors[index % badgeColors.length]} />
                      <div className="simulation-card__top-actions">
                        <StarButton active={starred.has(project.id)} onClick={(event) => handleToggleStar(project.id, project.name, event)} />
                        {isTeacher && (
                          <div className="simulation-card__menu-wrapper">
                            <button
                              className="simulation-card__menu-btn"
                              onClick={e => { e.stopPropagation(); setMenuProjectId(menuProjectId === project.id ? null : project.id); }}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuProjectId === project.id && (
                              <div className="simulation-card__menu" ref={menuRef}>
                                <button className="simulation-card__menu-item" onClick={e => { e.stopPropagation(); openEdit(project); }}>
                                  Edit
                                </button>
                                <button className="simulation-card__menu-item" onClick={e => { e.stopPropagation(); copyJoinLink(project.id); }}>
                                  {copiedProjectId === project.id ? 'Link copied!' : 'Copy join link'}
                                </button>
                                <button
                                  className="simulation-card__menu-item simulation-card__menu-item--danger"
                                  onClick={e => { e.stopPropagation(); setMenuProjectId(null); setDeleteProjectId(project.id); }}
                                >
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="simulation-card__body">
                      <h2>{project.name}</h2>
                      <p>{project.description}</p>
                    </div>
                    <div className="simulation-card__members">
                      {count} {count === 1 ? 'student' : 'students'}
                    </div>
                  </div>
                );
              })}

              {filteredProjects.length === 0 && searchQuery && (
                <div className="dashboard-state">No projects match &quot;{searchQuery}&quot;</div>
              )}
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {deleteProjectId && (
          <div className="modal-overlay" onClick={() => setDeleteProjectId(null)}>
            <div className="modal modal--small" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3>Delete Simulation</h3>
                <button className="modal__close" onClick={() => setDeleteProjectId(null)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <p>Are you sure you want to delete this simulation? This action cannot be undone.</p>
              </div>
              <div className="modal__footer">
                <button className="modal__btn modal__btn--cancel" onClick={() => setDeleteProjectId(null)}>Cancel</button>
                <button className="modal__btn modal__btn--danger" onClick={handleDelete}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Share join link */}
        {shareProjectId && (
          <div className="modal-overlay" onClick={() => setShareProjectId(null)}>
            <div className="modal modal--small" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h3>Student join link</h3>
                <button className="modal__close" onClick={() => setShareProjectId(null)}><X size={18} /></button>
              </div>
              <div className="modal__body">
                <p>Share this link with students. They sign in with the username and password you assigned them, then start.</p>

                <label style={{ display: 'block', marginTop: 10, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Address students will use
                </label>
                <input
                  value={shareBaseUrl}
                  onChange={e => setShareBaseUrl(e.target.value)}
                  placeholder="http://192.168.x.x:3000"
                  style={{ width: '100%', marginTop: 4, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                />
                <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
                  Change this to your computer&apos;s network address so students on other devices can connect.
                </p>

                <label style={{ display: 'block', marginTop: 12, fontSize: 12, fontWeight: 600, color: '#475569' }}>
                  Join link
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    readOnly
                    value={shareLink}
                    onFocus={e => e.currentTarget.select()}
                    style={{ flex: 1, padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }}
                  />
                  <button className="modal__btn modal__btn--cancel" onClick={persistAndCopyLink}>
                    {copiedProjectId === shareProjectId ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                {/^https?:\/\/(localhost|127\.0\.0\.1)/.test(normalisedBaseUrl) && (
                  <div style={{ marginTop: 12, fontSize: 13, color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '8px 10px' }}>
                    <p style={{ margin: 0 }}>
                      This address uses <strong>localhost</strong>, so it only works on this computer. To let students
                      join from another device on the same Wi‑Fi, change the address above to your computer&apos;s
                      network address (e.g. <code>http://192.168.x.x:3000</code>). Both devices must be on the same
                      network, and if your computer&apos;s firewall is on you may need to allow incoming connections.
                    </p>
                    <details style={{ marginTop: 8 }}>
                      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>How do I find my network address?</summary>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        <li><strong>macOS:</strong> System Settings → Wi‑Fi → Details → IP address (or run <code>ipconfig getifaddr en0</code> in Terminal).</li>
                        <li><strong>Windows:</strong> Settings → Network &amp; Internet → Wi‑Fi → Hardware properties → IPv4 address (or run <code>ipconfig</code> in Command Prompt).</li>
                        <li><strong>Linux:</strong> Settings → Network → connection details (or run <code>hostname -I</code> in a terminal).</li>
                      </ul>
                      <p style={{ margin: '6px 0 0' }}>It usually starts with <code>192.168.</code>, <code>10.</code> or <code>172.</code></p>
                    </details>
                  </div>
                )}
              </div>
              <div className="modal__footer">
                <button className="modal__btn modal__btn--cancel" onClick={() => setShareProjectId(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};
