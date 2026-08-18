import React, { useCallback, useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { API_URL } from '../config';
import styles from './OrgManagement.module.css';

interface Organisation {
  id: string;
  name: string;
  created_at: string;
}

export const OrgManagement: React.FC = () => {
  const [orgs, setOrgs] = useState<Organisation[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { token } = useAuth();

  const selectedOrg = orgs.find(o => o.id === selectedOrgId) || null;

  const fetchOrgs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/auth/organisations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch organisations');
      const data = await res.json();
      setOrgs(data);
      if (data.length > 0) setSelectedOrgId(data[0].id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  return (
    <AppShell title="Organisation Management" showBack>
      <div className={styles.page}>
        <div className={styles.contentSplit}>
          <div className={styles.listPanel}>
            <div className={styles.panelTitleRow}>
              <h2>Organisations</h2>
              <button className={styles.addBtn} title="Add new organisation">+</button>
            </div>
            {loading ? (
              <div className={styles.listItems}>Loading...</div>
            ) : error ? (
              <div className={styles.listItems}>{error}</div>
            ) : (
              <div className={styles.listItems}>
                {orgs.map(org => (
                  <div
                    key={org.id}
                    className={`${styles.orgItem} ${selectedOrgId === org.id ? styles.activeOrg : ''}`}
                    onClick={() => setSelectedOrgId(org.id)}
                  >
                    {org.name}
                    <button className={styles.itemDelete} title="Delete organisation"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.detailPanel}>
            <h2 className={styles.detailHeader}>{selectedOrg?.name || 'Select an organisation'}</h2>

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
