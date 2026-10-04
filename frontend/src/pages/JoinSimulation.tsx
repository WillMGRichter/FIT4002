import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_URL } from '../config';
import { getGuestSession, saveGuestSession } from '../utils/guestSession';
import { StudentSimulationView } from './StudentSimulationView';
import styles from './JoinSimulation.module.css';

/**
 * Public entry point for the shareable student link (/join/:projectId).
 *
 * Flow:
 *  - If a guest session already exists for this project (returning student),
 *    skip straight to the simulation so they resume their saved state.
 *  - Otherwise prompt for a display name, POST it to /public/.../join to mint a
 *    student identity + token, store it, then render the simulation.
 *
 * No account or login is required - the link itself is the gate.
 */
export const JoinSimulation: React.FC = () => {
  const { projectId } = useParams();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Returning student with a saved session -> go straight in.
  useEffect(() => {
    if (projectId && getGuestSession(projectId)) setJoined(true);
  }, [projectId]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    const displayName = name.trim();
    const studentEmail = email.trim();
    if (!displayName) { setError('Please enter your name.'); return; }
    if (!studentEmail) { setError('Please enter your email.'); return; }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/public/projects/${projectId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, email: studentEmail }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not join this simulation.');
      }
      const session = await res.json();
      saveGuestSession(projectId, session);
      setJoined(true);
    } catch (err: any) {
      setError(err.message || 'Could not join this simulation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (joined) {
    return <StudentSimulationView />;
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={handleJoin}>
        <h1 className={styles.title}>Join Simulation</h1>
        <p className={styles.subtitle}>Enter your details to begin.</p>
        <input
          className={styles.input}
          type="text"
          placeholder="Your name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          maxLength={60}
        />
        <input
          className={styles.input}
          type="email"
          placeholder="Your email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          maxLength={120}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Joining...' : 'Start'}
        </button>
      </form>
    </div>
  );
};
