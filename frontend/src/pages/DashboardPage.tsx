import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  visibility: string;
}

const colors = ['#3B82F6', '#EF4444', '#FBBF24', '#A78BFA', '#10B981'];

const getColorForIndex = (index: number) => colors[index % colors.length];

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 1);
};

const SidebarLink: React.FC<{ icon: string; label: string; onClick: () => void; active?: boolean }> = ({ icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      width: '100%',
      padding: '0.75rem 1rem',
      border: 'none',
      background: active ? '#dcfce7' : 'transparent',
      color: active ? '#16a34a' : '#666',
      cursor: 'pointer',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      fontWeight: active ? 600 : 400,
      transition: 'all 0.2s',
    }}
  >
    <span style={{ fontSize: '1.25rem' }}>{icon}</span>
    {label}
  </button>
);

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [currentView, setCurrentView] = useState<'home' | 'create' | 'recent'>('home');
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      const endpoint =
        user?.role === 'student'
          ? 'http://localhost:5000/projects/student/projects'
          : 'http://localhost:5000/projects/teacher/projects';

      const response = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch projects');
      const data = await response.json();
      setProjects(data);
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

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  const handleProjectClick = (projectId: string) => {
    if (user?.role === 'student') {
      navigate(`/projects/${projectId}/simulate`);
    } else {
      navigate(`/projects/${projectId}/simulate`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleStar = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setStarred(prev => {
      const newStarred = new Set(prev);
      if (newStarred.has(projectId)) {
        newStarred.delete(projectId);
      } else {
        newStarred.add(projectId);
      }
      return newStarred;
    });
  };

  // Mock data for demonstration
  const mockProjects: Project[] = projects.length === 0 ? [
    { id: '1', name: 'Simulation 1', description: 'This is a test description for Simulation 1', created_at: new Date().toISOString(), visibility: 'Public' },
    { id: '2', name: 'Simulation 2', description: 'This is a test description for Simulation 2. This will be brief', created_at: new Date().toISOString(), visibility: 'Public' },
    { id: '3', name: 'Simulation 3', description: 'This is a test description for Simulation 3. This will be a bit longer and this will be cut off around here ...', created_at: new Date().toISOString(), visibility: 'Public' },
    { id: '4', name: 'Simulation 4', description: 'This is a test description for Simulation 4. This will be a bit longer and this will be cut off around here ...', created_at: new Date().toISOString(), visibility: 'Public' },
    { id: '5', name: 'Cafe Income Simulation', description: 'This is a test description for Cafe Income Simulation', created_at: new Date().toISOString(), visibility: 'Public' },
    { id: '6', name: 'Monash Business Simulation', description: 'Sed ut perspiciatis unde omnis iste natus error', created_at: new Date().toISOString(), visibility: 'Public' },
  ] : projects;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#fafafa' }}>
      {/* Sidebar */}
      <aside style={{ width: '180px', background: '#f5f5f5', borderRight: '1px solid #e5e7eb', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        {/* User Info */}
        <div style={{ padding: '0 1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#666', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
              {getInitials(user?.username || 'U')}
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{user?.username}</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 1rem', marginBottom: '2rem' }}>
          <input type="text" placeholder="Search" style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #ddd', borderRadius: '0.5rem', fontSize: '0.875rem' }} />
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.5rem' }}>
          <div style={{ padding: '0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>Home</div>
          <SidebarLink icon="🏠" label="Home" onClick={() => setCurrentView('home')} active={currentView === 'home'} />
          <SidebarLink icon="➕" label="Create" onClick={() => setCurrentView('create')} active={currentView === 'create'} />

          <div style={{ padding: '1rem 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>Starred</div>
          <SidebarLink icon="⭐" label="Cafe Income Simulation" onClick={() => {}} />

          <div style={{ padding: '1rem 0.5rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, color: '#999', textTransform: 'uppercase' }}>Recent</div>
          <SidebarLink icon="📌" label="Cafe Income Simulation" onClick={() => {}} />
          <SidebarLink icon="📌" label="Monash Business Simulation" onClick={() => {}} />
          <SidebarLink icon="📌" label="Simulation 1" onClick={() => {}} />
        </nav>

        {/* Bottom */}
        <div style={{ borderTop: '1px solid #e5e7eb', padding: '1rem 0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <SidebarLink icon="🏢" label="Organisation" onClick={() => navigate('/org-management')} />
          <SidebarLink icon="⚙️" label="Manage Organisation" onClick={() => navigate('/org-management')} />
          <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', color: '#ef4444', fontSize: '0.875rem', textAlign: 'left' }}>
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, overflow: 'auto', padding: '2rem' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.875rem', fontWeight: 700 }}>Simulations</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => setCurrentView('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>⚙️</button>
            <button onClick={() => setCurrentView('home')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>🌙</button>
            <button onClick={handleCreateProject} style={{ background: '#16a34a', color: 'white', border: 'none', padding: '0.75rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
              + New Team
            </button>
          </div>
        </div>

        {/* Content Area */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Loading simulations...</div>
        ) : error ? (
          <div style={{ color: '#ef4444', textAlign: 'center', padding: '2rem' }}>{error}</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {mockProjects.map((project, index) => (
              <div
                key={project.id}
                onClick={() => handleProjectClick(project.id)}
                style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '0.75rem',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                {/* Avatar Bar */}
                <div style={{ height: '80px', background: getColorForIndex(index), display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '0.5rem', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: '1.5rem' }}>
                    {getInitials(project.name)}
                  </div>
                  <button
                    onClick={(e) => toggleStar(project.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '1.5rem',
                      color: starred.has(project.id) ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                    }}
                  >
                    ★
                  </button>
                </div>

                {/* Content */}
                <div style={{ padding: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem', fontWeight: 600, color: '#111' }}>{project.name}</h3>
                  <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {project.description}
                  </p>
                  <div style={{ fontSize: '0.875rem', color: '#999' }}>5 members</div>
                </div>
              </div>
            ))}

            {/* Create New Card */}
            <div
              onClick={handleCreateProject}
              style={{
                background: 'white',
                border: '2px dashed #d1d5db',
                borderRadius: '0.75rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                minHeight: '200px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#16a34a';
                (e.currentTarget as HTMLElement).style.background = '#f0fdf4';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#d1d5db';
                (e.currentTarget as HTMLElement).style.background = 'white';
              }}
            >
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>➕</div>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111' }}>Create New Simulation</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
