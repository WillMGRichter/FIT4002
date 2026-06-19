import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import styles from './OrgManagement.module.css';

export const OrgManagement: React.FC = () => {
  const [selectedOrg, setSelectedOrg] = useState('University of Tech');

  return (
    <AppShell title="Organisation Management" showBack>
      <div className={styles.page}>
        <div className={styles.contentSplit}>
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
                  <button className={styles.itemDelete} title="Delete organisation"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.detailPanel}>
            <h2 className={styles.detailHeader}>{selectedOrg}</h2>
            
            <div className={styles.adminSection}>
              <div className={styles.sectionHeader}>
                <h3>Admins</h3>
                <button className={styles.addUserBtn}>+ Add user</button>
              </div>

              <div className={styles.adminList}>
                <div className={styles.adminRow}>
                  <span>admin@tech.edu</span>
                  <button className={styles.rowDelete} title="Remove admin"><Trash2 size={14} /></button>
                </div>
                <div className={styles.adminRow}>
                  <span>head@tech.edu</span>
                  <button className={styles.rowDelete} title="Remove admin"><Trash2 size={14} /></button>
                </div>
              </div>
              
              <div className={styles.inviteRow}>
                <input type="email" placeholder="admin@example.com" className={styles.inviteInput} />
                <button className={styles.inviteBtn}>Add Admin</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
};
