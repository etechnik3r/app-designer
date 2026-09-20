#!/usr/bin/env node
/* Durchstich im echten Browser.
   Die Unit-Tests (npm test) pruefen Logik ohne DOM. Dieser Test
   fuehrt den Baukasten so vor, wie ein Nutzer ihn bedient:
   in der Vorschau tippen, Raetsel loesen, exportieren, die
   exportierte Datei eigenstaendig oeffnen.

   Braucht Playwright, das bewusst KEINE Abhaengigkeit des Projekts
   ist - der Baukasten selbst kommt ohne aus:

     npm i -D playwright && npx playwright install chromium
     node tools/serve.mjs &
     node tests/browser-smoke.mjs

   Liegt Playwright global, hilft PLAYWRIGHT_PATH:
     PLAYWRIGHT_PATH=$(npm root -g)/playwright/index.mjs node tests/browser-smoke.mjs
*/

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as zlib from "node:zlib";

const BASE = process.env.BASE_URL || "http://localhost:8080";
const OUT = process.env.SMOKE_OUT || tmpdir();

let chromium;
try {
  ({ chromium } = await import(process.env.PLAYWRIGHT_PATH || "playwright"));
} catch {
  console.error(
    "Playwright nicht gefunden.\n" +
    "  npm i -D playwright && npx playwright install chromium\n" +
    "  oder PLAYWRIGHT_PATH=<pfad-zu-playwright/index.mjs> setzen.",
  );
  process.exit(2);
}

const ok = [];
const problems = [];
const pass = (m) => { ok.push(m); console.log("  ✓", m); };
const fail = (m) => { problems.push(m); console.log("  ✗", m); };

const browser = await chromium.launch();

/* Der Editor zeigt beim allerersten Start je Browser einen einmaligen
   Wegweiser. Vor der eigentlichen Bedienung wegklicken. */
async function dismissWelcome(p) {
  const welcome = p.locator(".modal-card", { hasText: "Willkommen im Party-Baukasten" });
  if (await welcome.count()) {
    await p.locator(".modal-card .tbtn", { hasText: "Los geht" }).click();
    await p.waitForTimeout(200);
  }
}

