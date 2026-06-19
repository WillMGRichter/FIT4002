import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './OrgManagement.module.css';
import { TrashIcon } from '../components/Icons';

export const OrgManagement: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('University of Tech');
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <div className={styles.layout}>
      {/* Header Navigation */}
      <header style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={handleBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#0ea5e9' }}>
          ← Back to Dashboard
        </button>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600' }}>Organisation Management</h1>
        <div style={{ width: '100px' }}></div>
      </header>

      {/* Sidebar would go here */}
      <main className={styles.container}>
        <header className={styles.header}>
          <h1>Organisation Management</h1>
        </header>

        <div className={styles.contentSplit}>
          {/* Left Column: List */}
          <div className={styles.listPanel}>
            <div className={styles.panelTitleRow}>
              <h2>Organisations</h2>
              <button className={styles.addBtn} title="Add new organisation">+</button>
            </div>
            <div className={styles.listItems}>
              {['University of Tech', 'Business School'].map(org => (
                <div 
                  key={org} 
                  className={`${styles.orgItem} ${selectedOrg === org ? styles.activeOrg : ''}`}
                  onClick={() => setSelectedOrg(org)}
                >
                  {org}
                  <button className={styles.itemDelete} title="Delete organisation"><TrashIcon /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Detail Panel */}
          <div className={styles.detailPanel}>
            <h2 className={styles.detailHeader}>{selectedOrg}</h2>
            
            <div className={styles.adminSection}>
              <div className={styles.sectionHeader}>
                <div className={styles.iconLabel}>
                  <span className={styles.adminIcon}>👥</span>
                  <h3>Admins</h3>
                </div>
                <button className={styles.addUserBtn}>+ Add user</button>
              </div>

              <div className={styles.adminList}>
                <div className={styles.adminRow}>
                  <span>admin@tech.edu</span>
                  <button className={styles.rowDelete} title="Remove admin"><TrashIcon /></button>
                </div>
                <div className={styles.adminRow}>
                  <span>head@tech.edu</span>
                  <button className={styles.rowDelete} title="Remove admin"><TrashIcon /></button>
                </div>
              </div>
              
              <div className={styles.inviteRow}>
                <input type="email" placeholder="admin@example.com" className={styles.inviteInput} />
                <button className={styles.inviteBtn}>Add Admin</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};