import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../config';
import { StudentSimulationView } from './StudentSimulationView';
import styles from './JoinSimulation.module.css';

/**
 * Entry point for the shareable student link (/join/:projectId).
 *
 * Credential-only join: students sign in with the username and password their
 * teacher/admin assigned them. The page deliberately does NOT read or reuse any
 * app-wide auth session (AuthContext) - it logs in directly against the API and
 * keeps the resulting token in local state, then hands it to the simulation view
 * as an explicit prop. This guarantees the join flow always uses the exact
 * student that just signed in, never a stale/other session (e.g. a teacher who
 * happened to be logged in on the same browser), which previously caused a
 * misleading "Not a participant of this project" error.
 */
export const JoinSimulation: React.FC = () => {
  const { projectId } = useParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  // The fresh student session from the login response. While null we show the
  // sign-in form; once set we render the simulation using exactly this session.
  const [session, setSession] = useState<{ token: string; userId: string | null } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;

    const uname = username.trim();
    if (!uname) { setError('Please enter your username.'); return; }
    if (!password) { setError('Please enter your password.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/auth/login/student`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, username: uname, password }),
      });
      if (!res.ok) {
        // 401 = bad credentials; anything else is an unexpected server/network issue.
        if (res.status === 401) {
          throw new Error('Incorrect username or password. Please check the details your teacher gave you.');
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not sign in. Please try again.');
      }
      const data = await res.json();
      if (!data?.token) throw new Error('Could not sign in. Please try again.');
      setSession({ token: data.token, userId: data.user?.id ?? null });
    } catch (err: any) {
      setError(err.message || 'Could not sign in. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (session) {
    return <StudentSimulationView overrideToken={session.token} overrideUserId={session.userId ?? undefined} />;
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleLogin}>
        <h1 className={styles.title}>Join Simulation</h1>
        <p className={styles.subtitle}>Sign in with the username and password your teacher gave you.</p>
        <input
          className={styles.input}
          type="text"
          placeholder="Username"
          value={username}
          onChange={e => setUsername(e.target.value)}
          autoFocus
          autoComplete="username"
          maxLength={60}
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={120}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Signing in...' : 'Start'}
        </button>
      </form>
    </div>
  );
};
