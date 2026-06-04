import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projects as projectsApi, tracking as trackingApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import EventLog from '../components/EventLog';
import type { Project, TrackingEvent } from '../types';
import styles from './SessionsPage.module.css';

const PAGE_SIZE = 20;

export default function SessionsPage() {
  const { user, loading: authLoading, unauthenticated } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && unauthenticated) navigate('/login', { replace: true });
  }, [unauthenticated, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    projectsApi.list().then(setProjects).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    trackingApi
      .list({ page, pageSize: PAGE_SIZE, projectId: projectFilter || undefined })
      .then((result) => {
        setEvents(result.data);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, page, projectFilter]);

  if (authLoading || !user) return null;

  const handleFilterChange = (value: string) => {
    setProjectFilter(value);
    setPage(1);
  };

  return (
    <div className={styles.root}>
      <Sidebar user={user} activeTab="sessions" />

      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>Sessions</h1>
            <span className={styles.totalBadge}>{total} total</span>
          </div>

          <div className={styles.filters}>
            <label htmlFor="project-filter" className={styles.filterLabel}>
              Project
            </label>
            <select
              id="project-filter"
              className={styles.filterSelect}
              value={projectFilter}
              onChange={(e) => handleFilterChange(e.target.value)}
            >
              <option value="">All projects</option>
              {projects.map((p) => (
                <option key={p.project_id} value={p.project_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <div className={styles.list}>
          <EventLog events={events} loading={loading} />
        </div>

        {!loading && totalPages > 1 && (
          <nav className={styles.pagination} aria-label="Pagination">
            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
            >
              ← Prev
            </button>

            <div className={styles.pageNumbers}>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                .reduce<(number | 'gap')[]>((acc, n, i, arr) => {
                  if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('gap');
                  acc.push(n);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === 'gap' ? (
                    <span key={`gap-${i}`} className={styles.pageGap}>…</span>
                  ) : (
                    <button
                      key={item}
                      className={`${styles.pageNum} ${item === page ? styles.activePage : ''}`}
                      onClick={() => setPage(item as number)}
                      disabled={item === page}
                    >
                      {item}
                    </button>
                  )
                )}
            </div>

            <button
              className={styles.pageBtn}
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </nav>
        )}
      </main>
    </div>
  );
}
