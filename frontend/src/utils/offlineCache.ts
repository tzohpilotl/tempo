import { logError } from './logger';

const DB_NAME = 'tempo-offline-cache';
const DB_VERSION = 1;
const STORE_NAME = 'responses';

interface CacheRecord {
  key: string;
  value: unknown;
  /** __APP_VERSION__ this record was written under — a record from a different
   *  app version may no longer match the shape current code expects. */
  appVersion: string;
  updatedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteCached(key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Last-known-good response for a given request path, or undefined if none
 * cached — including when the cached record was written by a different app
 * version, since its shape is no longer guaranteed to match.
 */
export async function getCached<T>(key: string): Promise<T | undefined> {
  try {
    const db = await openDb();
    const record = await new Promise<CacheRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (!record) return undefined;

    if (record.appVersion !== __APP_VERSION__) {
      // Stale housekeeping only — the return value below doesn't depend on
      // this completing, so it doesn't need to be awaited.
      deleteCached(key).catch(logError);
      return undefined;
    }

    return record.value as T;
  } catch (err) {
    logError(err);
    return undefined;
  }
}

/** Stores the latest successful response for a GET request path. Best-effort — failures are logged, not thrown. */
export async function setCached(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    const record: CacheRecord = { key, value, appVersion: __APP_VERSION__, updatedAt: Date.now() };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    logError(err);
  }
}
