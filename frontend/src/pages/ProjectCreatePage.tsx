import React, { useRef, useState } from 'react';
import { Link2, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import './ProjectCreate.css';

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
}

const createBlankStudent = (): StudentRow => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
  firstName: '',
  lastName: '',
  username: '',
  password: '',
});

export const ProjectCreatePage: React.FC = () => {
  const [step, setStep] = useState<'form' | 'students'>('form');
  const [simulationTitle, setSimulationTitle] = useState('');
  const [simulationId, setSimulationId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
    createBlankStudent(),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setExcelFile(event.target.files[0]);
      setError('');
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files?.[0]) {
      setExcelFile(event.dataTransfer.files[0]);
      setError('');
    }
  };

  const handleAddStudent = () => {
    setStudents(current => [...current, createBlankStudent()]);
  };

  const handleRemoveStudent = (id: string) => {
    setStudents(current => current.length === 1 ? current : current.filter(student => student.id !== id));
  };

  const handleStudentChange = (id: string, field: keyof Omit<StudentRow, 'id'>, value: string) => {
    setStudents(current => current.map(student => student.id === id ? { ...student, [field]: value } : student));
  };

  const handleNext = () => {
    if (!simulationTitle || !excelFile) {
      setError('Please fill in all required fields');
      return;
    }

    setError('');
    setStep('students');
  };

  const handleCreateSimulation = async () => {
    if (!simulationTitle || !excelFile) {
      setError('Please fill in all required fields');
      setStep('form');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      formData.append('title', simulationTitle);
      formData.append('id', simulationId || simulationTitle);
      formData.append('students', JSON.stringify(students.filter(student => student.username)));

      const response = await fetch('http://localhost:5000/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to create simulation');
      await response.json();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Simulations" activeItem="create">
      <div className="create-simulation-page">
        <h1>Create New Simulation</h1>

        {error && <div className="create-error">{error}</div>}

        {step === 'form' ? (
          <section className="create-form" aria-label="Simulation details">
            <label className="create-field">
              <span>
                Simulation Title<span className="required">*</span>
              </span>
              <input
                autoFocus
                type="text"
                value={simulationTitle}
                onChange={(event) => setSimulationTitle(event.target.value)}
                placeholder="Text"
              />
            </label>

            <label className="create-field">
              <span>
                Simulation ID<span className="required">*</span>
              </span>
              <input
                type="text"
                value={simulationId}
                onChange={(event) => setSimulationId(event.target.value)}
                placeholder="Text"
              />
            </label>
            <div className="simulation-url">
              <Link2 size={18} />
              <span>Simulation URL: <em>https://smartsimulations.com/organisation/</em></span>
            </div>

            <div className="create-field">
              <span>
                Simulation File<span className="required">*</span>
              </span>
              <button
                type="button"
                className="upload-dropzone"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <Upload size={25} strokeWidth={1.7} />
                <span>Drag &amp; Drop or <strong>Choose file</strong> to upload</span>
                <small>{excelFile ? excelFile.name : '.xlsx'}</small>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                hidden
              />
            </div>

            <div className="create-divider" />

            <button className="primary-action" type="button" disabled={loading} onClick={handleNext}>
              {loading ? 'Processing...' : 'Next'}
            </button>
          </section>
        ) : (
          <section className="students-step" aria-label="Student accounts">
            <h2>Students</h2>
            <div className="students-table" role="table">
              <div className="students-row students-row--head" role="row">
                <div className="students-check" />
                <div>First Name</div>
                <div>Last Name</div>
                <div>Username</div>
                <div>Password</div>
                <div />
              </div>
              {students.map((student, index) => (
                <div className="students-row" role="row" key={student.id}>
                  <label className="students-check">
                    <input type="checkbox" aria-label={`Select student row ${index + 1}`} />
                    <span />
                  </label>
                  <input
                    value={student.firstName}
                    onChange={(event) => handleStudentChange(student.id, 'firstName', event.target.value)}
                    aria-label="First name"
                  />
                  <input
                    value={student.lastName}
                    onChange={(event) => handleStudentChange(student.id, 'lastName', event.target.value)}
                    aria-label="Last name"
                  />
                  <input
                    value={student.username}
                    onChange={(event) => handleStudentChange(student.id, 'username', event.target.value)}
                    aria-label="Username"
                  />
                  <input
                    value={student.password}
                    onChange={(event) => handleStudentChange(student.id, 'password', event.target.value)}
                    aria-label="Password"
                  />
                  <button
                    className="row-icon-button"
                    type="button"
                    title="Remove student"
                    onClick={() => handleRemoveStudent(student.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <button className="primary-action primary-action--inline" type="button" onClick={handleAddStudent}>
              <Plus size={17} />
              Add Student
            </button>

            <div className="create-divider create-divider--students" />

            <div className="create-actions">
              <button className="secondary-action" type="button" onClick={() => setStep('form')}>
                Back
              </button>
              <button className="primary-action" type="button" disabled={loading} onClick={handleCreateSimulation}>
                {loading ? 'Creating...' : 'Create Simulation'}
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
};