/* ---------------------------------------------------------------- */
console.log("\n1) Editor bedienen");
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("console", (m) => {
  if (m.type() !== "error") return;
  if (m.text().includes("Failed to load resource")) return;   // Videos, siehe unten
  fail(`Konsolenfehler: ${m.text()}`);
});
page.on("pageerror", (e) => fail(`Skriptfehler: ${e.message}`));
page.on("response", (r) => {
  /* Videodateien liegen im Baukasten absichtlich nicht daneben -
     der Player faengt das ab und zeigt einen Hinweis. */
  if (r.status() >= 400 && !r.url().endsWith(".mp4")) fail(`HTTP ${r.status()}: ${r.url()}`);
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await dismissWelcome(page);
const frame = () => page.frameLocator("#preview");

(await page.locator("#flowstrip .item").count()) === 11
  ? pass("Ablaufspalte zeigt Party, 4 Bildschirme und 6 Rätsel")
  : fail(`Ablaufspalte zeigt ${await page.locator("#flowstrip .item").count()} Einträge`);

/* Direkt in der Vorschau schreiben */
await frame().locator('h1[data-bind="flow.0.headline"]').click();
await page.waitForTimeout(250);
(await frame().locator('h1[contenteditable="true"]').count()) === 1
  ? pass("Klick auf einen Text macht ihn direkt beschreibbar")
  : fail("Text wurde nicht beschreibbar");

await page.keyboard.type("Lauras Labor");
await page.waitForTimeout(600);
(await frame().locator('h1[data-bind="flow.0.headline"]').textContent()) === "Lauras Labor"
  ? pass("Eingabe landet in der Vorschau")
  : fail("Eingabe kam nicht an");
(await page.locator("#btnUndo").isDisabled()) === false
  ? pass("Die Änderung ist in der Historie angekommen")
  : fail("Historie hat die Änderung nicht mitbekommen");

await page.locator("#btnUndo").click();
await page.waitForTimeout(400);
(await frame().locator('h1[data-bind="flow.0.headline"]').textContent()) === "Forscher-Mission"
  ? pass("Rückgängig stellt den Ausgangstext her")
  : fail("Rückgängig hat nicht gewirkt");

/* Inspektor */
await page.locator("#flowstrip .item").nth(5).click();
await page.waitForTimeout(500);
(await page.locator("#rightPane").textContent()).includes("Richtige Antwort")
  ? pass("Inspektor baut die Felder aus dem Rätsel-Manifest")
  : fail("Inspektor zeigt die Rätselfelder nicht");
await page.screenshot({ path: join(OUT, "smoke-1-editor.png") });

/* Design */
await page.locator("#tabDesign").click();
await page.waitForTimeout(300);
(await page.locator("#rightPane").textContent()).includes("Lesbarkeit")
  ? pass("Designspalte mit Kontrastprüfung")
  : fail("Designspalte unvollständig");
await page.locator("#rightPane .item").nth(3).click();
await page.waitForTimeout(600);
(await frame().locator("body").evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--bg").trim())) === "#05070f"
  ? pass("Themewechsel wirkt sofort in der Vorschau")
  : fail("Theme kam nicht in der Vorschau an");
await page.locator("#btnUndo").click();
await page.waitForTimeout(300);

/* ---------------------------------------------------------------- */
console.log("\n2) Party durchspielen");
await page.locator("#tabContent").click();
await page.locator("#flowstrip .item").nth(1).click();
await page.waitForTimeout(400);
await page.locator("#modePlay").click();
await page.waitForTimeout(500);

await frame().locator('button[data-bind="flow.0.cta"]').click();
await page.waitForTimeout(400);
await frame().locator("button", { hasText: "Überspringen" }).first().click();
await page.waitForTimeout(400);
(await frame().locator(".puzzle-card").count()) === 6
  ? pass("Rätselübersicht zeigt alle sechs Rätsel")
  : fail("Übersicht unvollständig");

await frame().locator(".puzzle-card").first().click();
await page.waitForTimeout(400);
await frame().locator(".btn.opt", { hasText: "Ameisensäure" }).click();
await frame().locator("button", { hasText: "Prüfen" }).click();
await page.waitForTimeout(500);
(await frame().locator(".feedback").textContent()).includes("Richtig")
  ? pass("Auswahl-Rätsel wird richtig bewertet")
  : fail("Auswahl-Rätsel falsch bewertet");

await page.waitForTimeout(1400);
(await frame().locator(".puzzle-card.is-solved").count()) === 1
  ? pass("Gelöstes Rätsel wird in der Übersicht grün")
  : fail("Fortschritt nicht sichtbar");

await frame().locator(".puzzle-card").nth(1).click();
await page.waitForTimeout(400);
for (const digit of ["2", "3", "1"]) {
  await frame().locator(".num-pad .key", { hasText: new RegExp(`^${digit}$`) }).click();
}
(await frame().locator(".num-display").textContent()) === "231"
  ? pass("Zahlenfeld nimmt Eingaben an")
  : fail("Zahlenfeld zeigt etwas anderes");
await frame().locator("button", { hasText: "Prüfen" }).click();
await page.waitForTimeout(400);
(await frame().locator(".feedback").textContent()).includes("Richtig")
  ? pass("Zahlen-Rätsel wird richtig bewertet")
  : fail("Zahlen-Rätsel falsch bewertet");

await page.waitForTimeout(1400);
await frame().locator(".icon-btn").click();
await page.waitForTimeout(300);
for (const digit of ["1", "3", "3", "7"]) {
  await frame().locator(".pinpad .key", { hasText: new RegExp(`^${digit}$`) }).click();
}
await page.waitForTimeout(300);
(await frame().locator(".sheet-card").textContent()).includes("Für Erwachsene")
  ? pass("Eltern-Konsole öffnet nach richtiger PIN")
  : fail("PIN-Menü nicht erschienen");
await page.screenshot({ path: join(OUT, "smoke-2-spielen.png") });

/* ---------------------------------------------------------------- */
console.log("\n3) Prüfen und exportieren");
const page2 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page2.on("pageerror", (e) => fail(`Skriptfehler: ${e.message}`));
await page2.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page2.waitForTimeout(1500);
await dismissWelcome(page2);

await page2.locator("#btnCheck").click();
await page2.waitForTimeout(400);
(await page2.locator(".modal-card").textContent()).includes("0 Fehler")
  ? pass("Prüfung meldet die Beispiel-Party als fehlerfrei")
  : fail("Prüfung beanstandet die Beispiel-Party");
await page2.keyboard.press("Escape");

await page2.locator("#btnExport").click();
await page2.waitForTimeout(300);
const [htmlDownload] = await Promise.all([
  page2.waitForEvent("download"),
  page2.locator(".modal-card .item", { hasText: "Eine einzige HTML-Datei" }).click(),
]);
const htmlPath = join(OUT, "smoke-export.html");
await htmlDownload.saveAs(htmlPath);
const html = readFileSync(htmlPath, "utf8");
pass(`HTML-Export: ${htmlDownload.suggestedFilename()}, ${(html.length / 1024).toFixed(0)} kB`);
html.includes("Ameisens") ? pass("Party-Daten stecken in der Datei") : fail("Party-Daten fehlen");
(html.match(/(src|href)="https?:\/\//g) || []).length === 0
  ? pass("Keine Verweise ins Netz — läuft offline")
  : fail("Export verweist ins Netz");

await page2.locator("#btnExport").click();
await page2.waitForTimeout(300);
const [zipDownload] = await Promise.all([
  page2.waitForEvent("download"),
  page2.locator(".modal-card .item", { hasText: "ZIP-Paket" }).click(),
]);
await zipDownload.saveAs(join(OUT, "smoke-export.zip"));
pass(`ZIP-Export: ${zipDownload.suggestedFilename()}`);

/* ---------------------------------------------------------------- */
console.log("\n4) Die exportierte Datei allein");
const exported = await browser.newPage({ viewport: { width: 1024, height: 700 } });
const exportErrors = [];
exported.on("pageerror", (e) => exportErrors.push(e.message));
await exported.goto(`file://${htmlPath}`);
await exported.waitForTimeout(1200);

(await exported.locator("h1").first().textContent()) === "Forscher-Mission"
  ? pass("Exportierte Datei läuft eigenständig von file://")
  : fail("Exportierte Datei startet nicht");
(await exported.locator(".badge").count()) > 0
  ? pass("Wasserzeichen ist im Gratis-Export sichtbar")
  : fail("Wasserzeichen fehlt");
await exported.locator("button", { hasText: "Mission starten" }).click();
await exported.waitForTimeout(600);
await exported.screenshot({ path: join(OUT, "smoke-3-export.png") });
exportErrors.length === 0
  ? pass("Keine Skriptfehler in der exportierten Datei")
  : fail(`Fehler im Export: ${exportErrors.join("; ")}`);


/* ---------------------------------------------------------------- */
console.log("\n5) Anlegen, Typwechsel, Bild-Import");
const page3 = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page3.on("pageerror", (e) => fail(`Skriptfehler: ${e.message}`));
await page3.goto(`${BASE}/`, { waitUntil: "networkidle" });
await page3.waitForTimeout(1500);
await dismissWelcome(page3);

await page3.locator("#btnProjects").click();
await page3.waitForTimeout(400);
await page3.locator(".modal-card .tbtn", { hasText: "Leere Party" }).click();
await page3.waitForTimeout(1500);
(await page3.locator("#flowstrip .item").count()) === 5
  ? pass("Leere Party angelegt")
  : fail("Leere Party unvollständig");

for (let i = 0; i < 3; i++) {
  await page3.locator("#flowstrip .tbtn", { hasText: "+ Rätsel" }).click();
  await page3.waitForTimeout(400);
  await page3.locator(".modal-card .item").first().click();
  await page3.waitForTimeout(600);
}
(await page3.locator("#flowstrip .item").count()) === 8
  ? pass("Rätsel lassen sich anlegen")
  : fail("Anlegen von Rätseln klemmt");

await page3.locator("#flowstrip .tbtn", { hasText: "+ Rätsel" }).click();
await page3.waitForTimeout(600);
(await page3.locator(".modal-card").textContent()).includes("Rätsel möglich")
  ? pass("Gratis-Grenze greift beim fünften Rätsel")
  : fail("Gratis-Grenze greift nicht");
await page3.keyboard.press("Escape");
await page3.waitForTimeout(300);

await page3.locator("#flowstrip .item").nth(4).click();
await page3.waitForTimeout(500);
await page3.locator("#rightPane select").first().selectOption("assign");
await page3.waitForTimeout(700);
(await page3.locator("#rightPane").textContent()).includes("Bilder und Zahlen")
  ? pass("Rätseltyp wechseln baut den Inspektor neu")
  : fail("Typwechsel klemmt");

/* Ein 64x64-PNG, im Test selbst erzeugt - kein Beiwerk im Ordner. */
const chooser = page3.waitForEvent("filechooser");
await page3.locator("#rightPane .drop-hint").first().click();
(await chooser).setFiles({ name: "test.png", mimeType: "image/png", buffer: makeTestPng() });
await page3.waitForTimeout(1500);
(await page3.locator("#rightPane img.thumb").count()) > 0
  ? pass("Bild importiert, verkleinert und im Inspektor sichtbar")
  : fail("Bild-Import klemmt");
(await page3.frameLocator("#preview").locator(".assign-img:not(.assign-img--empty)").count()) > 0
  ? pass("Bild erscheint in der Party-Vorschau")
  : fail("Bild nicht in der Vorschau");

await page3.locator("#flowstrip .tbtn", { hasText: "+ Bildschirm" }).click();
await page3.waitForTimeout(500);
await page3.locator(".modal-card .item", { hasText: "Video" }).click();
await page3.waitForTimeout(700);
(await page3.locator("#rightPane").textContent()).includes("Woher kommt das Video")
  ? pass("Bildschirm eingefügt, Inspektor zeigt die Videofelder")
  : fail("Bildschirm einfügen klemmt");
await page3.screenshot({ path: join(OUT, "smoke-4-anlegen.png") });

/* ---------------------------------------------------------------- */
console.log(`\n${ok.length} bestanden, ${problems.length} fehlgeschlagen.`);
console.log(`Bildschirmfotos liegen in ${OUT}`);
await browser.close();
process.exit(problems.length ? 1 : 0);

/* Erzeugt ein gueltiges 64x64-PNG im Speicher (Farbverlauf).
   Spart eine Beispieldatei im Ordner.                             */
function makeTestPng() {
  const { deflateSync } = zlib;
  const size = 64;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      row[1 + x * 3] = (x * 4) % 256;
      row[2 + x * 3] = (y * 4) % 256;
      row[3 + x * 3] = 180;
    }
    rows.push(row);
  }
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
