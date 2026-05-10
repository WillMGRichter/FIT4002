import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './Home.module.css';

// Accent colors based on image dashboard
const QUICK_LINKS = [
  { path: '/showcase', label: 'Component Showcase', desc: 'Browse all UI components and design tokens', icon: '⊞', accent: '#2563EB' },
  { path: '/login',    label: 'Admin Login',         desc: 'Authentication page with form validation',  icon: '🔐', accent: '#3D6B35' },
  { path: '/orgs',     label: 'Organisations',        desc: 'Manage organisations and admin users',      icon: '🏢', accent: '#7C3AED' },
];

export const Home: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [formulas, setFormulas] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000')
      .then(res => res.json())
      .then(data => { setMessage(data.message); setBackendOk(true); })
      .catch(() => setBackendOk(false));
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const formData = new FormData();
    formData.append('file', e.target.files[0]);
    setLoading(true); setError(''); setFormulas(null);
    try {
      const res = await fetch('http://localhost:5000/excel/upload', { method: 'POST', body: formData });
      if (!res.ok) throw new Error('Upload failed');
      setFormulas(await res.json());
    } catch (err: any) {
      setError(err.message || 'Error uploading file');
    } finally {
      setLoading(false);
    }
  };

  const getDotStatus = () => {
    if (backendOk === true)  return { text: 'Backend connected', class: styles.dotOk };
    if (backendOk === false) return { text: 'Backend offline',   class: styles.dotOffline };
    return { text: 'Connecting…',  class: styles.dotConnecting };
  };
  const status = getDotStatus();

  return (
    <main className={styles.page} data-theme="light">
      {/* Hero */}
      <section className={styles.hero}>

        <h1 className={styles.heroTitle}>Smart Simulation</h1>
        <p className={styles.heroSub}>
          {message || 'Upload Excel files, extract formulas, and run simulations — all from one place.'}
        </p>

        
      </section>

    </main>
  );
};