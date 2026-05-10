import React, { useState } from 'react';
import styles from './OrgManagement.module.css';
import { TrashIcon } from '../components/Icons';

export const OrgManagement: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('University of Tech');

  return (
    <div className={styles.layout}>
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
              <button className={styles.addBtn}>+</button>
            </div>
            <div className={styles.listItems}>
              {['University of Tech', 'Business School'].map(org => (
                <div 
                  key={org} 
                  className={`${styles.orgItem} ${selectedOrg === org ? styles.activeOrg : ''}`}
                  onClick={() => setSelectedOrg(org)}
                >
                  {org}
                  <button className={styles.itemDelete}><TrashIcon /></button>
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
                  <button className={styles.rowDelete}><TrashIcon /></button>
                </div>
                <div className={styles.adminRow}>
                  <span>head@tech.edu</span>
                  <button className={styles.rowDelete}><TrashIcon /></button>
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