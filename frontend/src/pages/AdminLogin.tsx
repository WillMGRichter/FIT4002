import React, { useState } from 'react';
import { Button } from '../components/Button';
import { Input }  from '../components/Input';
import styles from './AdminLogin.module.css';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.4"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12M6.9 6.93A2 2 0 0010.06 10M4.1 4.13C2.47 5.22 1 8 1 8s2.5 5 7 5c1.38 0 2.63-.38 3.71-.98M7 3.07C7.33 3.03 7.66 3 8 3c4.5 0 7 5 7 5s-.7 1.46-1.93 2.78" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
    <path d="M14 3L5 7v7c0 5.25 3.85 10.15 9 11.35C19.15 24.15 23 19.25 23 14V7L14 3z" fill="var(--color-accent-subtle)" stroke="var(--color-accent)" strokeWidth="1.5"/>
    <path d="M10 14l2.5 2.5L18 11" stroke="var(--color-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

export const AdminLogin: React.FC = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200)); // simulate network
    setLoading(false);
    setError('Invalid credentials. Please try again.');
  };

  return (
    <div className={styles.page} data-theme="light">
      <div className={styles.card}>
        <div className={styles.icon}>
          <ShieldIcon />
        </div>

        <h1 className={styles.title}>Admin Login</h1>
        <p className={styles.subtitle}>Sign in to your admin account to continue</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="admin@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            error={error && !email ? 'Email is required' : ''}
          />

          <div className={styles.passwordField}>
            <div className={styles.passwordHeader}>
              <label className={styles.fieldLabel} htmlFor="password-input">Password</label>
              <button type="button" className={styles.forgotLink}>Forgot password?</button>
            </div>
            <Input
              id="password-input"
              type={showPw ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-tertiary)' }}
                >
                  {showPw ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              }
            />
          </div>

          {error && <p className={styles.errorMsg} role="alert">{error}</p>}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            Sign in
          </Button>
        </form>

        <div className={styles.divider}>
          <span>OR CONTINUE WITH</span>
        </div>

        <Button variant="secondary" fullWidth size="lg" iconLeft={<GoogleIcon />}>
          Google
        </Button>

        <p className={styles.signup}>
          Don't have an account?{' '}
          <button type="button" className={styles.signupLink}>Sign up</button>
        </p>
      </div>
    </div>
  );
};
