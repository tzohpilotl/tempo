import { useState, useEffect } from 'react';
import { projects as projectsApi, tracking as trackingApi } from '../api/client';
import EventLog from '../components/EventLog';
import PieChart from '../components/PieChart';
import type { Project, TrackingEvent, TrackingSummaryResponse } from '../types';
import { logError } from '../utils/logger';
import { getDayRange, getWeekRange, getMonthRange } from '../utils/dateRange';
import styles from './SessionsPage.module.css';

const PAGE_SIZE = 20;

const EMPTY_TIME_SUMMARY = { breakdown: [], total_seconds: 0 };
const EMPTY_SUMMARIES: TrackingSummaryResponse = {
  allTime: EMPTY_TIME_SUMMARY,
  day: EMPTY_TIME_SUMMARY,
  week: EMPTY_TIME_SUMMARY,
  month: EMPTY_TIME_SUMMARY,
};

const CHART_LABELS: Array<{ key: keyof TrackingSummaryResponse; label: string }> = [
  { key: 'day', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
  { key: 'allTime', label: 'All time' },
];

const fetchSummary = () =>
  trackingApi.summary({ day: getDayRange(), week: getWeekRange(), month: getMonthRange() });

export default function SessionsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [summaries, setSummaries] = useState<TrackingSummaryResponse>(EMPTY_SUMMARIES);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [projectFilter, setProjectFilter] = useState('');
  const [listLoading, setListLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [eventsOpen, setEventsOpen] = useState(true);

  useEffect(() => {
    projectsApi.list().then(setProjects).catch(logError);
    fetchSummary()
      .then(setSummaries)
      .catch(logError)
      .finally(() => setChartLoading(false));
  }, []);

  useEffect(() => {
    setListLoading(true);
    trackingApi
      .list({ page, pageSize: PAGE_SIZE, projectId: projectFilter || undefined })
      .then((result) => {
        setEvents(result.data);
        setTotalPages(result.totalPages);
        setTotal(result.total);
      })
      .catch(logError)
      .finally(() => setListLoading(false));
  }, [page, projectFilter]);

  const handleFilterChange = (value: string) => {
    setProjectFilter(value);
    setPage(1);
  };

  const refresh = () => {
    setListLoading(true);
    return Promise.all([
      trackingApi
        .list({ page, pageSize: PAGE_SIZE, projectId: projectFilter || undefined })
        .then((result) => {
          setEvents(result.data);
          setTotalPages(result.totalPages);
          setTotal(result.total);
        }),
      fetchSummary().then(setSummaries),
    ])
      .catch(logError)
      .finally(() => setListLoading(false));
  };

  const handleUpdate = async (
    eventId: string,
    patch: { started_at: string; stopped_at: string; task_description?: string; project_id?: string },
  ) => {
    const updated = await trackingApi.update(eventId, patch);
    setEvents((prev) =>
      prev.map((e) => (e.tracking_event_id === updated.tracking_event_id ? updated : e)),
    );
    // The event itself is already updated locally — only the aggregates need refetching.
    await fetchSummary().then(setSummaries).catch(logError);
  };

  const handleDelete = async (eventId: string) => {
    await trackingApi.delete(eventId);
    await refresh();
  };

  return (
    <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Sessions</h1>
        </header>

        {/* ── Pie charts — main focus of the page ── */}
        <section className={styles.chartSection}>
          {CHART_LABELS.map(({ key, label }) => (
            <div key={key} className={styles.chartCard}>
              <h2 className={styles.chartCardTitle}>{label}</h2>
              {chartLoading ? (
                <div className={styles.chartPlaceholder} />
              ) : (
                <PieChart summary={summaries[key]} />
              )}
            </div>
          ))}
        </section>

        {/* ── Foldable events list ── */}
        <section className={styles.eventsDrawer}>
          <button
            className={styles.eventsToggle}
            onClick={() => setEventsOpen((o) => !o)}
            aria-expanded={eventsOpen}
          >
            <div className={styles.toggleLeft}>
              <span className={`${styles.chevron} ${eventsOpen ? styles.chevronOpen : ''}`}>
                ▸
              </span>
              <span className={styles.toggleLabel}>{total} sessions</span>
            </div>

            {/* Project filter lives in the toggle row so it's always visible */}
            <div className={styles.filters} onClick={(e) => e.stopPropagation()}>
              <label htmlFor="project-filter" className={styles.filterLabel}>
                Project
              </label>
              <select
                id="project-filter"
                className={styles.filterSelect}
                value={projectFilter}
                onChange={(e) => handleFilterChange(e.target.value)}
              >
                <option value="">All</option>
                {projects.map((p) => (
                  <option key={p.project_id} value={p.project_id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </button>

          {eventsOpen && (
            <div className={styles.eventsContent}>
              <EventLog
                events={events}
                loading={listLoading}
                projects={projects}
                onUpdate={handleUpdate}
                onDelete={handleDelete}
                detailed
              />

              {!listLoading && totalPages > 1 && (
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
                      .filter(
                        (n) =>
                          n === 1 ||
                          n === totalPages ||
                          Math.abs(n - page) <= 1,
                      )
                      .reduce<(number | 'gap')[]>((acc, n, i, arr) => {
                        if (i > 0 && n - (arr[i - 1] as number) > 1)
                          acc.push('gap');
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((item, i) =>
                        item === 'gap' ? (
                          <span key={`gap-${i}`} className={styles.pageGap}>
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            className={`${styles.pageNum} ${item === page ? styles.activePage : ''}`}
                            onClick={() => setPage(item as number)}
                            disabled={item === page}
                          >
                            {item}
                          </button>
                        ),
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
            </div>
          )}
        </section>
    </main>
  );
}
