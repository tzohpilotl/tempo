import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projects as projectsApi, tracking as trackingApi } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import Sidebar from '../components/Sidebar';
import Timer from '../components/Timer';
import EventLog from '../components/EventLog';
import type { Project, TrackingEvent } from '../types';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user, loading: authLoading, unauthenticated } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Redirect to login only when we have a confirmed 401, not on transient errors
  useEffect(() => {
    if (!authLoading && unauthenticated) navigate('/login', { replace: true });
  }, [unauthenticated, authLoading, navigate]);

  // Load projects and events on mount
  useEffect(() => {
    if (!user) return;

    Promise.all([projectsApi.list(), trackingApi.list({ pageSize: 10 })])
      .then(([p, page]) => {
        setProjects(p);
        setEvents(page.data);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, [user]);

  if (authLoading || !user) return null;

  return (
    <div className={styles.root}>
      <Sidebar user={user} activeTab="timer" />

      <main className={styles.main}>
        {/* Timer panel — centered at the top */}
        <section className={styles.timerSection}>
          <Timer
            projects={projects}
            onEventLogged={(event) =>
              setEvents((prev) => [event, ...prev].slice(0, 10))
            }
            onProjectCreated={(project) =>
              setProjects((prev) => [project, ...prev])
            }
          />
        </section>

        {/* Session log below */}
        <section className={styles.logSection}>
          <EventLog events={events} loading={dataLoading} />
        </section>
      </main>
    </div>
  );
}
