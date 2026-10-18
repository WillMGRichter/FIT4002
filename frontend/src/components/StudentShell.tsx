import React from 'react';
import './StudentShell.css';

interface StudentShellProps {
  title: string;
  children: React.ReactNode;
}

/**
 * Minimal chrome for students taking a simulation.
 *
 * Deliberately NOT the AppShell used by teachers/admins: a student (especially an
 * anonymous one joining via a link) should only see and interact with the single
 * simulation they were invited to - no sidebar navigation, no links to other
 * projects, no create/organisation/account controls. Just the simulation title
 * and the simulation itself.
 */
export const StudentShell: React.FC<StudentShellProps> = ({ title, children }) => {
  return (
    <div className="student-shell">
      <header className="student-shell__topbar">
        <div className="student-shell__brand">SmartSim</div>
        <div className="student-shell__title">{title}</div>
        <div className="student-shell__spacer" />
      </header>
      <main className="student-shell__content">{children}</main>
    </div>
  );
};
