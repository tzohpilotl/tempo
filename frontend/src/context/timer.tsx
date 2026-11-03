import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { formatTime } from '../utils/text';

interface TimerContextValue {
  running: boolean;
  paused: boolean;
  elapsed: number;
  startedAt: Date | null;
  taskDescription: string;
  selectedProjectId: string;
  setTaskDescription: (v: string) => void;
  setSelectedProjectId: (v: string) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  /** Clears the session and returns the final paused_seconds total — folding
   *  in the still-open pause gap, if the timer was paused at the moment of stop
   *  ("resume-then-stop", not left dangling). */
  stop: () => number;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY = 'tempo_timer_session';

interface StoredSession {
  startedAt: string;
  taskDescription: string;
  selectedProjectId: string;
  pausedSeconds: number;
  /** Set while currently paused; absent/null otherwise. */
  pausedSince: string | null;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const startedAtRef = useRef<Date | null>(null);
  const pausedSecondsRef = useRef(0);
  const pausedSinceRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const activeElapsed = (now: Date): number =>
    Math.floor((now.getTime() - startedAtRef.current!.getTime()) / 1000) -
    pausedSecondsRef.current;

  // Restore a running (possibly paused) session that survived navigation or page refresh
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredSession = JSON.parse(stored);
        const date = new Date(data.startedAt);
        const pausedSince = data.pausedSince ? new Date(data.pausedSince) : null;
        startedAtRef.current = date;
        pausedSecondsRef.current = data.pausedSeconds ?? 0;
        pausedSinceRef.current = pausedSince;
        setStartedAt(date);
        setTaskDescription(data.taskDescription ?? '');
        setSelectedProjectId(data.selectedProjectId ?? '');
        setPaused(pausedSince !== null);
        // Frozen at the moment the pause began if currently paused, otherwise live.
        setElapsed(activeElapsed(pausedSince ?? new Date()));
        setRunning(true);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Persist session state whenever it changes
  useEffect(() => {
    if (running && startedAt) {
      const session: StoredSession = {
        startedAt: startedAt.toISOString(),
        taskDescription,
        selectedProjectId,
        pausedSeconds: pausedSecondsRef.current,
        pausedSince: pausedSinceRef.current ? pausedSinceRef.current.toISOString() : null,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [running, paused, startedAt, taskDescription, selectedProjectId]);

  useEffect(() => {
    if (running && !paused) {
      intervalRef.current = setInterval(() => {
        setElapsed(activeElapsed(new Date()));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, paused]);

  useEffect(() => {
    document.title = running ? `${formatTime(elapsed)} — Tempo` : 'Tempo';
  }, [running, elapsed]);

  function start() {
    const now = new Date();
    startedAtRef.current = now;
    pausedSecondsRef.current = 0;
    pausedSinceRef.current = null;
    setStartedAt(now);
    setPaused(false);
    setElapsed(0);
    setRunning(true);
  }

  function pause() {
    if (!running || paused) return;
    const now = new Date();
    pausedSinceRef.current = now;
    setElapsed(activeElapsed(now));
    setPaused(true);
  }

  function resume() {
    if (!running || !paused || !pausedSinceRef.current) return;
    const gapSeconds = Math.floor((Date.now() - pausedSinceRef.current.getTime()) / 1000);
    pausedSecondsRef.current += gapSeconds;
    pausedSinceRef.current = null;
    setPaused(false);
  }

  function stop(): number {
    // Resume-then-stop: fold the still-open pause gap in rather than leaving it dangling.
    if (paused && pausedSinceRef.current) {
      const gapSeconds = Math.floor((Date.now() - pausedSinceRef.current.getTime()) / 1000);
      pausedSecondsRef.current += gapSeconds;
    }
    const finalPausedSeconds = pausedSecondsRef.current;

    startedAtRef.current = null;
    pausedSecondsRef.current = 0;
    pausedSinceRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setStartedAt(null);
    setPaused(false);
    setRunning(false);
    setElapsed(0);
    setTaskDescription('');
    setSelectedProjectId('');

    return finalPausedSeconds;
  }

  return (
    <TimerContext.Provider value={{
      running,
      paused,
      elapsed,
      startedAt,
      taskDescription,
      selectedProjectId,
      setTaskDescription,
      setSelectedProjectId,
      start,
      pause,
      resume,
      stop,
    }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}
