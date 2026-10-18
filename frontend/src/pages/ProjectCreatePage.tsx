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
  // True for rows loaded from the backend (existing participants). Such rows must
  // be removed server-side, not just dropped from local form state.
  existing?: boolean;
}

const createBlankStudent = (): StudentRow => ({
  id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  maxAttempts: 1,
});

// The browser is on localhost/127.0.0.1 — a join link built from this host only
// works on the teacher's own machine, so students on other devices can't reach it.
const isLocalhostOrigin = (): boolean =>
  typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1|\[?::1\]?)$/.test(window.location.hostname);

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
  // Cap on how many students can be added to this simulation. "Add Student" is
  // bound to this value: once the row count reaches it, no more can be added.
  const [maxStudents, setMaxStudents] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinLinkCopied, setJoinLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { token } = useAuth();

  // Shareable student join link for the project being edited.
  const joinLink = editProjectId ? `${window.location.origin}/join/${editProjectId}` : '';

  const handleCopyJoinLink = () => {
    if (!joinLink) return;
    navigator.clipboard?.writeText(joinLink).catch(() => {});
    setJoinLinkCopied(true);
    window.setTimeout(() => setJoinLinkCopied(false), 2000);
  };

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
            existing: true,
          })));
          // Make sure the cap never starts below the number already enrolled,
          // otherwise the form would immediately flag existing students as over-limit.
          if (studentParticipants.length > 0) {
            setMaxStudents(prev => Math.max(prev, studentParticipants.length));
          }
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
    setStudents(current => {
      // Enforce the max-students cap: never add beyond it.
      if (current.length >= maxStudents) {
        setError(`You can add at most ${maxStudents} student${maxStudents === 1 ? '' : 's'}. Increase the maximum to add more.`);
        return current;
      }
      setError('');
      return [...current, createBlankStudent()];
    });
  };

  const handleRemoveStudent = async (id: string) => {
    const row = students.find(s => s.id === id);

    // Existing participant: remove it on the backend too, otherwise it stays
    // enrolled and reappears next time the project is edited.
    if (row?.existing && editProjectId && token) {
      try {
        const res = await fetch(`${API_URL}/projects/${editProjectId}/participants/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to remove student');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to remove student');
        return; // keep the row so the teacher knows it wasn't removed
      }
    }

    // Drop from the form. Keep at least one blank row in the create flow so the
    // form isn't empty; in edit mode it's fine to remove the last one.
    setStudents(current => {
      const next = current.filter(student => student.id !== id);
      return next.length === 0 && !isEdit ? [createBlankStudent()] : next;
    });
  };

  const handleStudentChange = (id: string, field: keyof Omit<StudentRow, 'id'>, value: string) => {
    setStudents(current => current.map(student => student.id === id ? { ...student, [field]: value } : student));
  };

  // Validate the student rows that will be created (new rows with a username).
  // Returns an error string to show the teacher, or null if everything is fine.
  const validateStudents = (): string | null => {
    // Total students (existing + new rows with a username) must not exceed the cap.
    const totalStudents = students.filter(s => s.existing || s.username.trim()).length;
    if (totalStudents > maxStudents) {
      return `This simulation allows at most ${maxStudents} student${maxStudents === 1 ? '' : 's'}, but ${totalStudents} are listed. Remove some or increase the maximum.`;
    }

    const newRows = students.filter(s => !s.existing && s.username.trim());
    const seen = new Set<string>();
    for (const row of newRows) {
      const uname = row.username.trim();
      // Usernames should not contain spaces (the login form sends them verbatim).
      if (/\s/.test(uname)) {
        return `Username "${uname}" cannot contain spaces.`;
      }
      const key = uname.toLowerCase();
      if (seen.has(key)) {
        return `Duplicate username "${uname}". Each student needs a unique username.`;
      }
      seen.add(key);
    }
    // A row with a password but no username is almost certainly a mistake.
    const orphanPassword = students.find(s => !s.existing && !s.username.trim() && s.password.trim());
    if (orphanPassword) {
      return 'A student row has a password but no username. Add a username or clear the row.';
    }
    return null;
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

    // Validate student credentials before hitting the backend.
    const studentError = validateStudents();
    if (studentError) {
      setError(studentError);
      setLoading(false);
      return;
    }

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

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || 'Failed to create simulation');
        }
        const project = await response.json();

        // Report any students that could not be created (e.g. duplicate
        // username) so the teacher can fix them, but don't block the project
        // itself, which was created successfully.
        const failed = (project.studentResults || []).filter((r: any) => !r.ok);
        if (failed.length > 0) {
          const detail = failed.map((f: any) => `${f.username} (${f.error})`).join(', ');
          alert(`Simulation created, but some students could not be added: ${detail}`);
        }

        navigate(`/projects/${project.id}/design`);
        return;
      }

      // Add new students if any (edit mode). Existing participants are read-only
      // and cannot be modified here, so we only create brand-new rows. Each new
      // student is created project-scoped (and enrolled) in a single call so the
      // project-scoped student login can resolve them.
      const newStudents = students.filter(s => s.username.trim() && !s.existing);
      const failedStudents: string[] = [];
      for (const student of newStudents) {
        const username = student.username.trim();
        try {
          const res = await fetch(`${API_URL}/projects/${editProjectId}/students`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              username,
              password: student.password || 'password123',
              maxAttempts: defaultMaxAttempts,
            }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            failedStudents.push(`${username} (${body.error || 'could not add'})`);
          }
        } catch (err: any) {
          failedStudents.push(`${username} (${err.message || 'network error'})`);
        }
      }

      if (failedStudents.length > 0) {
        alert(`Changes saved, but some students could not be added: ${failedStudents.join(', ')}`);
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
                  <span>
                    Student join link: <em>{window.location.origin}/join/&lt;id&gt;</em>
                    <small style={{ display: 'block', fontStyle: 'normal', color: '#64748b', marginTop: 2 }}>
                      The full link is generated once the simulation is created. You can copy it any time from the
                      simulation&apos;s menu on the dashboard.
                    </small>
                  </span>
                </div>

                {isLocalhostOrigin() && (
                  <div className="join-url-warning join-url-warning--tuck" role="note">
                    <strong>Heads up:</strong> you&apos;re viewing this on <code>localhost</code>, so a join link built
                    from this address only works on this computer. To let students join from another device on the same
                    Wi‑Fi, open the app using your computer&apos;s network address (e.g. <code>http://192.168.x.x:3000</code>)
                    — or edit the address when you copy the join link from the dashboard.
                  </div>
                )}

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
              <>
                <div className="create-field">
                  <span>Simulation ID</span>
                  <div className="edit-readonly-field">{simulationId}</div>
                </div>

                <div className="create-field">
                  <span>Student join link</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      readOnly
                      className="edit-readonly-field"
                      style={{ flex: 1 }}
                      value={joinLink}
                      onFocus={e => e.currentTarget.select()}
                    />
                    <button type="button" className="secondary-action" onClick={handleCopyJoinLink}>
                      {joinLinkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  {isLocalhostOrigin() && (
                    <div className="join-url-warning" role="note">
                      <strong>Heads up:</strong> this link uses <code>localhost</code>, so it only works on this
                      computer. To let students join from another device on the same Wi‑Fi, replace the host with your
                      computer&apos;s network address (e.g. <code>http://192.168.x.x:3000</code>). Both devices must be
                      on the same network.
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="create-divider" />

            <button className="primary-action" type="button" disabled={loading} onClick={handleNext}>
              {loading ? 'Processing...' : 'Next'}
            </button>
          </section>
        ) : (
          <section className="students-step" aria-label="Student accounts">
            <h2>Students</h2>

            <p className="students-help" style={{ fontSize: 13, color: '#64748b', marginTop: -4 }}>
              Students can access this simulation in two ways: open the <strong>join link</strong> (no account needed),
              or log in on the <strong>login page</strong> using the username and password you set below. Leave the
              password blank to use a default of <code>password123</code>.
            </p>

            <div className="universal-attempts">
              <label>Max attempts per student:</label>
              <input
                type="number"
                min={1}
                value={defaultMaxAttempts}
                onChange={e => setDefaultMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            <div className="universal-attempts">
              <label>Maximum number of students:</label>
              <input
                type="number"
                min={1}
                value={maxStudents}
                onChange={e => setMaxStudents(Math.max(1, parseInt(e.target.value) || 1))}
              />
            </div>

            {isEdit && students.length > 0 && (
              <p className="edit-existing-count">
                {students.length} existing student{students.length !== 1 ? 's' : ''}. Existing students can&apos;t be
                edited after creation — you can add new ones below or remove existing ones.
              </p>
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
                      disabled={student.existing}
                    />
                    <input
                      value={student.lastName}
                      onChange={(event) => handleStudentChange(student.id, 'lastName', event.target.value)}
                      aria-label="Last name"
                      disabled={student.existing}
                    />
                    <input
                      value={student.username}
                      onChange={(event) => handleStudentChange(student.id, 'username', event.target.value)}
                      aria-label="Username"
                      disabled={student.existing}
                    />
                    <input
                      value={student.password}
                      onChange={(event) => handleStudentChange(student.id, 'password', event.target.value)}
                      aria-label="Password"
                      type={student.existing ? 'text' : 'password'}
                      placeholder={student.existing ? '••••••' : ''}
                      disabled={student.existing}
                    />
                    <button
                      className="row-icon-button"
                      type="button"
                      title={student.existing ? 'Remove student' : 'Remove row'}
                      onClick={() => handleRemoveStudent(student.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              className="primary-action primary-action--inline"
              type="button"
              onClick={handleAddStudent}
              disabled={students.length >= maxStudents}
              title={students.length >= maxStudents ? `Maximum of ${maxStudents} students reached` : undefined}
            >
              <Plus size={17} />
              Add Student
            </button>
            <p className="students-count-hint" style={{ fontSize: 13, color: '#64748b', margin: '6px 0 0' }}>
              {students.length} of {maxStudents} student{maxStudents === 1 ? '' : 's'} added
              {students.length >= maxStudents && ' — maximum reached'}
            </p>

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
