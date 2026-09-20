/* Projektablage im Browser.
   IndexedDB statt localStorage: eingebettete Bilder sprengen die
   5-MB-Grenze von localStorage sofort.

   Wichtig und im Konzept eigens vermerkt: Browser-Speicher ist
   fluechtig. iOS raeumt IndexedDB nach sieben Tagen ohne Besuch ab,
   "Browserdaten loeschen" nimmt alles mit. Deshalb bittet der Editor
   um dauerhaften Speicher UND draengt auf die .party.json-Sicherung. */

const DB_NAME = "party-baukasten";
const DB_VERSION = 1;
const STORE = "projects";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx(mode, run) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = run(transaction.objectStore(STORE));
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

export async function requestPersistence() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* nicht schlimm */ }
  return false;
}

export async function storageEstimate() {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    return { usage, quota };
  } catch {
    return { usage: null, quota: null };
  }
}

export function saveProject(id, cfg, { name } = {}) {
  const record = {
    id,
    name: name || cfg.meta?.title || "Party",
    updatedAt: Date.now(),
    cfg,
  };
  return tx("readwrite", (store) => store.put(record)).then(() => record);
}

export function loadProject(id) {
  return tx("readonly", (store) => store.get(id));
}

export function deleteProject(id) {
  return tx("readwrite", (store) => store.delete(id));
}

export async function listProjects() {
  const all = await tx("readonly", (store) => store.getAll());
  return (all || []).sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, name, updatedAt, cfg }) => ({
      id, name, updatedAt,
      puzzleCount: cfg?.puzzles?.length || 0,
    }));
}

/* Zuletzt geoeffnetes Projekt - darf ruhig in localStorage stehen,
   es ist nur ein Zeiger. */
export function rememberLast(id) {
  try { localStorage.setItem("party-baukasten.last", id); } catch { /* egal */ }
}

export function lastProjectId() {
  try { return localStorage.getItem("party-baukasten.last"); } catch { return null; }
}
