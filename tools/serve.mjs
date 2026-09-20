#!/usr/bin/env node
/* Entwicklungsserver ohne Abhaengigkeiten.
   Zusaetzlich zum Ausliefern baut er die Player-Vorlage neu, sobald
   eine Player-Quelldatei juenger ist - sonst exportiert der Editor
   irgendwann eine veraltete Fassung, ohne dass es auffaellt.      */

import { createServer } from "node:http";
import { readFile, stat, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = Number(process.env.PORT || 8080);
const TEMPLATE = join(ROOT, "dist/player.template.html");
const WATCHED = ["src/player", "src/puzzles", "src/shared"];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".mp4": "video/mp4",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};

async function newestSource() {
  let newest = 0;
  for (const dir of WATCHED) {
    const full = join(ROOT, dir);
    for (const name of await readdir(full)) {
      if (!/\.(js|css|html)$/.test(name)) continue;
      const info = await stat(join(full, name));
      newest = Math.max(newest, info.mtimeMs);
    }
  }
  return newest;
}

async function ensureTemplate() {
  const sourceTime = await newestSource();
  const templateTime = existsSync(TEMPLATE) ? (await stat(TEMPLATE)).mtimeMs : 0;
  if (templateTime >= sourceTime) return;

  const result = spawnSync(process.execPath, [join(ROOT, "tools/build-player.mjs")], { encoding: "utf8" });
  process.stdout.write(result.stdout || "");
  if (result.status !== 0) process.stderr.write(result.stderr || "");
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://localhost:${PORT}`);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";

    /* Vorlage bei jedem Zugriff pruefen: kostet nichts und haelt
       Vorschau und Export beieinander. */
    if (pathname.endsWith("player.template.html")) await ensureTemplate();

    const target = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ""));
    if (!target.startsWith(ROOT)) { response.writeHead(403).end("Verboten"); return; }

    const body = await readFile(target);
    response.writeHead(200, {
      "Content-Type": TYPES[extname(target)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch (err) {
    if (err.code === "ENOENT") { response.writeHead(404).end("Nicht gefunden"); return; }
    response.writeHead(500).end(String(err.message));
  }
});

await ensureTemplate();
server.listen(PORT, () => {
  console.log(`Party-Baukasten läuft:  http://localhost:${PORT}/`);
  console.log(`Player allein testen:   http://localhost:${PORT}/src/player/index.html?src=/examples/forschergeburtstag.party.json`);
});
