/* Verdrahtung des Editors.
   Ablauf einer Aenderung:
     Klick in der Vorschau  -> Player meldet {path,value}
     -> store.applyOps()    -> Historie, Autosave
     -> neuer Zustand an den Player und an die Spalten             */

import { h, clear } from "../player/dom.js";
import { getPath, newId } from "../shared/path.js";
import {
  store, subscribe, loadConfig, applyOps, setValue, setSelection, setView,
  setMode, setDevice, setLicense, markSaved, undo, redo, canUndo, canRedo,
} from "./store.js";
import { createBridge } from "./bridge.js";
import { renderFlowStrip } from "./flowstrip.js";
import { renderInspector } from "./inspector.js";
import { renderThemePanel } from "./themepanel.js";
import { modal, toast, confirmDialog, issuesDialog, unlockDialog } from "./dialogs.js";
import {
  saveProject, loadProject, listProjects, deleteProject,
  rememberLast, lastProjectId, requestPersistence,
} from "./storage.js";
import { buildSingleFile, buildZip, download, safeFileName, pruneUnusedAssets } from "./exporter.js";
import { emptyParty, migrate, validateParty, estimateSize, fmtBytes } from "../shared/schema.js";
import { verifyLicense, FREE_PUZZLE_LIMIT } from "../shared/license.js";
import { loadDemoParty } from "./demo.js";

/* Vor dem echten Verkauf durch den eigenen Stripe-Zahlungslink
   ersetzen; die Party-Kennung faehrt als client_reference_id mit,
   damit der Worker den Schluessel an die richtige Party bindet. */
const PAY_URL = "https://buy.stripe.com/test_00000000000000";

const el = (id) => document.getElementById(id);
const ui = {};
let bridge = null;
let rightTab = "content";
let saveTimer = null;
let pendingEcho = null;

/* ---------------- Vorschau ---------------- */

function setupBridge() {
  bridge = createBridge(el("preview"), {
    onReady: () => {
      /* Der iframe ist oft eher fertig als das Laden des Projekts.
         Ohne diese Bremse bekaeme der Player null geschickt. */
      if (!store.cfg) return;
      bridge.sendState(store.cfg);
      bridge.setMode(store.mode);
      bridge.goto(store.view);
    },
    onPatch: (path, value, editId) => {
      pendingEcho = editId;
      setValue(path, value, { coalesce: true, label: "Text geändert" });
    },
    onClick: (path) => {
      /* Auswahl im Player auf die Spalten spiegeln. Ein Klick auf
         einen Teilpfad waehlt das ganze Objekt - sonst zeigt der
         Inspektor bei "flow.1.cta" nichts Sinnvolles. */
      setSelection(path);
    },
    onView: (view) => { store.view = view; },
    onError: (msg) => toast(`Fehler in der Vorschau: ${msg.message}`, true),
  });
}

/* ---------------- Spalten neu zeichnen ---------------- */

function renderRightPane() {
  const pane = el("rightPane");
  if (rightTab === "design") renderThemePanel(pane);
  else renderInspector(pane);
}

function renderAll() {
  renderFlowStrip(el("flowstrip"), { onBuyPrompt: onBuyBlocked });
  renderRightPane();
  ui.title.value = store.cfg.meta.title || "";
  el("btnUndo").disabled = !canUndo();
  el("btnRedo").disabled = !canRedo();
  updateBuyButton();
  updateSavedLabel();
}

function updateBuyButton() {
  const button = el("btnBuy");
  if (store.license.ok) {
    button.textContent = "✓ freigeschaltet";
    button.classList.remove("tbtn--buy");
    button.classList.add("is-on");
  } else {
    button.textContent = "2 € freischalten";
    button.classList.add("tbtn--buy");
    button.classList.remove("is-on");
  }
}

function updateSavedLabel() {
  const size = estimateSize(store.cfg);
  ui.saved.textContent = `${store.dirty ? "…" : "gesichert"} · ${fmtBytes(size)}`;
  ui.saved.style.color = size > 8 * 1024 * 1024 ? "var(--e-warn)" : "";
}

/* ---------------- Autosave ---------------- */

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await saveProject(store.projectId, store.cfg, { name: store.cfg.meta.title });
      markSaved();
    } catch (err) {
      toast(`Speichern fehlgeschlagen: ${err.message}`, true);
    }
  }, 800);
}

