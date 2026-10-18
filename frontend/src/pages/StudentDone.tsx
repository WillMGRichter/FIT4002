import React from 'react';
import styles from './StudentDone.module.css';

/**
 * Placeholder landing page for a student who has finished with a simulation and
 * chosen to leave (or has no attempts remaining).
 *
 * A project student is NOT a real app user - they have no dashboard, no project
 * list and no organisation workspace. Sending them to /dashboard would render
 * whatever session happens to live in AuthContext (e.g. a teacher/admin who was
 * signed in on the same browser), which is wrong. This self-contained page gives
 * them a clear end state without touching any app session.
 */
export const StudentDone: React.FC = () => {
  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon}>✓</div>
        <h1 className={styles.title}>You&apos;re all done</h1>
        <p className={styles.text}>
          Thanks for taking part. Your responses have been submitted to your teacher.
        </p>
        <p className={styles.muted}>You can now close this tab.</p>
      </div>
    </div>
  );
};
