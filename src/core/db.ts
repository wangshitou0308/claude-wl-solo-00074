// IndexedDB 封装：资料仅保存在本机浏览器，无任何网络上报。
const DB_NAME = 'rice-cooker-guide';
const DB_VERSION = 1;
const STORE = 'kv';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  return tx<T | undefined>('readonly', (s) => s.get(key) as IDBRequest<T | undefined>);
}

export async function idbSet<T>(key: string, value: T): Promise<void> {
  await tx('readwrite', (s) => s.put(value, key));
}

export async function idbDel(key: string): Promise<void> {
  await openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(STORE, 'readwrite');
        const r = t.objectStore(STORE).delete(key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
      }),
  );
}

export const KEYS = {
  profiles: 'profiles',
  activeProfile: 'activeProfile',
  session: 'session',
} as const;
