import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import { ExcelIcon, HomeIcon, ComponentsIcon, BuildingIcon, ShieldIcon, CloseIcon, MenuIcon } from './Icons'

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
  { path: '/createSim',label: 'Create +',     icon: <ComponentsIcon /> },
];

export const Navbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className={styles.navbar}>
      <NavLink to="/" className={styles.brand}>
        <span className={styles.brandIcon}>
          <ExcelIcon />
        </span>
        <span className={styles.brandName}>Smart Simulations</span>
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