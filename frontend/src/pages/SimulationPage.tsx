import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './SimulationPage.css';

interface Project {
  id: string;
  name: string;
  description?: string;
  excel_data?: any;
}

interface SimulationState {
  [key: string]: any;
}

export const SimulationPage: React.FC = () => {
  const { projectId } = useParams();
  const [project, setProject] = useState<Project | null>(null);
  const [simulationState, setSimulationState] = useState<SimulationState>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { token, user } = useAuth();

  useEffect(() => {
    if (!projectId || !token) return;

    const fetchProject = async () => {
      try {
        const response = await fetch(`http://localhost:5000/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error('Failed to load project');
        const data = await response.json();
        setProject(data);

        // Load saved progress
        const progressResponse = await fetch(
          `http://localhost:5000/simulations/${projectId}/progress`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (progressResponse.ok) {
          const progress = await progressResponse.json();
          setSimulationState(progress?.state || {});
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId, token]);

  const handleInputChange = (key: string, value: any) => {
    setSimulationState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveProgress = async () => {
    if (!projectId || !token) return;

    setSaving(true);
    try {
      const response = await fetch(`http://localhost:5000/simulations/${projectId}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ state: simulationState }),
      });

      if (!response.ok) throw new Error('Failed to save progress');
      alert('Progress saved successfully!');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteSimulation = async () => {
    if (!projectId || !token) return;

    if (!window.confirm('Are you sure you want to submit this simulation?')) return;

    setSaving(true);
    try {
      const response = await fetch(`http://localhost:5000/simulations/${projectId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ finalState: simulationState }),
      });

      if (!response.ok) throw new Error('Failed to submit simulation');

      alert('Simulation submitted successfully!');
      navigate('/dashboard');
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Reset all inputs to default values?')) {
      setSimulationState({});
    }
  };

  if (loading) return <div className="loading-container">Loading simulation...</div>;
  if (error) return <div className="error-container">{error}</div>;
  if (!project) return <div className="error-container">Project not found</div>;

  return (
    <div className="simulation-container">
      <div className="simulation-header">
        <button onClick={() => navigate('/dashboard')} className="back-btn">
          ← Back
        </button>
        <h1>{project.name}</h1>
        <span className="user-info">{user?.username}</span>
      </div>

      <div className="simulation-content">
        <div className="simulation-box">
          <h2>Simulation Interface</h2>
          {project.description && <p className="description">{project.description}</p>}

          <div className="simulation-body">
            {project.excel_data && project.excel_data.length > 0 ? (
              <div className="excel-display">
                <h3>Model Inputs & Outputs</h3>
                {project.excel_data.map((sheet: any, sheetIdx: number) => (
                  <div key={sheetIdx} className="sheet-section">
                    <h4>{sheet.sheet}</h4>
                    {sheet.formulas && sheet.formulas.length > 0 ? (
                      <div className="formulas-list">
                        {sheet.formulas.map((formula: any, idx: number) => (
                          <div key={idx} className="formula-item">
                            <label>{formula.cell}</label>
                            <input
                              type="number"
                              value={simulationState[formula.cell] || ''}
                              onChange={(e) => handleInputChange(formula.cell, e.target.value)}
                              placeholder="Enter value"
                            />
                            <code>{formula.formula}</code>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-data">No formula data available for this sheet.</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-data">No Excel data available. Please ensure a file was uploaded.</p>
            )}

            <div className="state-display">
              <h3>Current State</h3>
              <pre>{JSON.stringify(simulationState, null, 2)}</pre>
            </div>
          </div>

          <div className="simulation-actions">
            <button onClick={handleReset} className="btn-secondary" disabled={saving}>
              Reset Inputs
            </button>
            <button onClick={handleSaveProgress} className="btn-save" disabled={saving}>
              {saving ? 'Saving...' : 'Save Progress'}
            </button>
            <button
              onClick={handleCompleteSimulation}
              className="btn-submit"
              disabled={saving}
            >
              {saving ? 'Submitting...' : 'Submit Simulation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
