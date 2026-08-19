import { useState, useEffect } from 'react';
import { projects as projectsApi, tracking as trackingApi, ApiError } from '../api/client';
import Timer from '../components/Timer';
import EventLog from '../components/EventLog';
import type { Project, TrackingEvent } from '../types';
import { logError } from '../utils/logger';
import {
  getPendingChanges,
  applyPendingChanges,
  queueEventUpdate,
  queueEventDelete,
  isLocalEventId,
  useQueueStatus,
} from '../utils/offlineQueue';
import styles from './DashboardPage.module.css';

const DASHBOARD_EVENT_LIMIT = 5;

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const { pendingIds } = useQueueStatus();

  useEffect(() => {
    Promise.all([
      projectsApi.list(),
      trackingApi.list({ pageSize: DASHBOARD_EVENT_LIMIT }),
      getPendingChanges(),
    ])
      .then(([p, page, pending]) => {
        setProjects(p);
        const synced = applyPendingChanges(page.data, pending, p);
        // Not-yet-synced creations don't come back from trackingApi.list —
        // merge them in (newest first) so a reload while offline doesn't
        // make a just-created session appear to have vanished. Filter out
        // anything that's already in the synced list: the sync engine can
        // finish draining the queue in the background between this page's
        // own fetch and the queue read finishing, so a just-synced event
        // could otherwise show up twice. Two distinct real sessions sharing
        // the exact same start and stop instant is not a realistic collision.
        const stillPending = pending.creates.filter(
          (pe) => !synced.some((se) => se.started_at === pe.started_at && se.stopped_at === pe.stopped_at),
        );
        setEvents([...stillPending].reverse().concat(synced).slice(0, DASHBOARD_EVENT_LIMIT));
      })
      .catch(logError)
      .finally(() => setDataLoading(false));
  }, []);

  const handleUpdate = async (
    eventId: string,
    patch: { started_at: string; stopped_at: string; task_description?: string; project_id?: string },
  ) => {
    // A still-unsynced local creation has nothing server-side to PATCH — the
    // edit always goes straight to the queue, online or not.
    if (isLocalEventId(eventId)) {
      const updated = await queueEventUpdate(eventId, patch);
      setEvents((prev) => prev.map((e) => (e.tracking_event_id === eventId ? updated : e)));
      return;
    }

    let updated: TrackingEvent;
    try {
      updated = await trackingApi.update(eventId, patch);
    } catch (err) {
      if (err instanceof ApiError) throw err; // real rejection (e.g. overlap) — surface as today
      updated = await queueEventUpdate(eventId, patch); // network-level failure — queue it for later sync
    }
    setEvents((prev) =>
      prev.map((e) => (e.tracking_event_id === updated.tracking_event_id ? updated : e)),
    );
  };

  const handleDelete = async (eventId: string) => {
    if (isLocalEventId(eventId)) {
      await queueEventDelete(eventId);
      setEvents((prev) => prev.filter((e) => e.tracking_event_id !== eventId));
      return;
    }

    try {
      await trackingApi.delete(eventId);
    } catch (err) {
      if (err instanceof ApiError) throw err;
      await queueEventDelete(eventId);
    }
    setEvents((prev) => prev.filter((e) => e.tracking_event_id !== eventId));
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
          pendingIds={pendingIds}
        />
      </section>
    </main>
  );
}
