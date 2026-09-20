/* Das Party-Dokument: einziges Datenmodell des Baukastens.
   Der Editor bearbeitet es, der Player fuehrt es aus, der Export
   bettet es ein. Alles andere ist Darstellung.                     */

import { newId } from "./path.js";
import { PUZZLES, puzzleDef } from "../puzzles/index.js";

export const SCHEMA_VERSION = 1;

/* Bildschirmtypen im Ablauf. Die Reihenfolge ist Daten, nicht Code -
   genau das unterscheidet den Baukasten von einer fixen Vorlage. */
export const SCREEN_TYPES = {
  start:    { label: "Startbildschirm", icon: "▶", unique: true },
  video:    { label: "Video",           icon: "🎬", unique: false },
  overview: { label: "Rätselübersicht", icon: "🧩", unique: true },
  final:    { label: "Abschluss",       icon: "🏁", unique: true },
};

export function defaultScreen(type) {
  const id = newId("s");
  switch (type) {
    case "start":
      return { id, type: "start", headline: "Die geheime Mission",
               sub: "Euer Team wird im Labor gebraucht.", cta: "Mission starten" };
    case "video":
      return { id, type: "video", source: { kind: "none" },
               skippable: true, autoplay: true, cta: "Weiter" };
    case "overview":
      return { id, type: "overview", headline: "Wählt ein Rätsel",
               mode: "free", finalCta: "Zum Abschluss" };
    case "final":
      return { id, type: "final", headline: "Geschafft!",
               text: "Ihr habt alle Rätsel gelöst.",
               reveal: "", revealLabel: "Euer Lösungswort",
               video: { kind: "none" } };
    default:
      throw new Error(`Unbekannter Bildschirmtyp: ${type}`);
  }
}

export function defaultPuzzle(type, nr) {
  const def = puzzleDef(type);
  if (!def) throw new Error(`Unbekannter Rätseltyp: ${type}`);
  return {
    id: newId("q"),
    nr: nr || 1,
    type,
    /* Nicht der Typname: sonst heissen vier neue Raetsel alle
       "Auswahl" und die Uebersicht wird unbrauchbar. */
    title: `Rätsel ${nr || 1}`,
    prompt: "",
    hint: "",
    ...def.defaults(),
  };
}

export function emptyParty(title = "Neue Rätsel-Party") {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId("p"),
    meta: { title, language: "de", createdAt: new Date().toISOString() },
    theme: { preset: "labor", tokens: {}, fontScale: 1, iconSeed: "🔬",
             background: { kind: "pattern", gradient: null, image: null, dim: 0.35 } },
    flow: [defaultScreen("start"), defaultScreen("overview"), defaultScreen("final")],
    puzzles: [defaultPuzzle("choice", 1)],
    assets: {},
    parent: { pin: "1337", allowSkip: true, allowMarkSolved: true },
    branding: { license: null },
  };
}

/* ---- Migration ---------------------------------------------------
   Sobald die erste .party.json in fremden Haenden ist, ist das
   Schema ein Vertrag. Jede Version bekommt hier einen Eintrag.     */

const MIGRATIONS = {
  // 1: (cfg) => { ...; cfg.schemaVersion = 2; return cfg; }
};