/* ---------------- Projekte ---------------- */

async function openProject(id) {
  const record = await loadProject(id);
  if (!record) { toast("Projekt nicht gefunden.", true); return; }
  loadConfig(record.cfg, { projectId: id, projectName: record.name });
  rememberLast(id);
  await refreshLicense();
}

async function newProject(config) {
  const cfg = config || emptyParty();
  cfg.id = newId("p");
  const id = cfg.id;
  await saveProject(id, cfg, { name: cfg.meta.title });
  loadConfig(cfg, { projectId: id });
  rememberLast(id);
  await refreshLicense();
  toast("Neues Projekt angelegt.");
}

async function projectsDialog() {
  const projects = await listProjects();
  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });

  const close = () => document.querySelector(".modal")?.remove();

  body.append(
    h("div", { class: "rowline" },
      h("button", { class: "tbtn tbtn--primary", type: "button", text: "+ Leere Party",
        onclick: () => { close(); newProject(); } }),
      h("button", { class: "tbtn", type: "button", text: "Beispiel-Party laden",
        onclick: async () => { close(); newProject(await loadDemoParty()); } }),
      h("button", { class: "tbtn", type: "button", text: "Datei öffnen (.party.json)", onclick: () => { close(); importFile(); } }),
      h("button", { class: "tbtn", type: "button", text: "Aktuelle sichern", onclick: () => { close(); exportPartyFile(); } }),
    ),
    h("div", { class: "hr" }),
  );

  if (!projects.length) {
    body.appendChild(h("p", { text: "Noch keine Projekte in diesem Browser." }));
  }

  for (const project of projects) {
    body.appendChild(h("div", { class: "item" },
      h("span", { class: "ico", text: project.id === store.projectId ? "●" : "○" }),
      h("span", { class: "label" },
        h("div", { text: project.name }),
        h("div", { class: "type", text: `${project.puzzleCount} Rätsel · ${new Date(project.updatedAt).toLocaleString("de-DE")}` })),
      h("button", { class: "tbtn", type: "button", text: "Öffnen",
        onclick: () => { close(); openProject(project.id); } }),
      h("button", { class: "mini", type: "button", text: "🗑",
        onclick: async () => {
          if (await confirmDialog("Projekt löschen?", `„${project.name}" wird aus dem Browser entfernt. Gesicherte .party.json-Dateien bleiben erhalten.`, "Löschen")) {
            await deleteProject(project.id);
            close();
            toast("Projekt gelöscht.");
            if (project.id === store.projectId) await startUp();
          }
        } }),
    ));
  }

  body.appendChild(h("p", { class: "help",
    text: "Projekte liegen nur in diesem Browser. Browserdaten löschen nimmt sie mit — wichtige Partys zusätzlich als .party.json sichern." }));

  await modal({ title: "Projekte", body, wide: true, actions: [{ label: "Schließen", value: null }] });
}

function exportPartyFile() {
  const name = safeFileName(store.cfg.meta.title);
  download(`${name}.party.json`, JSON.stringify(store.cfg, null, 2), "application/json");
  toast("Party-Datei gesichert.");
}

function importFile() {
  const input = h("input", { type: "file", accept: ".json,application/json" });
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const cfg = migrate(JSON.parse(await file.text()));
      await newProject(cfg);
      toast(`„${cfg.meta.title}" geladen.`);
    } catch (err) {
      toast(`Datei nicht lesbar: ${err.message}`, true);
    }
  });
  input.click();
}

/* ---------------- Prüfen und Export ---------------- */

function jumpTo(path) {
  document.querySelector(".modal")?.remove();
  setSelection(path);
  const puzzle = String(path).match(/^puzzles\.(\d+)/);
  const flow = String(path).match(/^flow\.(\d+)/);
  if (puzzle) setView({ kind: "puzzle", idx: Number(puzzle[1]) });
  else if (flow) setView({ kind: "flow", idx: Number(flow[1]) });
}

async function checkParty({ silentIfClean = false } = {}) {
  const issues = validateParty(store.cfg);
  if (silentIfClean && !issues.length) return true;
  if (silentIfClean && !issues.some((i) => i.level === "error")) return true;
  await issuesDialog(issues, jumpTo);
  return !issues.some((i) => i.level === "error");
}

