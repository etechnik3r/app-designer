/* Pfad-Zugriff auf das Config-Objekt.
   Pfade sind Punkt-Notation mit Zahlen fuer Array-Indizes:
     "flow.0.headline"   "puzzles.2.options.1"
   Das ist die gemeinsame Sprache von Editor, Bridge und Player:
   jede Aenderung ist ein {path, value}-Paar.                        */

export function splitPath(path) {
  return String(path).split(".").filter((s) => s !== "");
}

export function getPath(obj, path) {
  let cur = obj;
  for (const key of splitPath(path)) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[key];
  }
  return cur;
}

/* Setzt einen Wert und legt fehlende Zwischenebenen an.
   Zahl-Segmente erzeugen Arrays, alles andere Objekte. */
export function setPath(obj, path, value) {
  const keys = splitPath(path);
  if (keys.length === 0) throw new Error("setPath: leerer Pfad");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (cur[key] === null || typeof cur[key] !== "object") {
      cur[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
    }
    cur = cur[key];
  }
  cur[keys[keys.length - 1]] = value;
  return obj;
}

/* Entfernt einen Wert. Bei Arrays wird gespleisst, damit keine
   Luecken entstehen (undefined-Loecher brechen sonst das Rendering). */
export function delPath(obj, path) {
  const keys = splitPath(path);
  const parent = keys.length > 1 ? getPath(obj, keys.slice(0, -1).join(".")) : obj;
  if (parent === null || typeof parent !== "object") return obj;
  const last = keys[keys.length - 1];
  if (Array.isArray(parent)) parent.splice(Number(last), 1);
  else delete parent[last];
  return obj;
}

export function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

/* Verschiebt ein Array-Element. Gibt true zurueck, wenn sich etwas
   geaendert hat - der Aufrufer spart sich sonst den Re-Render. */
export function moveItem(arr, from, to) {
  if (!Array.isArray(arr)) return false;
  if (from === to) return false;
  if (from < 0 || from >= arr.length) return false;
  if (to < 0 || to >= arr.length) return false;
  const [item] = arr.splice(from, 1);
  arr.splice(to, 0, item);
  return true;
}

/* Kurze, kollisionsarme ID. Kein UUID noetig: der Namensraum ist
   ein einzelnes Party-Dokument mit selten mehr als 50 Objekten. */
export function newId(prefix) {
  const rnd = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rnd}`;
}
