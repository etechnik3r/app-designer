/* Bearbeitungsmodus des Players.
   Der Player laeuft im Editor in einem iframe. Dieses Modul macht
   aus ihm eine bearbeitbare Flaeche:
     - Klick waehlt aus, statt zu spielen
     - Textknoten werden direkt beschreibbar (contenteditable)
     - jede Aenderung geht als {path, value} an den Editor

   Zustandshaltung bleibt ausschliesslich beim Editor. Der Player
   schickt Absichten und bekommt fertige Zustaende zurueck -
   eine Einbahnstrasse, die Synchronisationsfehler ausschliesst.   */

import { P, setConfig, setMode, gotoFlow, gotoPuzzle, onRender, render } from "./player.js";
import { getPath } from "../shared/path.js";

const EDITABLE_TAGS = new Set(["H1", "H2", "H3", "P", "SPAN", "DIV", "BUTTON", "LI"]);

let selectedPath = null;
let editId = 0;
let pendingEditId = null;
let overlay = null;

function send(message) {
  if (window.parent === window) return;
  window.parent.postMessage({ __party: true, ...message }, "*");
}

/* ---- Auswahlrahmen ------------------------------------------------
   Als eigene Ebene ueber dem Inhalt, nicht als Rahmen am Element:
   sonst verschiebt die Auswahl das Layout.                          */

function ensureOverlay() {
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.className = "sel-overlay";
  overlay.hidden = true;
  document.body.appendChild(overlay);
  return overlay;
}

function paintOverlay() {
  const box = ensureOverlay();
  const el = selectedPath ? document.querySelector(`[data-bind="${cssEscape(selectedPath)}"]`) : null;
  if (!el) { box.hidden = true; return; }
  const rect = el.getBoundingClientRect();
  Object.assign(box.style, {
    left: `${rect.left - 3}px`, top: `${rect.top - 3}px`,
    width: `${rect.width + 6}px`, height: `${rect.height + 6}px`,
  });
  box.hidden = false;
}

function cssEscape(value) {
  return String(value).replace(/["\\]/g, "\\$&");
}

/* ---- Auswahl und Inline-Bearbeitung ------------------------------ */

function isTextEditable(el, path) {
  if (!EDITABLE_TAGS.has(el.tagName)) return false;
  if (typeof getPath(P.cfg, path) !== "string") return false;
  return [...el.childNodes].every((n) => n.nodeType === Node.TEXT_NODE);
}

function stopEditing() {
  for (const el of document.querySelectorAll('[contenteditable="true"]')) {
    el.removeAttribute("contenteditable");
  }
}

export function select(path, { startEditing = false } = {}) {
  stopEditing();
  selectedPath = path;
  paintOverlay();
  if (!path) return;

  const el = document.querySelector(`[data-bind="${cssEscape(path)}"]`);
  if (el && startEditing && isTextEditable(el, path)) {
    el.setAttribute("contenteditable", "true");
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

function onInput(event) {
  const el = event.target.closest?.("[data-bind]");
  if (!el || el.getAttribute("contenteditable") !== "true") return;
  pendingEditId = ++editId;
  send({ type: "patch", path: el.dataset.bind, value: el.textContent, editId: pendingEditId });
}

/* Aus Word eingefuegter Text bringt sonst Markup mit. */
function onPaste(event) {
  const el = event.target.closest?.('[contenteditable="true"]');
  if (!el) return;
  event.preventDefault();
  const text = (event.clipboardData || window.clipboardData).getData("text/plain");
  document.execCommand("insertText", false, text.replace(/\s+/g, " "));
}

function onClickCapture(event) {
  if (P.mode !== "edit") return;
  const target = event.target;
  if (target.closest?.('[contenteditable="true"]')) return;   // Cursor setzen erlauben

  event.preventDefault();
  event.stopPropagation();

  const el = target.closest?.("[data-bind]");
  if (!el) { select(null); send({ type: "click", path: null }); return; }

  const path = el.dataset.bind;
  select(path, { startEditing: true });
  send({ type: "click", path });
}

function onDblClickCapture(event) {
  if (P.mode !== "edit") return;
  const el = event.target.closest?.("[data-bind]");
  const match = el?.dataset.bind?.match(/^puzzles\.(\d+)$/);
  if (match) {
    event.preventDefault();
    event.stopPropagation();
    gotoPuzzle(Number(match[1]));
  }
}

function onKeyDown(event) {
  if (event.key === "Escape") { stopEditing(); select(null); }
  if (event.key === "Enter" && document.activeElement?.getAttribute("contenteditable") === "true") {
    event.preventDefault();
    document.activeElement.blur();
    stopEditing();
  }
}

/* ---- Nachrichten vom Editor -------------------------------------- */

function onMessage(event) {
  const msg = event.data;
  if (!msg || msg.__party !== true) return;

  switch (msg.type) {
    case "state": {
      /* Echo der eigenen Inline-Eingabe: Zustand uebernehmen, aber
         NICHT neu zeichnen - sonst springt der Cursor. */
      const isEcho = msg.echo != null && msg.echo === pendingEditId;
      setConfig(msg.config, { rerender: !isEcho });
      if (!isEcho) { pendingEditId = null; restoreSelection(); }
      break;
    }
    case "mode":
      stopEditing();
      setMode(msg.mode);
      break;
    case "goto":
      stopEditing();
      if (msg.view?.kind === "puzzle") gotoPuzzle(msg.view.idx);
      else gotoFlow(msg.view?.idx ?? 0);
      break;
    case "select":
      /* Der Editor spiegelt jede Auswahl zurueck - auch die, die
         gerade hier entstanden ist. Ohne diese Bremse wuerde das
         Echo die eben begonnene Inline-Bearbeitung sofort wieder
         beenden und der erste Tastendruck ginge verloren. */
      if (msg.path === selectedPath) { paintOverlay(); break; }
      restoreSelectionTo(msg.path);
      break;
    case "rerender":
      render();
      break;
    default:
      break;
  }
}

function restoreSelection() {
  if (selectedPath) paintOverlay();
}

function restoreSelectionTo(path) {
  /* Falls der Pfad auf einem anderen Bildschirm liegt, dorthin
     wechseln - sonst waehlt der Editor ins Leere. */
  const puzzleMatch = String(path || "").match(/^puzzles\.(\d+)/);
  const flowMatch = String(path || "").match(/^flow\.(\d+)/);
  if (puzzleMatch && P.view.kind !== "puzzle") gotoPuzzle(Number(puzzleMatch[1]));
  else if (flowMatch && (P.view.kind !== "flow" || P.view.idx !== Number(flowMatch[1]))) {
    gotoFlow(Number(flowMatch[1]));
  }
  select(path);
}

/* ---- Einhaengen --------------------------------------------------- */

export function installEditMode() {
  document.addEventListener("click", onClickCapture, true);
  document.addEventListener("dblclick", onDblClickCapture, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("paste", onPaste, true);
  document.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("message", onMessage);
  window.addEventListener("resize", paintOverlay);
  window.addEventListener("scroll", paintOverlay, true);

  onRender(() => {
    requestAnimationFrame(() => {
      paintOverlay();
      send({ type: "view", view: { ...P.view } });
    });
  });

  window.addEventListener("error", (event) => {
    send({ type: "error", message: event.message, source: event.filename, line: event.lineno });
  });

  send({ type: "ready" });
}
