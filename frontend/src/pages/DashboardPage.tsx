import { useState, useEffect } from 'react';
import { projects as projectsApi, tracking as trackingApi } from '../api/client';
import Timer from '../components/Timer';
import EventLog from '../components/EventLog';
import type { Project, TrackingEvent } from '../types';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(), trackingApi.list({ pageSize: 10 })])
      .then(([p, page]) => {
        setProjects(p);
        setEvents(page.data);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, []);

  return (
    <main className={styles.main}>
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

      <section className={styles.logSection}>
        <EventLog events={events} loading={dataLoading} />
      </section>
    </main>
  );
}
