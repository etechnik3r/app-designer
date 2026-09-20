/* Export.
   Der Player wird nicht im Browser uebersetzt, sondern liegt als
   fertige Vorlage bereit (dist/player.template.html, erzeugt von
   tools/build-player.mjs). Der Export setzt nur noch das Party-
   Dokument ein - deshalb dauert er keine Sekunde.                  */

import { makeZip } from "../shared/zip.js";
import { makeIcon, dataUrlToBytes } from "./media.js";
import { themeTokens } from "../shared/themes.js";
import { collectAssetRefs } from "../shared/schema.js";

const TEMPLATE_URL = new URL("../../dist/player.template.html", import.meta.url);

let templateCache = null;

export async function loadTemplate() {
  if (templateCache) return templateCache;
  const response = await fetch(TEMPLATE_URL);
  if (!response.ok) {
    throw new Error(
      "dist/player.template.html fehlt. Bitte einmal `npm run build` ausführen " +
      "(oder den Entwicklungsserver mit `npm start` benutzen, der baut selbst).",
    );
  }
  templateCache = await response.text();
  if (!templateCache.includes("__PARTY_CONFIG__")) {
    throw new Error("Die Player-Vorlage enthält keinen Platzhalter für die Party-Daten.");
  }
  return templateCache;
}

/* JSON sicher in ein <script>-Element einbetten:
   "</script>" im Text wuerde das Dokument sonst zerreissen, die
   Zeilentrenner U+2028/2029 sind in JavaScript-Quelltext verboten. */
function embeddableJson(cfg) {
  return JSON.stringify(cfg)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export async function buildSingleFile(cfg) {
  const template = await loadTemplate();
  return template.replace("__PARTY_CONFIG__", () => embeddableJson(cfg));
}

export function safeFileName(name, fallback = "raetsel-party") {
  const cleaned = String(name || "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

/* ---- Beipack fuer das ZIP-Paket ---------------------------------- */

function manifest(cfg) {
  const tokens = themeTokens(cfg.theme);
  return JSON.stringify({
    name: cfg.meta?.title || "Rätsel-Party",
    short_name: (cfg.meta?.title || "Party").slice(0, 12),
    start_url: "./index.html",
    display: "fullscreen",
    orientation: "landscape",
    background_color: tokens.bg,
    theme_color: tokens.bg,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  }, null, 2);
}

function serviceWorker(cfg) {
  const version = `party-${cfg.id}-${Date.now().toString(36)}`;
  return `/* Offline-Zwischenspeicher. Die Seite selbst traegt alles in sich,
   der Service Worker sorgt nur dafuer, dass sie ohne Netz startet. */
const CACHE = ${JSON.stringify(version)};
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((hit) => hit || fetch(event.request).catch(() => caches.match("./index.html"))),
  );
});
`;
}

function videoReadme(cfg) {
  const names = [];
  for (const screen of cfg.flow) {
    if (screen.type === "video" && screen.source?.kind === "file" && screen.source.name) names.push(screen.source.name);
    if (screen.type === "final" && screen.video?.kind === "file" && screen.video.name) names.push(screen.video.name);
  }
  const list = names.length
    ? names.map((n) => `  - ${n}`).join("\n")
    : "  (für diese Party ist kein Video als Datei eingetragen)";

  return `Videos
======

Videos stecken nicht in der HTML-Datei, sondern liegen daneben.
Diese Dateien werden erwartet:

${list}

So geht es:
  1. Die Videodateien in DIESEN Ordner legen, mit genau diesen Namen.
  2. Den ganzen Ordner auf den Webspace laden oder aufs Tablet kopieren.
  3. index.html öffnen.

Format: MP4 mit H.264-Bild und AAC-Ton. Andere Formate (VP9, HEVC)
spielen iPads nicht zuverlässig ab — das fällt sonst erst am
Geburtstag auf.

Fehlt eine Datei, läuft der Ablauf trotzdem weiter; der Bildschirm
zeigt dann nur einen Hinweis.
`;
}

function solutionSheet(cfg) {
  const lines = [
    `Lösungsblatt: ${cfg.meta?.title || "Rätsel-Party"}`,
    "=".repeat(40),
    "",
    `Eltern-PIN (Zahnrad oben rechts): ${cfg.parent?.pin || "1337"}`,
    "",
  ];
  cfg.puzzles.forEach((puzzle, i) => {
    lines.push(`${i + 1}. ${puzzle.title} [${puzzle.type}]`);
    if (puzzle.prompt) lines.push(`   Frage: ${puzzle.prompt}`);
    lines.push(`   Lösung: ${describeSolution(puzzle)}`);
    if (puzzle.hint) lines.push(`   Tipp: ${puzzle.hint}`);
    lines.push("");
  });
  const final = cfg.flow.find((s) => s.type === "final");
  if (final?.reveal) lines.push(`Lösungswort am Ende: ${final.reveal}`);
  return lines.join("\n");
}

export function describeSolution(puzzle) {
  switch (puzzle.type) {
    case "choice": return String(puzzle.answer);
    case "number": return String(puzzle.answer);
    case "text": return String(puzzle.answer);
    case "assign":
      return (puzzle.items || []).map((it, i) => `${it.caption || `Bild ${i + 1}`} = ${it.value}`).join(", ");
    case "sort2":
      return (puzzle.zones || []).map((zone, z) =>
        `${zone}: ${(puzzle.objects || []).filter((o) => o.zone === z).map((o) => o.label).join(", ")}`,
      ).join(" | ");
    case "truefalse":
      return (puzzle.statements || []).map((s) => `${s.text} → ${s.value ? "richtig" : "falsch"}`).join("; ");
    case "order":
      return (puzzle.items || []).join(" → ");
    default: return "(unbekannter Typ)";
  }
}

export async function buildZip(cfg) {
  const html = await buildSingleFile(cfg);
  const tokens = themeTokens(cfg.theme);
  const emoji = cfg.theme?.iconSeed || "🎉";

  const files = [
    { name: "index.html", content: html },
    { name: "manifest.webmanifest", content: manifest(cfg) },
    { name: "sw.js", content: serviceWorker(cfg) },
    { name: "icon-192.png", content: dataUrlToBytes(makeIcon(emoji, tokens.bg, 192)) },
    { name: "icon-512.png", content: dataUrlToBytes(makeIcon(emoji, tokens.bg, 512)) },
    { name: "LIESMICH-videos.txt", content: videoReadme(cfg) },
    { name: "loesungsblatt.txt", content: solutionSheet(cfg) },
  ];
  return makeZip(files);
}

/* ---- Herunterladen ------------------------------------------------ */

export function download(filename, content, mime = "application/octet-stream") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Der Service Worker braucht die Seite unter einer echten Adresse.
   Bei der Ein-Datei-Variante gibt es ihn deshalb nicht - dort wuerde
   die Registrierung von file:// aus ohnehin scheitern. */
export function unusedAssetCount(cfg) {
  const used = collectAssetRefs(cfg);
  return Object.keys(cfg.assets || {}).filter((key) => !used.has(key)).length;
}

export function pruneUnusedAssets(cfg) {
  const used = collectAssetRefs(cfg);
  const next = {};
  for (const [key, value] of Object.entries(cfg.assets || {})) {
    if (used.has(key)) next[key] = value;
  }
  return next;
}
