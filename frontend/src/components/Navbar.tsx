import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';

interface NavRoute {
  path:  string;
  label: string;
  icon:  React.ReactNode;
}

const ROUTES: NavRoute[] = [
  { path: '/',         label: 'Home',         icon: <HomeIcon /> },
  { path: '/showcase', label: 'Components',   icon: <ComponentsIcon /> },
  { path: '/login',    label: 'Admin Login',  icon: <ShieldIcon /> },
  { path: '/orgs',     label: 'Organisations',icon: <BuildingIcon /> },
];

export const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <ExcelIcon />
        </span>
        <span className={styles.brandName}>Excel Simulation</span>
      </NavLink>

      <nav className={styles.navLinks}>
        {ROUTES.map(route => (
          <NavLink
            key={route.path}
            to={route.path}
            end={route.path === '/'}
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ''].join(' ')
            }
          >
            <span className={styles.navIcon}>{route.icon}</span>
            {route.label}
          </NavLink>
        ))}
      </nav>

      <div className={styles.navRight}>
        {/* Modern status badge */}
        <div className={styles.statusGroup}>
          <div className={styles.statusDot} />
          <span className={styles.statusText}>Live</span>
        </div>
        
        <div className={styles.avatar}>JD</div>
      </div>

      <button className={styles.hamburger} onClick={() => setMenuOpen(!menuOpen)}>
        {menuOpen ? <CloseIcon /> : <MenuIcon />}
      </button>

      {/* Mobile Drawer (simplified) */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
           {/* Mobile links mapped here */}
        </div>
      )}
    </header>
  );
};



/* ── Icons ─────────────────────────────────────────────── */
function ExcelIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect width="24" height="24" rx="6" fill="#16a34a"/>
      <path d="M8 8L16 16M16 8L8 16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 7.5L8 2l6 5.5V15a.5.5 0 01-.5.5h-3.75V11h-3.5v4.5H2.5A.5.5 0 012 15V7.5z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
    </svg>
  );
}
function ComponentsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.4"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M8 1.5L2 4v4.5c0 3 2.5 5.8 6 6.5 3.5-.7 6-3.5 6-6.5V4L8 1.5z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="4" width="12" height="11" rx="1" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 15V9h6v6" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <path d="M5 1.5h6v2.5H5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
      <rect x="5" y="6.5" width="2" height="1.5" rx=".25" fill="currentColor"/>
      <rect x="9" y="6.5" width="2" height="1.5" rx=".25" fill="currentColor"/>
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
    </svg>
  );
}