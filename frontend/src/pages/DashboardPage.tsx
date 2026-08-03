import { useState, useEffect } from 'react';
import { projects as projectsApi, tracking as trackingApi } from '../api/client';
import Timer from '../components/Timer';
import EventLog from '../components/EventLog';
import type { Project, TrackingEvent } from '../types';
import styles from './DashboardPage.module.css';

const DASHBOARD_EVENT_LIMIT = 5;

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    Promise.all([projectsApi.list(), trackingApi.list({ pageSize: DASHBOARD_EVENT_LIMIT })])
      .then(([p, page]) => {
        setProjects(p);
        setEvents(page.data);
      })
      .catch(console.error)
      .finally(() => setDataLoading(false));
  }, []);

  const refreshEvents = () =>
    trackingApi.list({ pageSize: DASHBOARD_EVENT_LIMIT }).then((page) => setEvents(page.data));

  const handleUpdate = async (
    eventId: string,
    patch: { started_at: string; stopped_at: string; task_description?: string; project_id?: string },
  ) => {
    await trackingApi.update(eventId, patch);
    await refreshEvents();
  };

  const handleDelete = async (eventId: string) => {
    await trackingApi.delete(eventId);
    await refreshEvents();
  };

  return (
    <main className={styles.main}>
      <section className={styles.timerSection}>
        <Timer
          projects={projects}
          onEventLogged={(event) =>
            setEvents((prev) => [event, ...prev].slice(0, DASHBOARD_EVENT_LIMIT))
          }
          onProjectCreated={(project) =>
            setProjects((prev) => [project, ...prev])
          }
        />
      </section>

      <section className={styles.logSection}>
        <EventLog
          events={events}
          loading={dataLoading}
          projects={projects}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      </section>
    </main>
  );
}
