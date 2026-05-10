import styles from './Home.module.css';

export const Home: React.FC = () => {

  return (
    <main className={styles.page} data-theme="light">
      {/* Hero */}
      <section className={styles.hero}>

        <h1 className={styles.heroTitle}>Smart Simulation</h1>
        
        <p className={styles.heroSub}>
          {'Upload Excel files, extract formulas, and run simulations — all from one place.'}
        </p>
        
      </section>

    </main>
  );
};