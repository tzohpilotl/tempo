import { describe, it, expect } from 'vitest';
import { getCached, setCached } from './offlineCache';

describe('offlineCache', () => {
  it('returns undefined for a key that was never cached', async () => {
    await expect(getCached('/never-cached')).resolves.toBeUndefined();
  });

  it('round-trips a value written by the current app version', async () => {
    await setCached('/projects', [{ project_id: '1' }]);
    await expect(getCached('/projects')).resolves.toEqual([{ project_id: '1' }]);
  });

  it('treats a record written by a different app version as a miss', async () => {
    // Simulate a record left behind by an older deploy by writing directly to
    // the underlying store, bypassing setCached's current-version stamp.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('tempo-offline-cache', 1);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('responses', 'readwrite');
      tx.objectStore('responses').put({
        key: '/stale-version',
        value: { old: true },
        appVersion: 'some-old-version',
        updatedAt: 0,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await expect(getCached('/stale-version')).resolves.toBeUndefined();
  });
});
