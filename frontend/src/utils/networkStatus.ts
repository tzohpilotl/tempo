import { useSyncExternalStore } from 'react';

/**
 * Tracks whether the last actual network request (any method, not just GETs)
 * reached the server — unlike navigator.onLine, this catches the common case
 * where the OS reports a healthy link but the server is unreachable (dead
 * Wi-Fi uplink, exhausted/throttled cellular data, etc.). There's only ever
 * one true answer for the whole app, so this is a plain module-level
 * singleton rather than something instantiated per consumer.
 */

type Listener = () => void;

let failing = false;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function reportNetworkSuccess(): void {
  if (failing) {
    failing = false;
    notify();
  }
}

export function reportNetworkFailure(): void {
  if (!failing) {
    failing = true;
    notify();
  }
}

export function isNetworkFailing(): boolean {
  return failing;
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIsNetworkFailing(): boolean {
  return useSyncExternalStore(subscribe, isNetworkFailing);
}
