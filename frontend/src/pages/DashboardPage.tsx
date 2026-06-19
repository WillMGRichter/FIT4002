import React, { useCallback, useEffect, useState } from 'react';
import { PlusCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell, ProjectBadge, StarButton } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  visibility: string;
}

const badgeColors = ['#6f98f6', '#ff4d1f', '#ffc400', '#ffc400', '#6f98f6', '#ffc400', '#9b55f4', '#9b55f4'];
const memberCounts = [5, 3, 1, 1, 5, 1, 2, 2];

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

export const DashboardPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starred, setStarred] = useState<Set<string>>(new Set(['5', '6']));
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const fetchProjects = useCallback(async () => {
    if (!token) return;

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

  const visibleProjects = projects.length > 0 ? projects : mockProjects;

  const handleProjectClick = (projectId: string) => {
    navigate(`/projects/${projectId}/simulate`);
  };

  const toggleStar = (projectId: string, event: React.MouseEvent) => {
    event.stopPropagation();
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

  return (
    <AppShell title="Simulations" activeItem="home">
      <div className="dashboard-page">
        {loading ? (
          <div className="dashboard-state">Loading simulations...</div>
        ) : error ? (
          <div className="dashboard-state dashboard-state--error">{error}</div>
        ) : (
          <div className="dashboard-grid">
            {visibleProjects.map((project, index) => (
              <button
                key={project.id}
                className="simulation-card"
                onClick={() => handleProjectClick(project.id)}
              >
                <div className="simulation-card__top">
                  <ProjectBadge color={badgeColors[index % badgeColors.length]} />
                  <StarButton active={starred.has(project.id)} onClick={(event) => toggleStar(project.id, event)} />
                </div>
                <div className="simulation-card__body">
                  <h2>{project.name}</h2>
                  <p>{project.description}</p>
                </div>
                <div className="simulation-card__members">
                  {memberCounts[index % memberCounts.length]} {memberCounts[index % memberCounts.length] === 1 ? 'member' : 'members'}
                </div>
              </button>
            ))}

            <button className="simulation-card simulation-card--create" onClick={() => navigate('/projects/create')}>
              <PlusCircle size={43} strokeWidth={2.3} />
              <span>Create New Simulation</span>
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
};
