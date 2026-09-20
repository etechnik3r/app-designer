/* Zustand des Editors.
   Einzige Wahrheitsquelle ist store.cfg. Der Player im iframe haelt
   nur eine Kopie und schickt Aenderungswuensche hierher zurueck.

   Jede Aenderung laeuft als Operation ueber applyOps() und erzeugt
   dabei ihre eigene Umkehrung - daraus besteht die Rueckgaengig-
   Historie. Schnappschuesse waeren einfacher, wuerden aber bei
   eingebetteten Bildern jedes Tastendruck-Megabyte kopieren.      */

import { getPath, setPath, clone, moveItem } from "../shared/path.js";
import { normalize } from "../shared/schema.js";

export const store = {
  cfg: null,
  projectId: null,
  projectName: "",
  selection: null,
  view: { kind: "flow", idx: 0 },
  mode: "edit",
  device: "tablet",
  license: { ok: false, features: [], reason: "keine Lizenz hinterlegt" },
  dirty: false,
};

const listeners = new Set();
const undoStack = [];
const redoStack = [];
const HISTORY_LIMIT = 80;
let lastEntry = null;

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emit(reason) {
  for (const callback of listeners) callback(reason);
}

/* ---- Operationen ------------------------------------------------- */

function parentOf(cfg, path) {
  const parts = String(path).split(".");
  const key = parts.pop();
  const parent = parts.length ? getPath(cfg, parts.join(".")) : cfg;
  return { parent, key };
}

function applyOp(cfg, op) {
  switch (op.op) {
    case "set": {
      const old = getPath(cfg, op.path);
      setPath(cfg, op.path, op.value);
      return { op: "set", path: op.path, value: clone(old) };
    }
    case "delkey": {
      const { parent, key } = parentOf(cfg, op.path);
      const old = parent?.[key];
      if (parent) delete parent[key];
      return { op: "set", path: op.path, value: clone(old) };
    }
    case "insert": {
      const arr = getPath(cfg, op.path);
      if (!Array.isArray(arr)) throw new Error(`insert: ${op.path} ist kein Array`);
      const index = op.index ?? arr.length;
      arr.splice(index, 0, clone(op.value));
      return { op: "remove", path: op.path, index };
    }
    case "remove": {
      const arr = getPath(cfg, op.path);
      if (!Array.isArray(arr)) throw new Error(`remove: ${op.path} ist kein Array`);
      const old = clone(arr[op.index]);
      arr.splice(op.index, 1);
      return { op: "insert", path: op.path, index: op.index, value: old };
    }
    case "move": {
      const arr = getPath(cfg, op.path);
      moveItem(arr, op.from, op.to);
      return { op: "move", path: op.path, from: op.to, to: op.from };
    }
    default:
      throw new Error(`Unbekannte Operation "${op.op}"`);
  }
}

/* coalesceKey: aufeinanderfolgende Aenderungen mit gleichem Schluessel
   werden in der Historie zusammengefasst. Ohne das macht
   Rueckgaengig bei Texteingaben Buchstabe fuer Buchstabe rueckwaerts. */
export function applyOps(ops, { label = "Änderung", coalesceKey = null, silent = false } = {}) {
  const list = Array.isArray(ops) ? ops : [ops];
  if (!list.length) return;

  const inverses = list.map((op) => applyOp(store.cfg, op)).reverse();
  const now = Date.now();

  const mergeable =
    coalesceKey &&
    lastEntry &&
    lastEntry.coalesceKey === coalesceKey &&
    now - lastEntry.at < 700 &&
    undoStack[undoStack.length - 1] === lastEntry;

  if (mergeable) {
    /* Die aeltere Umkehrung gewinnt: sie fuehrt zum Zustand vor dem
       ersten Tastendruck der Folge. */
    lastEntry.at = now;
  } else {
    const entry = { inverses, label, coalesceKey, at: now };
    undoStack.push(entry);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    lastEntry = entry;
  }

  redoStack.length = 0;
  store.dirty = true;
  if (!silent) emit("change");
}

export function undo() {
  const entry = undoStack.pop();
  if (!entry) return false;
  const redo = entry.inverses.map((op) => applyOp(store.cfg, op)).reverse();
  redoStack.push({ ...entry, inverses: redo });
  lastEntry = null;
  store.dirty = true;
  emit("change");
  return true;
}

export function redo() {
  const entry = redoStack.pop();
  if (!entry) return false;
  const undoOps = entry.inverses.map((op) => applyOp(store.cfg, op)).reverse();
  undoStack.push({ ...entry, inverses: undoOps });
  lastEntry = null;
  store.dirty = true;
  emit("change");
  return true;
}

export const canUndo = () => undoStack.length > 0;
export const canRedo = () => redoStack.length > 0;

export function historyLabel() {
  return undoStack[undoStack.length - 1]?.label || null;
}

/* ---- Bequeme Kurzform fuer einzelne Felder ----------------------- */

export function setValue(path, value, { coalesce = false, label } = {}) {
  applyOps({ op: "set", path, value }, {
    label: label || `${path} geändert`,
    coalesceKey: coalesce ? path : null,
  });
}

/* ---- Dokument laden ---------------------------------------------- */

export function loadConfig(cfg, { projectId = null, projectName = null } = {}) {
  store.cfg = normalize(clone(cfg));
  store.projectId = projectId;
  store.projectName = projectName || store.cfg.meta?.title || "Party";
  store.selection = null;
  store.view = { kind: "flow", idx: 0 };
  store.dirty = false;
  undoStack.length = 0;
  redoStack.length = 0;
  lastEntry = null;
  emit("load");
}

export function setSelection(path) {
  store.selection = path || null;
  emit("selection");
}

export function setView(view) {
  store.view = view;
  emit("view");
}

export function setMode(mode) {
  store.mode = mode === "play" ? "play" : "edit";
  emit("mode");
}

export function setDevice(device) {
  store.device = device;
  emit("device");
}

export function setLicense(state) {
  store.license = state;
  emit("license");
}

export function markSaved() {
  store.dirty = false;
  emit("saved");
}

export function notify(reason) {
  emit(reason);
}
