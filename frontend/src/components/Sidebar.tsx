import React from 'react';
import styles from './Sidebar.module.css';

export interface NavItem {
  id:       string;
  label:    string;
  icon:     React.ReactNode;
  href?:    string;
  badge?:   string | number;
}

export interface SidebarProps {
  collapsed?:    boolean;
  onCollapse?:   (v: boolean) => void;
  navItems:      NavItem[];
  bottomItems?:  NavItem[];
  activeId?:     string;
  onNavigate?:   (id: string) => void;
  orgName?:      string;
  appName?:      string;
  appIcon?:      React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed   = false,
  onCollapse,
  navItems,
  bottomItems = [],
  activeId,
  onNavigate,
  orgName  = 'Organisation',
  appName  = 'Excel Simulation',
  appIcon,
}) => {
  return (
    <aside
      className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.appBrand}>
          {appIcon && <span className={styles.appIcon}>{appIcon}</span>}
          {!collapsed && <span className={styles.appName}>{appName}</span>}
        </div>
        <button
          className={styles.collapseBtn}
          onClick={() => onCollapse?.(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon flipped={collapsed} />
        </button>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        <ul className={styles.navList} role="list">
          {navItems.map(item => (
            <li key={item.id}>
              <button
                className={`${styles.navItem} ${activeId === item.id ? styles.active : ''}`}
                onClick={() => onNavigate?.(item.id)}
                title={collapsed ? item.label : undefined}
                aria-current={activeId === item.id ? 'page' : undefined}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                {!collapsed && (
                  <>
                    <span className={styles.navLabel}>{item.label}</span>
                    {item.badge !== undefined && (
                      <span className={styles.badge}>{item.badge}</span>
                    )}
                  </>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom section */}
      {(bottomItems.length > 0 || orgName) && (
        <div className={styles.bottom}>
          <div className={styles.divider} />
          {!collapsed && orgName && (
            <div className={styles.orgRow}>
              <span className={styles.orgDot} aria-hidden />
              <span className={styles.orgName}>{orgName}</span>
              <ChevronDown />
            </div>
          )}
          <ul className={styles.navList} role="list">
            {bottomItems.map(item => (
              <li key={item.id}>
                <button
                  className={`${styles.navItem} ${activeId === item.id ? styles.active : ''}`}
                  onClick={() => onNavigate?.(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};

/* ── Micro icons ─────────────────────────────────────────── */
const CollapseIcon = ({ flipped }: { flipped: boolean }) => (
  <svg
    width="16" height="16" viewBox="0 0 16 16" fill="none"
    style={{ transform: flipped ? 'rotate(180deg)' : 'none', transition: 'transform 200ms ease' }}
  >
    <path d="M10 4L6 8L10 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
