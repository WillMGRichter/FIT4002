import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Home.module.css';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <main className={styles.page} data-theme="light">
      {/* Navigation Header */}
      <header className={styles.header}>
        <h1 className={styles.logo}>SmartSim</h1>
        <nav className={styles.nav}>
          <button onClick={() => navigate('/login')} className={styles.navBtn}>
            Sign In
          </button>
          <button onClick={() => navigate('/signup')} className={`${styles.navBtn} ${styles.primary}`}>
            Get Started
          </button>
        </nav>
      </header>

      {/* Hero */}
      <section className={styles.hero}>
        <h1 className={styles.heroTitle}>Smart Simulation</h1>
        
        <p className={styles.heroSub}>
          {'Upload Excel files, extract formulas, and run simulations — all from one place.'}
        </p>

        <div className={styles.heroActions}>
          <button onClick={() => navigate('/signup')} className={styles.btnPrimary}>
            Get Started Now
          </button>
          <button onClick={() => navigate('/login')} className={styles.btnSecondary}>
            Sign In
          </button>
        </div>
      </section>

      {/* Features */}
      <section className={styles.features}>
        <h2>Key Features</h2>
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📤</div>
            <h3>Upload Excel</h3>
            <p>Upload your spreadsheets and automatically extract formulas</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🧮</div>
            <h3>Run Simulations</h3>
            <p>Execute multiple scenarios and analyze results</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📊</div>
            <h3>Visualize Data</h3>
            <p>Create charts and visualizations from simulation results</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <p>&copy; 2026 SmartSim. All rights reserved.</p>
      </footer>
    </main>
  );
};