import { createUuid } from '@/utils/createUuid';
import { apiClient } from '@/api/client';

export type OfflineOperationKind = 'ISSUE_STOCK' | 'RETURN_STOCK' | 'RECORD_WASTAGE';
export interface OfflineOperation {
  id: string;
  kind: OfflineOperationKind;
  url: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'PENDING' | 'FAILED';
  error?: string;
}

const DB_NAME = 'surgery-intelligence-offline';
const STORE = 'outbox';
const CHANGE_EVENT = 'surgery-offline-outbox-change';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open offline storage.'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    run(tx.objectStore(STORE), resolve, reject);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error('Offline storage transaction aborted.')); };
  });
}

function changed() { window.dispatchEvent(new CustomEvent(CHANGE_EVENT)); }

export async function listOfflineOperations(): Promise<OfflineOperation[]> {
  return withStore('readonly', (store, resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve((request.result as OfflineOperation[]).sort((a,b) => a.createdAt.localeCompare(b.createdAt)));
    request.onerror = () => reject(request.error);
  });
}

export async function enqueueOfflineOperation(operation: OfflineOperation): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(operation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  changed();
}

async function updateOperation(operation: OfflineOperation): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(operation);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  changed();
}

async function removeOperation(id: string): Promise<void> {
  await withStore<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  changed();
}

let syncPromise: Promise<{ synced: number; failed: number }> | null = null;
export function syncOfflineOperations(): Promise<{ synced: number; failed: number }> {
  if (syncPromise) return syncPromise;
  syncPromise = (async () => {
    if (!navigator.onLine) return { synced: 0, failed: 0 };
    let synced = 0;
    let failed = 0;
    const operations = (await listOfflineOperations()).filter(op => op.status === 'PENDING');
    for (const operation of operations) {
      try {
        await apiClient.post(operation.url, operation.payload, { headers: { 'X-Offline-Operation-Id': operation.id } });
        await removeOperation(operation.id);
        synced += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Sync failed.';
        await updateOperation({ ...operation, status: 'FAILED', error: message });
        failed += 1;
        // Preserve order: later movements must not overtake a failed stock movement.
        break;
      }
    }
    return { synced, failed };
  })().finally(() => { syncPromise = null; });
  return syncPromise;
}

export async function retryFailedOfflineOperations(): Promise<void> {
  const all = await listOfflineOperations();
  for (const operation of all.filter(op => op.status === 'FAILED')) {
    await updateOperation({ ...operation, status: 'PENDING', error: undefined });
  }
  await syncOfflineOperations();
}

export function subscribeToOutbox(listener: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener('online', listener);
  window.addEventListener('offline', listener);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener('online', listener);
    window.removeEventListener('offline', listener);
  };
}

export async function queueStockOperation<T extends Record<string, unknown>>(
  kind: OfflineOperationKind,
  url: string,
  payload: T,
): Promise<{ queued: true; operationId: string }> {
  const id = String(payload.idempotencyKey || createUuid());
  await enqueueOfflineOperation({ id, kind, url, payload, createdAt: new Date().toISOString(), status: 'PENDING' });
  return { queued: true, operationId: id };
}

export async function postStockOperation<T extends Record<string, unknown>>(
  kind: OfflineOperationKind,
  url: string,
  payload: T,
): Promise<unknown> {
  if (!navigator.onLine) return queueStockOperation(kind, url, payload);
  try {
    const response = await apiClient.post(url, payload);
    return response.data.data;
  } catch (error: unknown) {
    const maybe = error as { response?: unknown; code?: string };
    if (!maybe.response && (maybe.code === 'ERR_NETWORK' || maybe.code === 'ECONNABORTED' || maybe.code === 'ERR_BAD_REQUEST' || error instanceof TypeError)) {
      return queueStockOperation(kind, url, payload);
    }
    throw error;
  }
}
