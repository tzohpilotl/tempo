import { useState, useEffect, useRef, useCallback } from 'react';
import { tracking, projects as projectsApi } from '../api/client';
import type { Project, TrackingEvent } from '../types';
import { capitalize } from '../utils/text';
import styles from './Timer.module.css';

interface Props {
  projects: Project[];
  onEventLogged: (event: TrackingEvent) => void;
  onProjectCreated: (project: Project) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Timer({ projects, onEventLogged, onProjectCreated }: Props) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tick every second while running
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const handleStart = () => {
    startedAtRef.current = new Date();
    setElapsed(0);
    setError(null);
    setRunning(true);
  };

  const handleStop = useCallback(async () => {
    if (!startedAtRef.current) return;
    setRunning(false);
    setSaving(true);
    setError(null);

    const stoppedAt = new Date();

    try {
      // If user typed a new project name, create it first
      let projectId = selectedProjectId || undefined;
      if (showNewProject && newProjectName.trim()) {
        const created = await projectsApi.create(newProjectName.trim());
        onProjectCreated(created);
        projectId = created.project_id;
        setNewProjectName('');
        setShowNewProject(false);
      }

      const event = await tracking.log({
        started_at: startedAtRef.current.toISOString(),
        stopped_at: stoppedAt.toISOString(),
        task_description: taskDescription.trim() || undefined,
        project_id: projectId,
      });

      onEventLogged(event);
      // Reset inputs after successful log
      setTaskDescription('');
      setSelectedProjectId('');
      setElapsed(0);
    } catch {
      setError('Failed to save the session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    selectedProjectId,
    showNewProject,
    newProjectName,
    taskDescription,
    onEventLogged,
    onProjectCreated,
  ]);

  return (
    <div className={styles.root}>
      {/* Timer display */}
      <div className={`${styles.display} ${running ? styles.running : ''}`}>
        <span className={styles.time}>{formatTime(elapsed)}</span>
        {running && <span className={styles.pulse} aria-hidden />}
      </div>

      {/* Inputs — task and project */}
      <div className={styles.inputs}>
        <input
          className={styles.taskInput}
          type="text"
          placeholder="What are you working on?"
          value={taskDescription}
          onChange={(e) => setTaskDescription(e.target.value)}
          maxLength={500}
          disabled={saving}
        />

        <div className={styles.projectRow}>
          {!showNewProject ? (
            <>
              <select
                className={styles.projectSelect}
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={saving}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.project_id} value={p.project_id}>
                    {capitalize(p.name)}
                  </option>
                ))}
              </select>
              <button
                className={styles.newProjectToggle}
                onClick={() => setShowNewProject(true)}
                type="button"
                disabled={saving}
                title="Create new project"
              >
                + New
              </button>
            </>
          ) : (
            <>
              <input
                className={styles.newProjectInput}
                type="text"
                placeholder="New project name…"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
                maxLength={100}
                disabled={saving}
              />
              <button
                className={styles.newProjectToggle}
                onClick={() => { setShowNewProject(false); setNewProjectName(''); }}
                type="button"
                disabled={saving}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Play / Stop button */}
      <button
        className={`${styles.playBtn} ${running ? styles.stopBtn : ''}`}
        onClick={running ? handleStop : handleStart}
        disabled={saving}
        aria-label={running ? 'Stop timer' : 'Start timer'}
      >
        {saving ? (
          <Spinner />
        ) : running ? (
          <StopIcon />
        ) : (
          <PlayIcon />
        )}
      </button>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-label="Saving…" />;
}
