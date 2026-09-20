/* Einstiegspunkt des Players.
   Woher die Party kommt, haengt davon ab, wie der Player laeuft:

     1. Export        -> JSON steckt im Dokument (#party-config)
     2. Editor-iframe -> der Editor schickt den Zustand per Nachricht
     3. Direktaufruf  -> ?src=…json laedt eine Datei zum Ausprobieren
*/

import { mountPlayer } from "./player.js";
import { installEditMode } from "./editmode.js";
import { emptyParty, migrate } from "../shared/schema.js";

function inlineConfig() {
  const tag = document.getElementById("party-config");
  if (!tag) return null;
  const raw = tag.textContent.trim();
  if (!raw || raw.startsWith("__PARTY")) return null;    // unersetzter Platzhalter
  try {
    return migrate(JSON.parse(raw));
  } catch (err) {
    console.error("Party-Daten im Dokument sind unlesbar:", err);
    return null;
  }
}

async function loadFromUrl(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return migrate(await response.json());
  } catch (err) {
    console.error(`Party-Datei ${url} nicht ladbar:`, err);
    return null;
  }
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const mode = params.get("mode") === "edit" ? "edit" : "play";
  const root = document.getElementById("app");

  let cfg = inlineConfig();
  if (!cfg && params.get("src")) cfg = await loadFromUrl(params.get("src"));
  if (!cfg) cfg = emptyParty(mode === "edit" ? "Neue Rätsel-Party" : "Beispiel-Party");

  await mountPlayer(root, cfg, { mode });
  if (mode === "edit") installEditMode();
}

boot();
