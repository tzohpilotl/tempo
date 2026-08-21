import { useState, useEffect, useRef, useCallback } from 'react';
import { tracking, ApiError } from '../api/client';
import type { Project, TrackingEvent } from '../types';
import { capitalize, formatTime } from '../utils/text';
import { logError } from '../utils/logger';
import { queueEventCreate } from '../utils/offlineQueue';
import { useTimer } from '../context/timer';
import styles from './Timer.module.css';

interface Props {
  projects: Project[];
  onEventLogged: (event: TrackingEvent) => void;
}

export default function Timer({ projects, onEventLogged }: Props) {
  const { running, elapsed, startedAt, start, stop,
          taskDescription, setTaskDescription,
          selectedProjectId, setSelectedProjectId } = useTimer();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const handleStart = () => {
    setError(null);
    start();
  };

  const handleStop = useCallback(async () => {
    if (!startedAt) return;
    const capturedStartedAt = startedAt;
    stop();
    setSaving(true);
    setError(null);

    const stoppedAt = new Date();

    try {
      const projectId = selectedProjectId || undefined;

      const payload = {
        started_at: capturedStartedAt.toISOString(),
        stopped_at: stoppedAt.toISOString(),
        task_description: taskDescription.trim() || undefined,
        project_id: projectId,
      };

      let event: TrackingEvent;
      try {
        event = await tracking.log(payload);
      } catch (err) {
        if (err instanceof ApiError) throw err; // real rejection (e.g. overlap) — surface as today
        event = await queueEventCreate(payload); // network-level failure — queue it for later sync
      }

      onEventLogged(event);
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      logError(err);
      setError('Failed to save the session. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [
    startedAt,
    stop,
    selectedProjectId,
    taskDescription,
    onEventLogged,
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving && !saved) {
              running ? handleStop() : handleStart();
            }
          }}
          maxLength={500}
          disabled={saving}
        />

        <div className={styles.projectRow}>
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
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {/* Play / Stop button */}
      <button
        className={`${styles.playBtn} ${running ? styles.stopBtn : ''} ${saved ? styles.savedBtn : ''}`}
        onClick={running ? handleStop : handleStart}
        disabled={saving || saved}
        aria-label={running ? 'Stop timer' : 'Start timer'}
      >
        {saving ? (
          <Spinner />
        ) : saved ? (
          <CheckIcon />
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

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function Spinner() {
  return <span className={styles.spinner} aria-label="Saving…" />;
}
