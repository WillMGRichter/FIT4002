import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MoreVertical, PlusCircle, Search as SearchIcon, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell, ProjectBadge, StarButton } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import { addRecent, getStarredProjects, toggleStar } from '../utils/projectStorage';
import './Dashboard.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  visibility: string;
}

const badgeColors = ['#6f98f6', '#ff4d1f', '#ffc400', '#ffc400', '#6f98f6', '#ffc400', '#9b55f4', '#9b55f4'];

// Fallback mock projects shown only on API error (not empty results)
const mockProjects: Project[] = [
  { id: '1', name: 'Simulation 1', description: 'This is a test description for Simulation 1', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '2', name: 'Simulation 2', description: 'This is a test description for Simulation 2. This will be brief', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '3', name: 'Simulation 3', description: 'This is a test description for Simulation 3. This will be a bit longer and this will be cut off around here ...', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '4', name: 'Simulation 4', description: 'This is a test description for Simulation 4. This will be a bit longer and this will be cut off around here ...', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '5', name: 'Cafe Income Simulation', description: 'This is a test description for Cafe Income Simulation', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '6', name: 'Monash Business Simulation', description: 'Sed ut perspiciatis unde omnis iste natus error', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '7', name: 'Test Simulation', description: '', created_at: new Date().toISOString(), visibility: 'Public' },
  { id: '8', name: 'Test2 Simulation', description: '', created_at: new Date().toISOString(), visibility: 'Public' },
];

const mockStudentCounts: Record<string, number> = {
  '1': 5, '2': 3, '3': 1, '4': 1, '5': 5, '6': 1, '7': 2, '8': 2,
};

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

      const counts: Record<string, number> = {};
      await Promise.all(data.map(async (p: Project) => {
        try {
          const partRes = await fetch(`${API_URL}/projects/${p.id}/participants`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (partRes.ok) {
            const participants = await partRes.json();
            counts[p.id] = participants.filter((part: any) => part.role === 'student').length;
          }
        } catch { /* skip */ }
      }));
      setStudentCounts(counts);
    } catch (err: any) {
      setError(err.message);
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

  const isFallback = error && projects.length === 0;
  const visibleProjects = isFallback ? mockProjects : projects;

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

  const handleDelete = async () => {
    if (!deleteProjectId || !token) return;
    try {
      const res = await fetch(`${API_URL}/projects/${deleteProjectId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to delete');
      setDeleteProjectId(null);
      fetchProjects();
    } catch (err: any) {
      alert(err.message);
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
                const count = isFallback ? (mockStudentCounts[project.id] ?? 0) : (studentCounts[project.id] ?? 0);
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
      </div>
    </AppShell>
  );
};
