import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { formatTime } from '../utils/text';

interface TimerContextValue {
  running: boolean;
  elapsed: number;
  startedAt: Date | null;
  taskDescription: string;
  selectedProjectId: string;
  setTaskDescription: (v: string) => void;
  setSelectedProjectId: (v: string) => void;
  start: () => void;
  stop: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

const STORAGE_KEY = 'tempo_timer_session';

interface StoredSession {
  startedAt: string;
  taskDescription: string;
  selectedProjectId: string;
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const startedAtRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore a running session that survived navigation or page refresh
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data: StoredSession = JSON.parse(stored);
        const date = new Date(data.startedAt);
        startedAtRef.current = date;
        setStartedAt(date);
        setElapsed(Math.floor((Date.now() - date.getTime()) / 1000));
        setTaskDescription(data.taskDescription ?? '');
        setSelectedProjectId(data.selectedProjectId ?? '');
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
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  }, [running, startedAt, taskDescription, selectedProjectId]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current!.getTime()) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  useEffect(() => {
    document.title = running ? `${formatTime(elapsed)} — Tempo` : 'Tempo';
  }, [running, elapsed]);

  function start() {
    const now = new Date();
    startedAtRef.current = now;
    setStartedAt(now);
    setElapsed(0);
    setRunning(true);
  }

  function stop() {
    startedAtRef.current = null;
    setStartedAt(null);
    localStorage.removeItem(STORAGE_KEY);
    setRunning(false);
    setElapsed(0);
    setTaskDescription('');
    setSelectedProjectId('');
  }

  return (
    <TimerContext.Provider value={{
      running,
      elapsed,
      startedAt,
      taskDescription,
      selectedProjectId,
      setTaskDescription,
      setSelectedProjectId,
      start,
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