async function exportDialog() {
  const issues = validateParty(store.cfg);
  const errors = issues.filter((i) => i.level === "error");
  if (errors.length) {
    await issuesDialog(issues, jumpTo);
    toast("Erst die Fehler beheben, dann klappt der Export.", true);
    return;
  }

  const size = estimateSize(store.cfg);
  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h("p", { text: `Geschätzte Größe: ${fmtBytes(size)}.` }),
    h("div", { class: "item", onclick: () => { document.querySelector(".modal")?.remove(); doExport("single"); } },
      h("span", { class: "ico", text: "📄" }),
      h("span", { class: "label" },
        h("div", { text: "Eine einzige HTML-Datei" }),
        h("div", { class: "type", text: "Per AirDrop oder Mail aufs Tablet, doppelklicken, läuft. Ohne Video-Dateien." }))),
    h("div", { class: "item", onclick: () => { document.querySelector(".modal")?.remove(); doExport("zip"); } },
      h("span", { class: "ico", text: "🗜" }),
      h("span", { class: "label" },
        h("div", { text: "ZIP-Paket für Webspace und Tablet-App" }),
        h("div", { class: "type", text: "Mit Symbolen, Offline-Betrieb, Video-Ordner und Lösungsblatt." }))),
    h("div", { class: "item", onclick: () => { document.querySelector(".modal")?.remove(); exportPartyFile(); } },
      h("span", { class: "ico", text: "💾" }),
      h("span", { class: "label" },
        h("div", { text: "Party-Datei zur Sicherung (.party.json)" }),
        h("div", { class: "type", text: "Zum Weiterbearbeiten auf einem anderen Rechner." }))),
    store.license.ok ? null : h("p", { class: "help", text: "Der Export enthält das Wasserzeichen. Für 2 € entfällt es." }),
  );

  await modal({ title: "Export", body, wide: true, actions: [{ label: "Abbrechen", value: null }] });
}

async function doExport(kind) {
  try {
    const name = safeFileName(store.cfg.meta.title);
    /* Verwaiste Bilder wuerden sonst unbemerkt mitfahren. */
    const cleaned = { ...store.cfg, assets: pruneUnusedAssets(store.cfg) };

    if (kind === "single") {
      download(`${name}.html`, await buildSingleFile(cleaned), "text/html;charset=utf-8");
      toast("HTML-Datei erzeugt.");
    } else {
      const zip = await buildZip(cleaned);
      download(`${name}.zip`, new Blob([zip], { type: "application/zip" }));
      toast("ZIP-Paket erzeugt.");
    }
  } catch (err) {
    toast(err.message, true);
  }
}

/* ---------------- Lizenz ---------------- */

async function refreshLicense() {
  const state = await verifyLicense(store.cfg.branding?.license, { partyId: store.cfg.id });
  setLicense(state);
}

async function applyToken(token) {
  const state = await verifyLicense(token, { partyId: store.cfg.id });
  if (!state.ok) {
    toast(`Schlüssel nicht gültig: ${state.reason}`, true);
    return false;
  }
  applyOps({ op: "set", path: "branding.license", value: token }, { label: "Freigeschaltet" });
  setLicense(state);
  toast("Freigeschaltet. Das Wasserzeichen ist weg.");
  return true;
}

function openBuyDialog() {
  if (store.license.ok) {
    modal({
      title: "Bereits freigeschaltet",
      body: h("p", { text: `Freigeschaltet: ${store.license.features.join(", ")}.` }),
    });
    return;
  }
  unlockDialog({
    payUrl: `${PAY_URL}?client_reference_id=${encodeURIComponent(store.cfg.id)}`,
    partyId: store.cfg.id,
    onToken: applyToken,
  });
}

function onBuyBlocked() {
  modal({
    title: "Mehr Rätsel",
    body: h("p", { text: `In der Gratis-Version sind ${FREE_PUZZLE_LIMIT} Rätsel möglich. Mit der Freischaltung für 2 € sind es beliebig viele — dazu entfällt das Wasserzeichen.` }),
    actions: [
      { label: "Später", value: null },
      { label: "Freischalten", value: "buy", primary: true },
    ],
  }).then((result) => { if (result === "buy") openBuyDialog(); });
}

