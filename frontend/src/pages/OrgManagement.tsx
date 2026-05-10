import React, { useState } from 'react';
import { Sidebar, NavItem } from '../components/Sidebar';
import { Button }           from '../components/Button';
import { Input }            from '../components/Input';
import styles from './OrgManagement.module.css';

/* ── Icons ──────────────────────────────────────────────── */
const HomeIcon  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 7.5L9 2l7 5.5V16a1 1 0 01-1 1H3a1 1 0 01-1-1V7.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M7 17V11h4v6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>;
const MenuIcon  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="8.25" width="14" height="1.5" rx=".75" fill="currentColor"/><rect x="2" y="12.5" width="14" height="1.5" rx=".75" fill="currentColor"/></svg>;
const SimIcon   = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="2" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="2" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10" y="10" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg>;
const SettingsIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.7 3.7l1.4 1.4M12.9 12.9l1.4 1.4M3.7 14.3l1.4-1.4M12.9 5.1l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const LoginIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M7 3H3a1 1 0 00-1 1v10a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 5l4 4-4 4M16 9H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const UserPlusIcon = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M1 15c0-3.314 2.686-5 6-5s6 1.686 6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M14 7v4M12 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const TrashIcon  = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 4h12M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M5 4l.5 9h5l.5-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>;
const PlusIcon  = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const MoonIcon  = () => <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 10.5A7 7 0 017.5 3c0-.17.01-.34.03-.5A7 7 0 109 16.5a7 7 0 006-3.5.5.5 0 00-.03-.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;
const ExcelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect width="16" height="16" rx="3" fill="white"/>
    <text x="3" y="12" fontSize="10" fontWeight="700" fill="#1D6F42" fontFamily="sans-serif">X</text>
  </svg>
);

/* ── Data ──────────────────────────────────────────────── */
interface Organisation {
  id:     string;
  name:   string;
  admins: string[];
}

const INITIAL_ORGS: Organisation[] = [
  { id: 'o1', name: 'University of Tech', admins: ['admin@tech.edu', 'head@tech.edu'] },
  { id: 'o2', name: 'Business School',    admins: ['dean@bschool.edu'] },
];

const NAV_ITEMS: NavItem[] = [
  { id: 'home',       label: 'Home',       icon: <HomeIcon /> },
  { id: 'menu',       label: 'Menu',       icon: <MenuIcon /> },
  { id: 'simulation', label: 'Simulation', icon: <SimIcon /> },
];

const BOTTOM_ITEMS: NavItem[] = [
  { id: 'manage-orgs', label: 'Manage Organizations', icon: <SettingsIcon /> },
  { id: 'login',       label: 'Login',                icon: <LoginIcon /> },
];

/* ── Component ────────────────────────────────────────── */
export const OrgManagement: React.FC = () => {
  const [collapsed,     setCollapsed]     = useState(false);
  const [activeNav,     setActiveNav]     = useState('manage-orgs');
  const [orgs,          setOrgs]          = useState<Organisation[]>(INITIAL_ORGS);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(INITIAL_ORGS[0].id);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [emailError,    setEmailError]    = useState('');

  const selectedOrg = orgs.find(o => o.id === selectedOrgId);

  const handleAddAdmin = () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) { setEmailError('Enter an email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setEmailError('Invalid email'); return; }
    if (selectedOrg?.admins.includes(email)) { setEmailError('Admin already added'); return; }

    setOrgs(prev => prev.map(o =>
      o.id === selectedOrgId ? { ...o, admins: [...o.admins, email] } : o
    ));
    setNewAdminEmail('');
    setEmailError('');
  };

  const handleRemoveAdmin = (email: string) => {
    setOrgs(prev => prev.map(o =>
      o.id === selectedOrgId ? { ...o, admins: o.admins.filter(a => a !== email) } : o
    ));
  };

  const handleAddOrg = () => {
    const name = prompt('Organisation name:');
    if (!name?.trim()) return;
    const newOrg: Organisation = { id: `o${Date.now()}`, name: name.trim(), admins: [] };
    setOrgs(prev => [...prev, newOrg]);
    setSelectedOrgId(newOrg.id);
  };

  const handleDeleteOrg = (id: string) => {
    if (!window.confirm('Delete this organisation?')) return;
    setOrgs(prev => {
      const next = prev.filter(o => o.id !== id);
      if (selectedOrgId === id) setSelectedOrgId(next[0]?.id ?? '');
      return next;
    });
  };

  return (
    <div className={styles.layout} data-theme="light">
      <Sidebar
        collapsed={collapsed}
        onCollapse={setCollapsed}
        navItems={NAV_ITEMS}
        bottomItems={BOTTOM_ITEMS}
        activeId={activeNav}
        onNavigate={setActiveNav}
        orgName={selectedOrg?.name}
        appName="Excel Simulation"
        appIcon={<ExcelIcon />}
      />

      <div className={styles.main}>
        {/* Top bar */}
        <header className={styles.topbar}>
          <h1 className={styles.pageTitle}>Organisation Management</h1>
          <button className={styles.themeBtn} aria-label="Toggle theme">
            <MoonIcon />
          </button>
        </header>

        {/* Content */}
        <div className={styles.content}>
          {/* Orgs list */}
          <section className={styles.orgPanel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Organisations</h2>
              <Button variant="ghost" size="sm" iconLeft={<PlusIcon />} onClick={handleAddOrg}>
              </Button>
            </div>
            <ul className={styles.orgList} role="list">
              {orgs.map(org => (
                <li key={org.id}>
                  <div
                    className={`${styles.orgItem} ${org.id === selectedOrgId ? styles.orgItemActive : ''}`}
                    onClick={() => setSelectedOrgId(org.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setSelectedOrgId(org.id)}
                  >
                    <span className={styles.orgItemName}>{org.name}</span>
                    <button
                      className={styles.deleteBtn}
                      onClick={e => { e.stopPropagation(); handleDeleteOrg(org.id); }}
                      aria-label={`Delete ${org.name}`}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* Detail panel */}
          <section className={styles.detailPanel}>
            {selectedOrg ? (
              <>
                <h2 className={styles.detailTitle}>{selectedOrg.name}</h2>

                <div className={styles.adminsSection}>
                  <div className={styles.adminsHeader}>
                    <h3 className={styles.adminsTitle}>Admins</h3>
                    <button className={styles.addAdminIcon} aria-label="Add admin">
                      <UserPlusIcon />
                    </button>
                  </div>

                  {/* Admin list */}
                  <ul className={styles.adminList} role="list">
                    {selectedOrg.admins.map(email => (
                      <li key={email} className={styles.adminRow}>
                        <span className={styles.adminEmail}>{email}</span>
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleRemoveAdmin(email)}
                          aria-label={`Remove ${email}`}
                        >
                          <TrashIcon />
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Add admin row */}
                  <div className={styles.addRow}>
                    <Input
                      type="email"
                      placeholder="admin@example.com"
                      value={newAdminEmail}
                      onChange={e => { setNewAdminEmail(e.target.value); setEmailError(''); }}
                      onKeyDown={e => e.key === 'Enter' && handleAddAdmin()}
                      error={emailError}
                      className={styles.addInput}
                    />
                    <Button onClick={handleAddAdmin} size="md">
                      Add Admin
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className={styles.emptyState}>Select an organisation to manage it.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
