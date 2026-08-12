import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projects as projectsApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { logError } from '../utils/logger';
import styles from './OnboardingPage.module.css';

export default function OnboardingPage() {
  const { user, loading, unauthenticated } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && unauthenticated) navigate('/login', { replace: true });
  }, [unauthenticated, loading, navigate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      await projectsApi.create(name.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      logError(err);
      setError('Could not create project. Please try again.');
      setSubmitting(false);
    }
  }

  if (loading || !user) return null;

  return (
    <div className={styles.root}>
      <div className={styles.orb} aria-hidden />

      <main className={styles.card}>
        <div className={styles.header}>
          <span className={styles.logoMark}>◈</span>
          <h1 className={styles.title}>
            Welcome, {user.display_name.split(' ')[0]}.
          </h1>
        </div>

        <p className={styles.subtitle}>
          Start by creating your first project — or skip and set one up later.
        </p>

        <form onSubmit={handleCreate} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="project-name" className={styles.label}>
              Project name
            </label>
            <input
              id="project-name"
              className={styles.input}
              type="text"
              placeholder="e.g. Client Work, Side Project…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={100}
              disabled={submitting}
            />
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.actions}>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={!name.trim() || submitting}
            >
              {submitting ? 'Creating…' : 'Create project'}
            </button>

            <button
              type="button"
              className={styles.btnSkip}
              onClick={() => navigate('/dashboard', { replace: true })}
            >
              Skip for now
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