/* ---------------- Werkzeugleiste ---------------- */

function wireToolbar() {
  ui.title = el("partyTitle");
  ui.saved = el("savedState");

  ui.title.addEventListener("input", () =>
    setValue("meta.title", ui.title.value, { coalesce: true, label: "Name geändert" }));

  el("modeEdit").addEventListener("click", () => setMode("edit"));
  el("modePlay").addEventListener("click", () => setMode("play"));

  el("devTablet").addEventListener("click", () => setDevice("tablet"));
  el("devPhone").addEventListener("click", () => setDevice("phone"));
  el("devFull").addEventListener("click", () => setDevice("full"));

  el("btnUndo").addEventListener("click", () => undo());
  el("btnRedo").addEventListener("click", () => redo());
  el("btnProjects").addEventListener("click", projectsDialog);
  el("btnCheck").addEventListener("click", () => checkParty());
  el("btnExport").addEventListener("click", exportDialog);
  el("btnBuy").addEventListener("click", openBuyDialog);

  el("tabContent").addEventListener("click", () => { rightTab = "content"; syncTabs(); renderRightPane(); });
  el("tabDesign").addEventListener("click", () => { rightTab = "design"; syncTabs(); renderRightPane(); });

  document.addEventListener("keydown", (event) => {
    const typing = /^(INPUT|TEXTAREA)$/.test(event.target.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      if (typing && !event.shiftKey) return;     // Browser-Undo im Feld nicht kapern
      event.preventDefault();
      event.shiftKey ? redo() : undo();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      exportPartyFile();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (store.dirty) { event.preventDefault(); event.returnValue = ""; }
  });
}

function syncTabs() {
  el("tabContent").classList.toggle("is-on", rightTab === "content");
  el("tabDesign").classList.toggle("is-on", rightTab === "design");
}

function syncModeButtons() {
  el("modeEdit").classList.toggle("is-on", store.mode === "edit");
  el("modePlay").classList.toggle("is-on", store.mode === "play");
  for (const [id, device] of [["devTablet", "tablet"], ["devPhone", "phone"], ["devFull", "full"]]) {
    el(id).classList.toggle("is-on", store.device === device);
  }
  el("device").className = `device device--${store.device}`;
}

/* ---------------- Start ---------------- */

async function startUp() {
  const previous = lastProjectId();
  if (previous) {
    const record = await loadProject(previous);
    if (record) { await openProject(previous); return; }
  }
  const projects = await listProjects();
  if (projects.length) { await openProject(projects[0].id); return; }
  await newProject(await loadDemoParty());
}

async function init() {
  wireToolbar();
  setupBridge();
  requestPersistence();

  subscribe((reason) => {
    if (reason === "change" || reason === "load") scheduleSave();

    if (reason === "mode") { bridge.setMode(store.mode); syncModeButtons(); return; }
    if (reason === "device") { syncModeButtons(); return; }
    if (reason === "view") { bridge.goto(store.view); return; }
    if (reason === "selection") { bridge.select(store.selection); renderRightPane(); return; }
    if (reason === "saved") { updateSavedLabel(); return; }

    /* Zustandsaenderung: Player zuerst, damit die Vorschau nicht
       hinter der Oberflaeche herhinkt. */
    bridge.sendState(store.cfg, pendingEcho);
    pendingEcho = null;
    renderAll();
  });

  await startUp();
  syncTabs();
  syncModeButtons();
  renderAll();

  /* Schluessel aus der Rueckleitung von Stripe uebernehmen. */
  const token = new URLSearchParams(location.search).get("license");
  if (token) {
    const ok = await applyToken(token);
    if (ok) history.replaceState(null, "", location.pathname);
  }
}

init().catch((err) => {
  document.body.innerHTML =
    `<div class="empty" style="padding:40px">Der Editor konnte nicht starten:<br><b>${err.message}</b><br><br>` +
    `Läuft die Seite über einen Webserver? Direkt per Doppelklick geöffnet blockieren Browser ES-Module und IndexedDB.<br>` +
    `<code>npm start</code> oder <code>python3 -m http.server 8080</code></div>`;
  console.error(err);
});