export function migrate(input) {
  let cfg = input;
  if (!cfg || typeof cfg !== "object") throw new Error("Keine gültige Party-Datei.");
  let version = Number(cfg.schemaVersion) || 1;
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `Diese Datei wurde mit einer neueren Version erstellt ` +
      `(Schema ${version}, unterstützt wird ${SCHEMA_VERSION}).`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Migration von Schema ${version} fehlt.`);
    cfg = step(cfg);
    version = Number(cfg.schemaVersion);
  }
  return normalize(cfg);
}

/* Fuellt fehlende Felder auf. Toleranz beim Lesen, Strenge beim
   Schreiben - eine handgeschriebene Party-Datei soll laufen.       */
export function normalize(cfg) {
  const base = emptyParty();
  const out = {
    schemaVersion: SCHEMA_VERSION,
    id: cfg.id || base.id,
    meta: { ...base.meta, ...(cfg.meta || {}) },
    theme: { ...base.theme, ...(cfg.theme || {}) },
    flow: Array.isArray(cfg.flow) && cfg.flow.length ? cfg.flow : base.flow,
    puzzles: Array.isArray(cfg.puzzles) ? cfg.puzzles : [],
    assets: cfg.assets && typeof cfg.assets === "object" ? cfg.assets : {},
    parent: { ...base.parent, ...(cfg.parent || {}) },
    branding: { ...base.branding, ...(cfg.branding || {}) },
  };
  out.theme.tokens = out.theme.tokens || {};
  out.theme.background = { kind: "pattern", gradient: null, image: null, dim: 0.35, ...(out.theme.background || {}) };
  out.flow = out.flow.map((s, i) => ({ ...s, id: s.id || `s${i}`, type: s.type || "start" }));
  out.puzzles = out.puzzles.map((p, i) => ({
    ...p,
    id: p.id || `q${i}`,
    nr: Number(p.nr) || i + 1,
    title: p.title || `Rätsel ${i + 1}`,
  }));
  return out;
}

/* ---- Pruefung vor dem Export ------------------------------------
   Liefert Befunde mit Pfad, damit der Editor zur Fehlerstelle
   springen kann. level: "error" blockt den Export, "warn" nicht.   */

export function validateParty(cfg) {
  const issues = [];
  const add = (level, path, msg) => issues.push({ level, path, msg });

  if (!cfg.meta?.title?.trim()) add("warn", "meta.title", "Die Party hat keinen Namen.");

  const types = cfg.flow.map((s) => s.type);
  if (!types.includes("start")) add("error", "flow", "Es fehlt ein Startbildschirm.");
  if (cfg.puzzles.length && !types.includes("overview")) {
    add("error", "flow", "Es gibt Rätsel, aber keine Rätselübersicht im Ablauf.");
  }
  if (!types.includes("final")) add("warn", "flow", "Es fehlt ein Abschlussbildschirm.");

  cfg.flow.forEach((screen, i) => {
    if (!SCREEN_TYPES[screen.type]) {
      add("error", `flow.${i}`, `Unbekannter Bildschirmtyp "${screen.type}".`);
      return;
    }
    if (screen.type === "video" && screen.source?.kind === "file" && !screen.source.name) {
      add("error", `flow.${i}.source`, "Video-Bildschirm ohne Dateinamen.");
    }
    if (screen.type === "video" && screen.source?.kind === "url" && !screen.source.url) {
      add("error", `flow.${i}.source`, "Video-Bildschirm ohne Adresse.");
    }
  });

  if (!cfg.puzzles.length) add("warn", "puzzles", "Die Party enthält kein einziges Rätsel.");

  cfg.puzzles.forEach((puzzle, i) => {
    const def = puzzleDef(puzzle.type);
    if (!def) {
      add("error", `puzzles.${i}`, `Unbekannter Rätseltyp "${puzzle.type}".`);
      return;
    }
    if (!puzzle.title?.trim()) add("warn", `puzzles.${i}.title`, "Rätsel ohne Titel.");
    for (const issue of def.validate(puzzle) || []) {
      add(issue.level || "error", `puzzles.${i}.${issue.field}`, issue.msg);
    }
  });

  /* Verwaiste und fehlende Assets finden. */
  const used = new Set();
  collectAssetRefs(cfg, used);
  for (const ref of used) {
    if (!cfg.assets[ref]) add("error", "assets", `Das Bild "${ref}" fehlt in der Datei.`);
  }
  for (const key of Object.keys(cfg.assets)) {
    if (!used.has(key)) add("warn", "assets", `Das Bild "${key}" wird nirgends verwendet.`);
  }

  const size = estimateSize(cfg);
  if (size > 15 * 1024 * 1024) {
    add("error", "assets", `Die Party wäre ${fmtBytes(size)} groß. Über 15 MB laden Tablets sie nicht mehr zuverlässig.`);
  } else if (size > 8 * 1024 * 1024) {
    add("warn", "assets", `Die Party ist mit ${fmtBytes(size)} recht groß. Bilder kleiner einstellen?`);
  }

  if (!/^\d{4}$/.test(String(cfg.parent?.pin || ""))) {
    add("error", "parent.pin", "Die Eltern-PIN muss vierstellig sein.");
  }

  return issues;
}

export function collectAssetRefs(cfg, into = new Set()) {
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      for (const [key, value] of Object.entries(node)) {
        if (key === "image" && typeof value === "string" && value) into.add(value);
        else walk(value);
      }
    }
  };
  walk(cfg.flow);
  walk(cfg.puzzles);
  /* Das Hintergrundbild der Party ist auch nur eine Asset-Referenz -
     sonst haelt es die "unbenutzte Bilder"-Aufraeumung fuer Muell. */
  if (cfg.theme?.background?.kind === "image" && cfg.theme.background.image) {
    into.add(cfg.theme.background.image);
  }
  return into;
}

/* Grobe Groessenschaetzung des Exports: JSON plus Player-Grundlast. */
export function estimateSize(cfg) {
  const json = JSON.stringify(cfg).length;
  return json + 120 * 1024;
}

export function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} kB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export { PUZZLES };
