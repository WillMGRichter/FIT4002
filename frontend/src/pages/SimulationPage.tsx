import React, { useEffect, useState } from 'react';
import {
  BarChart3,
  Circle,
  Diamond,
  Moon,
  MousePointer2,
  PieChart,
  Redo2,
  Save,
  Share,
  SquareRoundCorner,
  TrendingUp,
  Type,
  Undo2,
  Upload,
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import './SimulationPage.css';

interface Project {
  id: string;
  name: string;
  description?: string;
}

const paletteInputs = [
  { label: 'Circle input', icon: <Circle size={52} strokeWidth={1.2} /> },
  { label: 'Decision input', icon: <Diamond size={48} strokeWidth={1.2} /> },
  { label: 'Rounded input', icon: <SquareRoundCorner size={50} strokeWidth={1.2} /> },
];

const paletteOutputs = [
  { label: 'Bar chart', icon: <BarChart3 size={48} strokeWidth={2.2} /> },
  { label: 'Horizontal bars', icon: <BarChart3 size={48} strokeWidth={2.2} className="rotate-icon" /> },
  { label: 'Pie chart', icon: <PieChart size={48} strokeWidth={2.2} /> },
  { label: 'Trend line', icon: <TrendingUp size={48} strokeWidth={2.2} /> },
];

export const SimulationPage: React.FC = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { token } = useAuth();

  useEffect(() => {
    if (!projectId || !token) return;

    const fetchProject = async () => {
      try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to load project');
        const data = await response.json();
        setProject(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, token]);

  const title = project?.name || 'Cafe Simulation';

  return (
    <AppShell
      title={title}
      activeItem="project"
      showBack
      compactSidebar
      onBack={() => navigate('/dashboard')}
    >
      {loading ? (
        <div className="simulation-state">Loading simulation...</div>
      ) : error ? (
        <div className="simulation-state simulation-state--error">{error}</div>
      ) : (
        <div className="simulation-panel">
          <aside className="simulation-palette">
            <div className="simulation-palette__section">
              <h2>Inputs</h2>
              <div className="simulation-palette__stack">
                {paletteInputs.map(item => (
                  <button key={item.label} className="simulation-shape" title={item.label}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="simulation-palette__section">
              <h2>Outputs</h2>
              <div className="simulation-palette__grid">
                {paletteOutputs.map(item => (
                  <button key={item.label} className="simulation-shape" title={item.label}>
                    {item.icon}
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <section className="simulation-canvas-wrap">
            <div className="simulation-toolbar">
              <button title="Undo"><Undo2 size={22} /></button>
              <button title="Redo"><Redo2 size={22} /></button>
              <span />
              <button title="Save"><Save size={27} /></button>
              <button title="Upload"><Upload size={27} /></button>
              <button title="Dark mode" className="simulation-toolbar__end"><Moon size={24} /></button>
            </div>

            <div className="simulation-canvas">
              <div className="floating-tools">
                <button className="is-active" title="Select"><MousePointer2 size={22} /></button>
                <button title="Grid"><span className="grid-tool" /></button>
                <button title="Shape"><SquareRoundCorner size={21} /></button>
                <button title="Draw"><Share size={21} /></button>
                <button title="Text"><Type size={24} /></button>
                <button title="Circle"><Circle size={22} /></button>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
};
