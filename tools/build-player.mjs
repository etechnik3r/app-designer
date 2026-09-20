#!/usr/bin/env node
/* Baut aus den Player-Modulen eine einzige HTML-Datei:
   dist/player.template.html

   Das ist bewusst kein allgemeiner Bundler, sondern ein
   Zusammenfueger fuer genau diesen Quelltext. Er versteht:
     import { a, b } from "./x.js";
     import name     from "./x.js";     (Default-Export)
     export const / function / class ...
     export default ...
   Alles andere wird mit einer klaren Meldung abgelehnt, statt
   stillschweigend etwas Kaputtes zu erzeugen.                    */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENTRY = resolve(ROOT, "src/player/boot.js");
const CSS = resolve(ROOT, "src/player/player.css");
const HTML = resolve(ROOT, "src/player/index.html");
const OUT = resolve(ROOT, "dist/player.template.html");

const IMPORT_NAMED = /^\s*import\s*\{([^}]*)\}\s*from\s*["']([^"']+)["'];?\s*$/gm;
const IMPORT_DEFAULT = /^\s*import\s+([A-Za-z_$][\w$]*)\s+from\s*["']([^"']+)["'];?\s*$/gm;
const IMPORT_ANY = /^\s*import[\s{]/m;
const EXPORT_LIST = /^\s*export\s*\{[^}]*\}\s*;?\s*$/gm;
const TOP_DECL = /^(?:const|let|var|function|async function|class)\s+([A-Za-z_$][\w$]*)/gm;

const modules = new Map();   // absoluter Pfad -> { code, deps, defaultName }
const order = [];
let moduleCounter = 0;

function load(path) {
  if (modules.has(path)) return modules.get(path);

  let source;
  try {
    source = readFileSync(path, "utf8");
  } catch {
    throw new Error(`Modul nicht gefunden: ${relative(ROOT, path)}`);
  }

  const id = moduleCounter++;
  const defaultName = `__mod${id}_default`;
  const record = { path, code: "", deps: [], defaultName, id };
  modules.set(path, record);   // vor dem Ausleser eintragen: bricht Zyklen

  const deps = [];
  let code = source;

  code = code.replace(IMPORT_NAMED, (_match, _names, spec) => {
    deps.push(resolveSpec(path, spec));
    return "";
  });

  code = code.replace(IMPORT_DEFAULT, (_match, localName, spec) => {
    const depPath = resolveSpec(path, spec);
    deps.push(depPath);
    return `const ${localName} = __DEFAULT_OF__${depPath}__;`;
  });

  if (IMPORT_ANY.test(code)) {
    const line = code.split("\n").find((l) => /^\s*import[\s{]/.test(l));
    throw new Error(
      `${relative(ROOT, path)}: nicht unterstützte Import-Form.\n  ${line?.trim()}\n` +
      `  Erlaubt sind nur benannte Importe und Default-Importe relativer Dateien.`,
    );
  }

  code = code.replace(EXPORT_LIST, "");
  code = code.replace(/^\s*export\s+default\s+/gm, `const ${defaultName} = `);
  code = code.replace(/^(\s*)export\s+/gm, "$1");

  record.code = code;
  record.deps = deps;

  for (const dep of deps) load(dep);
  order.push(record);           // Abhängigkeiten stehen danach vor uns
  return record;
}

function resolveSpec(fromPath, spec) {
  if (!spec.startsWith(".")) {
    throw new Error(`${relative(ROOT, fromPath)}: nur relative Importe erlaubt, nicht "${spec}"`);
  }
  return resolve(dirname(fromPath), spec);
}

function checkCollisions() {
  const seen = new Map();
  for (const mod of order) {
    for (const match of mod.code.matchAll(TOP_DECL)) {
      const name = match[1];
      if (!isTopLevel(mod.code, match.index)) continue;
      if (seen.has(name)) {
        throw new Error(
          `Namenskollision "${name}" zwischen ${relative(ROOT, seen.get(name))} und ` +
          `${relative(ROOT, mod.path)}.\n  Im zusammengefügten Player teilen sich alle Module einen ` +
          `Gültigkeitsbereich — bitte eines von beiden umbenennen.`,
        );
      }
      seen.set(name, mod.path);
    }
  }
}

/* Grobe, aber ausreichende Pruefung: Deklaration steht am Zeilenanfang
   ohne Einrueckung. Der gesamte Quelltext haelt sich daran.        */
function isTopLevel(code, index) {
  const lineStart = code.lastIndexOf("\n", index) + 1;
  return code.slice(lineStart, index).trim() === "";
}

function build() {
  load(ENTRY);
  checkCollisions();

  let bundle = order.map((mod) => `/* ---- ${relative(ROOT, mod.path)} ---- */\n${mod.code.trim()}`).join("\n\n");

  /* Default-Platzhalter aufloesen. */
  bundle = bundle.replace(/__DEFAULT_OF__(.+?)__;/g, (_m, depPath) => {
    const dep = modules.get(depPath);
    if (!dep) throw new Error(`Interner Fehler: Modul ${depPath} unbekannt.`);
    return `${dep.defaultName};`;
  });

  const leftover = bundle.match(/^\s*(import|export)\s/m);
  if (leftover) throw new Error(`Im Ergebnis steht noch "${leftover[1]}" — der Zusammenfüger hat etwas übersehen.`);

  const css = readFileSync(CSS, "utf8");
  const html = readFileSync(HTML, "utf8");

  /* Ersetzt wird mit Funktionen, nicht mit Zeichenketten: im Quelltext
     steht unter anderem "$&", was String.replace sonst als Rückverweis
     auf den Treffer deutet und den ersetzten Tag wieder einsetzt.   */
  const out = html
    .replace(/<link rel="stylesheet" href="player\.css">/, () => `<style>\n${css}\n</style>`)
    .replace(/<script type="module" src="boot\.js"><\/script>/,
      () => `<script>\n(function () {\n"use strict";\n${bundle}\n})();\n</script>`);

  if (out.includes('src="boot.js"') || out.includes('href="player.css"')) {
    throw new Error("Im Ergebnis stehen noch Verweise auf externe Dateien.");
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, "utf8");
  return { bytes: Buffer.byteLength(out), modules: order.length };
}

try {
  const result = build();
  console.log(`dist/player.template.html gebaut: ${result.modules} Module, ${(result.bytes / 1024).toFixed(1)} kB`);
} catch (err) {
  console.error(`\nBau fehlgeschlagen:\n${err.message}\n`);
  process.exit(1);
}
