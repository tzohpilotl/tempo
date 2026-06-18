import { useState, useEffect, useRef } from 'react';
import { projects as projectsApi } from '../api/client';
import type { ProjectStats } from '../types';
import { capitalize } from '../utils/text';
import styles from './ProjectsPage.module.css';

export default function ProjectsPage() {
  const [stats, setStats] = useState<ProjectStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editError, setEditError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    projectsApi
      .stats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  function startEdit(p: ProjectStats) {
    setEditingId(p.project_id);
    setEditName(p.name);
    setEditError('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError('');
  }

  async function saveEdit(projectId: string) {
    const trimmed = editName.trim();
    if (!trimmed) { setEditError('Name cannot be empty'); return; }
    setSavingId(projectId);
    try {
      const updated = await projectsApi.update(projectId, trimmed);
      setStats((prev) =>
        prev.map((p) => (p.project_id === projectId ? { ...p, name: updated.name } : p)),
      );
      setEditingId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      setEditError(msg);
    } finally {
      setSavingId(null);
    }
  }

  async function confirmDelete(projectId: string) {
    try {
      await projectsApi.delete(projectId);
      setStats((prev) => prev.filter((p) => p.project_id !== projectId));
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
    <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>Projects</h1>
          <span className={styles.count}>{stats.length} project{stats.length !== 1 ? 's' : ''}</span>
        </header>

        {loading ? (
          <div className={styles.skeleton}>
            {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonRow} />)}
          </div>
        ) : stats.length === 0 ? (
          <div className={styles.empty}>
            <p>No projects yet. Start tracking to create one.</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {stats.map((p) => (
              <li key={p.project_id} className={styles.card}>
                <div className={styles.cardMain}>
                  {editingId === p.project_id ? (
                    <div className={styles.editRow}>
                      <input
                        ref={editInputRef}
                        className={`${styles.editInput} ${editError ? styles.editInputError : ''}`}
                        value={editName}
                        onChange={(e) => { setEditName(e.target.value); setEditError(''); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(p.project_id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                        maxLength={100}
                      />
                      <button
                        className={styles.saveBtn}
                        onClick={() => saveEdit(p.project_id)}
                        disabled={savingId === p.project_id}
                      >
                        {savingId === p.project_id ? '…' : 'Save'}
                      </button>
                      <button className={styles.cancelBtn} onClick={cancelEdit}>
                        Cancel
                      </button>
                      {editError && <span className={styles.editErrorMsg}>{editError}</span>}
                    </div>
                  ) : (
                    <span className={styles.projectName}>{capitalize(p.name)}</span>
                  )}

                  <div className={styles.statRow}>
                    <StatChip label="Created" value={formatDate(p.created_at)} />
                    <StatChip label="Time tracked" value={formatDuration(p.total_seconds)} />
                    <StatChip label="Sessions" value={String(p.event_count)} />
                  </div>
                </div>

                {editingId !== p.project_id && (
                  <div className={styles.actions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEdit(p)}
                      title="Rename project"
                    >
                      <PencilIcon />
                    </button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setDeletingId(p.project_id)}
                      title="Delete project"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Delete confirmation dialog */}
      {deletingId && (() => {
        const target = stats.find((p) => p.project_id === deletingId);
        return (
          <div className={styles.overlay} onClick={() => setDeletingId(null)}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.dialogTitle}>Delete project?</h2>
              <p className={styles.dialogBody}>
                <strong>{target ? capitalize(target.name) : ''}</strong> will be permanently deleted. Tracked sessions linked
                to this project will remain but become unassigned.
              </p>
              <div className={styles.dialogActions}>
                <button className={styles.dialogCancel} onClick={() => setDeletingId(null)}>
                  Cancel
                </button>
                <button
                  className={styles.dialogConfirm}
                  onClick={() => confirmDelete(deletingId)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <span className={styles.chip}>
      <span className={styles.chipLabel}>{label}</span>
      <span className={styles.chipValue}>{value}</span>
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(seconds: number) {
  if (seconds === 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}
