import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './ProjectCreate.css';

export const ProjectCreatePage: React.FC = () => {
  const [step, setStep] = useState<'form' | 'students'>('form');
  const [simulationTitle, setSimulationTitle] = useState('');
  const [simulationId, setSimulationId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [students, setStudents] = useState<Array<{ id: string; firstName: string; lastName: string; username: string; password: string }>>([
    { id: '1', firstName: '', lastName: '', username: '', password: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setExcelFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files?.[0]) {
      setExcelFile(e.dataTransfer.files[0]);
    }
  };

  const handleAddStudent = () => {
    setStudents([...students, { id: Date.now().toString(), firstName: '', lastName: '', username: '', password: '' }]);
  };

  const handleRemoveStudent = (id: string) => {
    setStudents(students.filter(s => s.id !== id));
  };

  const handleStudentChange = (id: string, field: string, value: string) => {
    setStudents(students.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleNext = async () => {
    if (!simulationTitle || !excelFile) {
      setError('Please fill in all required fields');
      return;
    }
    setStep('students');
  };

  const handleCreateSimulation = async () => {
    if (!simulationTitle || !excelFile) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('title', simulationTitle);
      formData.append('id', simulationId || simulationTitle);
      formData.append('students', JSON.stringify(students.filter(s => s.username)));

      const response = await fetch('http://localhost:5000/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create simulation');
      const project = await response.json();
      navigate(`/dashboard`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const baseStyles = {
    container: {
      display: 'flex',
      height: '100vh',
      background: '#1a1a1a',
    },
    sidebar: {
      width: '180px',
      background: '#0f0f0f',
      borderRight: '1px solid #333',
      padding: '1.5rem 0',
      display: 'flex',
      flexDirection: 'column' as const,
    },
    main: {
      flex: 1,
      padding: '2rem',
      color: '#fff',
      overflow: 'auto',
    },
    header: {
      marginBottom: '2rem',
    },
    title: {
      fontSize: '1.875rem',
      fontWeight: 700,
      margin: 0,
      marginBottom: '0.5rem',
    },
    formContainer: {
      maxWidth: '800px',
    },
    formGroup: {
      marginBottom: '1.5rem',
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: 600,
      marginBottom: '0.5rem',
      color: '#fff',
    },
    required: {
      color: '#ef4444',
    },
    input: {
      width: '100%',
      padding: '0.75rem',
      border: '1px solid #444',
      borderRadius: '0.375rem',
      background: '#fff',
      color: '#000',
      fontSize: '0.875rem',
    },
    uploadArea: {
      border: '2px dashed #16a34a',
      borderRadius: '0.5rem',
      padding: '2rem',
      textAlign: 'center' as const,
      cursor: 'pointer',
      background: '#1a3a1a',
      color: '#16a34a',
    },
    button: {
      padding: '0.75rem 1.5rem',
      borderRadius: '0.375rem',
      border: 'none',
      fontWeight: 600,
      cursor: 'pointer',
      fontSize: '0.875rem',
    },
    buttonPrimary: {
      background: '#16a34a',
      color: 'white',
    },
    table: {
      width: '100%',
      borderCollapse: 'collapse' as const,
    },
  };

  if (step === 'form') {
    return (
      <div style={baseStyles.container as React.CSSProperties}>
        {/* Sidebar */}
        <aside style={baseStyles.sidebar as React.CSSProperties}>
          <div style={{ padding: '0 1rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#666', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
                BS
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>Ben Stern</span>
            </div>
          </div>

          <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.5rem', color: '#999' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', color: '#16a34a' }}>📌 Simulations</button>
          </nav>

          <div style={{ borderTop: '1px solid #333', padding: '1rem 0.5rem', color: '#999' }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', width: '100%' }}>
              🏢 Organisation
            </button>
          </div>
        </aside>

        {/* Main */}
        <main style={baseStyles.main as React.CSSProperties}>
          <div style={baseStyles.header as React.CSSProperties}>
            <h1 style={baseStyles.title as React.CSSProperties}>Create New Simulation</h1>
          </div>

          {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>{error}</div>}

          <div style={baseStyles.formContainer as React.CSSProperties}>
            <div style={baseStyles.formGroup as React.CSSProperties}>
              <label style={baseStyles.label as React.CSSProperties}>
                Simulation Title
                <span style={baseStyles.required as React.CSSProperties}> *</span>
              </label>
              <input
                type="text"
                value={simulationTitle}
                onChange={(e) => setSimulationTitle(e.target.value)}
                placeholder="Text"
                style={baseStyles.input as React.CSSProperties}
              />
            </div>

            <div style={baseStyles.formGroup as React.CSSProperties}>
              <label style={baseStyles.label as React.CSSProperties}>
                Simulation ID
                <span style={baseStyles.required as React.CSSProperties}> *</span>
              </label>
              <input
                type="text"
                value={simulationId}
                onChange={(e) => setSimulationId(e.target.value)}
                placeholder="Text"
                style={baseStyles.input as React.CSSProperties}
              />
              <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.5rem' }}>
                🔗 Simulation URL: https://smartsimulations.com/organisation/
              </div>
            </div>

            <div style={baseStyles.formGroup as React.CSSProperties}>
              <label style={baseStyles.label as React.CSSProperties}>
                Simulation File
                <span style={baseStyles.required as React.CSSProperties}> *</span>
              </label>
              <div
                style={baseStyles.uploadArea as React.CSSProperties}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📤</div>
                <div>Drag & Drop or <span style={{ color: '#16a34a', fontWeight: 600, cursor: 'pointer' }}>Choose file</span> to upload</div>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', marginTop: '0.5rem' }}>.xlsx</div>
                {excelFile && <div style={{ marginTop: '1rem', color: '#16a34a' }}>Selected: {excelFile.name}</div>}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '2rem' }}>
              <button
                onClick={handleNext}
                disabled={loading}
                style={{
                  ...baseStyles.button,
                  ...baseStyles.buttonPrimary,
                } as React.CSSProperties}
              >
                {loading ? 'Processing...' : 'Next'}
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={baseStyles.container as React.CSSProperties}>
      {/* Sidebar - same as above */}
      <aside style={baseStyles.sidebar as React.CSSProperties}>
        <div style={{ padding: '0 1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#666', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 600 }}>
              BS
            </div>
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff' }}>Ben Stern</span>
          </div>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.5rem', color: '#999' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', color: '#16a34a' }}>📌 Simulations</button>
        </nav>

        <div style={{ borderTop: '1px solid #333', padding: '1rem 0.5rem', color: '#999' }}>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.875rem', width: '100%' }}>
            🏢 Organisation
          </button>
        </div>
      </aside>

      {/* Main - Students Step */}
      <main style={baseStyles.main as React.CSSProperties}>
        <div style={baseStyles.header as React.CSSProperties}>
          <h1 style={baseStyles.title as React.CSSProperties}>Create New Simulation</h1>
        </div>

        <div style={baseStyles.formContainer as React.CSSProperties}>
          <div style={baseStyles.formGroup as React.CSSProperties}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.125rem', fontWeight: 600 }}>Students</h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={baseStyles.table as React.CSSProperties}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #444' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}></th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>First Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>Last Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>Username</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 600, fontSize: '0.875rem' }}>Password</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student, index) => (
                    <tr key={student.id} style={{ borderBottom: '1px solid #333', background: index % 2 === 0 ? '#f5f5f5' : '#fff', color: '#000' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <input type="checkbox" />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          value={student.firstName}
                          onChange={(e) => handleStudentChange(student.id, 'firstName', e.target.value)}
                          placeholder="First Name"
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          value={student.lastName}
                          onChange={(e) => handleStudentChange(student.id, 'lastName', e.target.value)}
                          placeholder="Last Name"
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          value={student.username}
                          onChange={(e) => handleStudentChange(student.id, 'username', e.target.value)}
                          placeholder="Username"
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <input
                          type="text"
                          value={student.password}
                          onChange={(e) => handleStudentChange(student.id, 'password', e.target.value)}
                          placeholder="Password"
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '0.875rem' }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              onClick={handleAddStudent}
              style={{
                ...baseStyles.button,
                background: '#16a34a',
                color: 'white',
                marginTop: '1rem',
              } as React.CSSProperties}
            >
              + Add Student
            </button>
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}>
            <button
              onClick={() => setStep('form')}
              style={{
                ...baseStyles.button,
                background: '#444',
                color: '#fff',
              } as React.CSSProperties}
            >
              Back
            </button>
            <button
              onClick={handleCreateSimulation}
              disabled={loading}
              style={{
                ...baseStyles.button,
                ...baseStyles.buttonPrimary,
              } as React.CSSProperties}
            >
              {loading ? 'Creating...' : 'Create Simulation'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
