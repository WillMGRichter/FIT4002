import React, { useEffect, useRef, useState } from 'react';
import { Link2, Plus, Trash2, Upload } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import './ProjectCreate.css';

interface StudentRow {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  password: string;
  maxAttempts: number;
}

const createBlankStudent = (): StudentRow => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  maxAttempts: 1,
});

export const ProjectCreatePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const editProjectId = searchParams.get('edit');
  const isEdit = !!editProjectId;

  const [step, setStep] = useState<'form' | 'students'>('form');
  const [simulationTitle, setSimulationTitle] = useState('');
  const [simulationId, setSimulationId] = useState('');
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [defaultMaxAttempts, setDefaultMaxAttempts] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { user, token } = useAuth();

  // Fetch existing project data when in edit mode
  useEffect(() => {
    if (!editProjectId || !token) return;
    (async () => {
      try {
        const [projRes, partRes] = await Promise.all([
          fetch(`${API_URL}/projects/${editProjectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_URL}/projects/${editProjectId}/participants/with-usernames`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (projRes.ok) {
          const project = await projRes.json();
          setSimulationTitle(project.name || '');
          setSimulationId(project.id || '');
          if (project.default_max_attempts) setDefaultMaxAttempts(project.default_max_attempts);
        }
        if (partRes.ok) {
          const participants = await partRes.json();
          const studentParticipants = participants.filter((p: any) => p.role === 'student');
          setStudents(studentParticipants.map((p: any) => ({
            id: p.user_id,
            firstName: '',
            lastName: '',
            username: p.username || '',
            password: '',
            maxAttempts: p.max_attempts || 1,
          })));
        }
      } catch { /* ignore */ }
    })();
  }, [editProjectId, token]);

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
    if (!simulationTitle) {
      setError('Please fill in all required fields');
      return;
    }
    if (!isEdit && !excelFile) {
      setError('Please upload a simulation file');
      return;
    }

    setError('');
    setStep('students');
  };

  const handleCreateSimulation = async () => {
    if (!simulationTitle) {
      setError('Please fill in all required fields');
      setStep('form');
      return;
    }
    if (!isEdit && !excelFile) {
      setError('Please upload a simulation file');
      setStep('form');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (isEdit) {
        const res = await fetch(`${API_URL}/projects/${editProjectId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: simulationTitle, default_max_attempts: defaultMaxAttempts }),
        });
        if (!res.ok) throw new Error('Failed to update simulation');
      } else {
        const formData = new FormData();
        formData.append('file', excelFile!);
        formData.append('title', simulationTitle);
        formData.append('id', simulationId || simulationTitle);
        formData.append('students', JSON.stringify(students.filter(student => student.username).map(s => ({ ...s, maxAttempts: defaultMaxAttempts }))));
        formData.append('defaultMaxAttempts', String(defaultMaxAttempts));

        const response = await fetch(`${API_URL}/projects`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!response.ok) throw new Error('Failed to create simulation');
        const project = await response.json();
        navigate(`/projects/${project.id}/design`);
        return;
      }

      // Add new students if any (edit mode)
      const newStudents = students.filter(s => s.username);
      for (const student of newStudents) {
        try {
          const signupRes = await fetch(`${API_URL}/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              username: student.username,
              password: student.password || 'password123',
              role: 'student',
              organisationId: user?.organisation_id,
            }),
          });
          if (!signupRes.ok) continue;
          const { user: newUser } = await signupRes.json();
          await fetch(`${API_URL}/projects/${editProjectId}/participants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ userId: newUser.id, role: 'student', maxAttempts: defaultMaxAttempts }),
          });
        } catch { /* skip individual failures */ }
      }

      navigate(`/projects/${editProjectId}/design`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Simulations" activeItem="create">
      <div className="create-simulation-page">
        <h1>{isEdit ? 'Edit Simulation' : 'Create New Simulation'}</h1>

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

            {!isEdit && (
              <>
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
                  <span>Simulation URL: <em>{window.location.origin}/projects/</em></span>
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
              </>
            )}

            {isEdit && (
              <div className="create-field">
                <span>Simulation ID</span>
                <div className="edit-readonly-field">{simulationId}</div>
              </div>
            )}

            <div className="create-divider" />

            <button className="primary-action" type="button" disabled={loading} onClick={handleNext}>
              {loading ? 'Processing...' : 'Next'}
            </button>
          </section>
        ) : (
          <section className="students-step" aria-label="Student accounts">
            <h2>Students</h2>

            <div className="universal-attempts">
              <label>Max attempts per student:</label>
              <input
                type="number"
                min={1}
                value={defaultMaxAttempts}
                onChange={e => setDefaultMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            {isEdit && students.length > 0 && (
              <p className="edit-existing-count">{students.length} existing student{students.length !== 1 ? 's' : ''} (you can add more below)</p>
            )}

            {students.length > 0 && (
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
            )}

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
                {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Simulation'}
              </button>
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
};
