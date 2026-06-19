import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ProjectCreate.css';

export const ProjectCreatePage: React.FC = () => {
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [excelData, setExcelData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleExcelChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFile(file);
    setError('');

    // Parse excel file
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:5000/excel/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to parse Excel file');

      const data = await response.json();
      setExcelData(data);
    } catch (err: any) {
      setError(`Error parsing Excel: ${err.message}`);
      setExcelFile(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!projectName) {
      setError('Project name is required');
      return;
    }

    if (!excelFile) {
      setError('Excel file is required');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectName,
          description,
          excelData,
        }),
      });

      if (!response.ok) throw new Error('Failed to create project');

      const project = await response.json();
      navigate(`/projects/${project.id}/edit`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="project-create-container">
      <div className="project-create-box">
        <h1>Create New Simulation Project</h1>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Enter project name"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your simulation project"
              disabled={loading}
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Excel Spreadsheet *</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleExcelChange}
              disabled={loading}
            />
            {excelFile && (
              <div className="file-info">
                ✓ File selected: {excelFile.name}
              </div>
            )}
          </div>

          {excelData && (
            <div className="excel-preview">
              <h3>Excel File Preview</h3>
              <div className="sheets-info">
                {excelData.map((sheet: any, idx: number) => (
                  <div key={idx} className="sheet-item">
                    <strong>Sheet: {sheet.sheet}</strong>
                    <p>{sheet.formulas.length} formulas found</p>
                    {sheet.formulas.length > 0 && (
                      <ul>
                        {sheet.formulas.slice(0, 5).map((formula: any, i: number) => (
                          <li key={i}>
                            {formula.cell}: {formula.formula.substring(0, 50)}...
                          </li>
                        ))}
                        {sheet.formulas.length > 5 && <li>... and {sheet.formulas.length - 5} more</li>}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Project'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
