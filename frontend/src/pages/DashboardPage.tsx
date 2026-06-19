import React, { useState, useEffect } from 'react';
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

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchProjects();
  }, [token, navigate]);

  const fetchProjects = async () => {
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
  };

  const handleCreateProject = () => {
    navigate('/projects/create');
  };

  const handleProjectClick = (projectId: string) => {
    if (user?.role === 'student') {
      navigate(`/projects/${projectId}/simulate`);
    } else {
      // For now, teachers also see the simulation
      // In future, we'd show project edit/management page
      navigate(`/projects/${projectId}/simulate`);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>SmartSim</h1>
        <div className="header-right">
          <span>Welcome, {user?.username}!</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="section-header">
            <h2>{user?.role === 'student' ? 'My Simulations' : 'My Projects'}</h2>
            {user?.role === 'teacher' && (
              <button onClick={handleCreateProject} className="btn-primary">
                + Create New Project
              </button>
            )}
          </div>

          {loading && <p className="loading">Loading projects...</p>}
          {error && <p className="error">{error}</p>}

          {!loading && projects.length === 0 && (
            <div className="empty-state">
              <p>
                {user?.role === 'student'
                  ? 'You have no simulations assigned yet.'
                  : 'You have no projects yet. Create one to get started!'}
              </p>
            </div>
          )}

          {!loading && projects.length > 0 && (
            <div className="projects-grid">
              {projects.map((project) => (
                <div key={project.id} className="project-card" onClick={() => handleProjectClick(project.id)}>
                  <h3>{project.name}</h3>
                  {project.description && <p>{project.description}</p>}
                  <div className="project-meta">
                    <span className="visibility">{project.visibility}</span>
                    <span className="date">{new Date(project.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
