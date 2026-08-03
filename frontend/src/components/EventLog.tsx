import { useState } from 'react';
import type { Project, TrackingEvent } from '../types';
import { capitalize } from '../utils/text';
import styles from './EventLog.module.css';

interface Props {
  events: TrackingEvent[];
  loading: boolean;
  projects: Project[];
  onUpdate: (
    eventId: string,
    patch: { started_at: string; stopped_at: string; task_description?: string; project_id?: string },
  ) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
  /** Shows the full date and the start–end time range instead of the compact "Today · 2:15 PM" form. */
  detailed?: boolean;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

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

/** Full date plus the start–end time range, e.g. "Aug 3, 2026 · 2:15 PM – 3:40 PM". */
function formatDateRange(startedAtIso: string, stoppedAtIso: string): string {
  const start = new Date(startedAtIso);
  const stop = new Date(stoppedAtIso);
  const dateStr = start.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  const startStr = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const stopStr = stop.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${dateStr} · ${startStr} – ${stopStr}`;
}

/** Converts an ISO string to the local `datetime-local` input format (YYYY-MM-DDTHH:mm:ss). */
function toDateTimeLocal(isoString: string): string {
  const date = new Date(isoString);
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

interface EditState {
  task_description: string;
  project_id: string;
  started_at: string;
  stopped_at: string;
}

export default function EventLog({ events, loading, projects, onUpdate, onDelete, detailed = false }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (event: TrackingEvent) => {
    setEditingId(event.tracking_event_id);
    setError(null);
    setForm({
      task_description: event.task_description ?? '',
      project_id: event.project?.project_id ?? '',
      started_at: toDateTimeLocal(event.started_at),
      stopped_at: toDateTimeLocal(event.stopped_at),
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(null);
    setError(null);
  };

  const saveEdit = async (eventId: string) => {
    if (!form) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate(eventId, {
        started_at: new Date(form.started_at).toISOString(),
        stopped_at: new Date(form.stopped_at).toISOString(),
        task_description: form.task_description || undefined,
        project_id: form.project_id || undefined,
      });
      setEditingId(null);
      setForm(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this session? This cannot be undone.')) return;
    await onDelete(eventId);
  };

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
        {events.map((event, i) => {
          const isEditing = editingId === event.tracking_event_id;

          if (isEditing && form) {
            return (
              <li
                key={event.tracking_event_id}
                className={`${styles.item} ${styles.itemEditing}`}
              >
                <form
                  className={styles.editForm}
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(event.tracking_event_id);
                  }}
                >
                  <input
                    className={styles.editInput}
                    type="text"
                    placeholder="Task description"
                    value={form.task_description}
                    onChange={(e) => setForm({ ...form, task_description: e.target.value })}
                  />

                  <select
                    className={styles.editInput}
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                  >
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.project_id} value={p.project_id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <div className={styles.editRow}>
                    <input
                      className={styles.editInput}
                      type="datetime-local"
                      step="1"
                      value={form.started_at}
                      onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                      required
                    />
                    <span className={styles.editArrow}>→</span>
                    <input
                      className={styles.editInput}
                      type="datetime-local"
                      step="1"
                      value={form.stopped_at}
                      onChange={(e) => setForm({ ...form, stopped_at: e.target.value })}
                      required
                    />
                  </div>

                  {error && <p className={styles.editError}>{error}</p>}

                  <div className={styles.editActions}>
                    <button type="button" className={styles.cancelBtn} onClick={cancelEdit} disabled={saving}>
                      Cancel
                    </button>
                    <button type="submit" className={styles.saveBtn} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </li>
            );
          }

          return (
            <li
              key={event.tracking_event_id}
              className={styles.item}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className={styles.itemLeft}>
                {event.task_description ? (
                  <span className={styles.taskDesc}>{capitalize(event.task_description)}</span>
                ) : (
                  <span className={styles.taskDescEmpty}>Untitled session</span>
                )}
                <div className={styles.meta}>
                  {event.project && (
                    <>
                      <span className={styles.projectTag}>{capitalize(event.project.name)}</span>
                      <span className={styles.metaDot}>·</span>
                    </>
                  )}
                  <span className={styles.metaDate}>
                    {detailed
                      ? formatDateRange(event.started_at, event.stopped_at)
                      : formatDate(event.started_at)}
                  </span>
                </div>
              </div>

              <div className={styles.itemRight}>
                <span className={styles.duration}>
                  {formatDuration(event.duration_seconds)}
                </span>
                <div className={styles.itemActions}>
                  <button
                    className={styles.iconBtn}
                    onClick={() => startEdit(event)}
                    aria-label="Edit session"
                    title="Edit session"
                  >
                    ✎
                  </button>
                  <button
                    className={styles.iconBtn}
                    onClick={() => handleDelete(event.tracking_event_id)}
                    aria-label="Delete session"
                    title="Delete session"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
