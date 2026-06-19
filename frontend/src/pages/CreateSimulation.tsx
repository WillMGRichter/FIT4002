import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CreateSimulation.module.css';

export const CreateSimulation: React.FC = () => {
  const [message, setMessage] = useState<string>('');
  const [formulas, setFormulas] = useState<any>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const navigate = useNavigate();

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
      {/* Navigation Header */}
      <header style={{ padding: '1rem', textAlign: 'left' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', color: '#0ea5e9' }}>
          ← Back to Dashboard
        </button>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className={`${styles.heroDot} ${status.class}`} />
          {status.text}
        </div>
        <h1 className={styles.heroTitle}>Excel Simulation</h1>
        <p className={styles.heroSub}>
          {message || 'Upload Excel files, extract formulas, and run simulations — all from one place.'}
        </p>

        {/* Upload card */}
        <div className={styles.uploadCard}>
          <h2 className={styles.uploadTitle}>Upload Excel File</h2>
          <p className={styles.uploadDesc}>Extract formulas and cell data from any .xlsx file</p>
          <label className={styles.uploadLabel}>
            <input type="file" accept=".xlsx" onChange={handleFile} className={styles.uploadInput} />
            <span className={styles.uploadBtn}>
              {loading ? 'Processing…' : (
                <>
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><path d="M8 12V3M8 3l3 3M8 3L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Choose .xlsx file
                </>
              )}
            </span>
          </label>
          {error && <p className={styles.uploadError}>{error}</p>}
          {formulas && (
            <pre className={styles.uploadResult}>
              {JSON.stringify(formulas, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </main>
  );
};