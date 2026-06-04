import type { TrackingEvent } from '../types';
import styles from './EventLog.module.css';

interface Props {
  events: TrackingEvent[];
  loading: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

const ucFirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today · ${timeStr}`;
  if (isYesterday) return `Yesterday · ${timeStr}`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` · ${timeStr}`;
}

export default function EventLog({ events, loading }: Props) {
  if (loading) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⋯</span>
        <p>Loading sessions…</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>◎</span>
        <p>No sessions yet. Start the timer to log your first one.</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h2 className={styles.heading}>Sessions</h2>
      <ul className={styles.list}>
        {events.map((event, i) => (
          <li
            key={event.tracking_event_id}
            className={styles.item}
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div className={styles.itemLeft}>
              {event.task_description ? (
                <span className={styles.taskDesc}>{ucFirst(event.task_description)}</span>
              ) : (
                <span className={styles.taskDescEmpty}>Untitled session</span>
              )}
              <div className={styles.meta}>
                {event.project && (
                  <>
                    <span className={styles.projectTag}>{ucFirst(event.project.name)}</span>
                    <span className={styles.metaDot}>·</span>
                  </>
                )}
                <span className={styles.metaDate}>{formatDate(event.started_at)}</span>
              </div>
            </div>

            <span className={styles.duration}>
              {formatDuration(event.duration_seconds)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
