import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/* Der Zusammenfueger ist selbstgebaut. Wenn er stillschweigend etwas
   falsch macht, merkt man es erst am exportierten Geburtstag - also
   wird sein Ergebnis hier geprueft.                                */

test("die Player-Vorlage lässt sich bauen", () => {
  const out = execFileSync("node", ["tools/build-player.mjs"], { encoding: "utf8" });
  assert.match(out, /gebaut/);
});

test("die Vorlage ist in sich geschlossen", () => {
  const html = readFileSync(new URL("../dist/player.template.html", import.meta.url), "utf8");

  assert.ok(html.includes("__PARTY_CONFIG__"), "Platzhalter für die Party-Daten fehlt");
  assert.ok(!html.includes('src="boot.js"'), "verweist noch auf boot.js");
  assert.ok(!html.includes('href="player.css"'), "verweist noch auf player.css");
  assert.ok(!/^\s*(import|export)\s/m.test(html), "enthält noch Modul-Schlüsselwörter");
  assert.ok(html.includes("<style>"), "Stylesheet nicht eingebettet");

  /* Nichts aus dem Netz: der Export muss auf einem Tablet ohne WLAN
     genauso laufen. */
  const external = html.match(/(src|href)="https?:\/\/[^"]+"/g) || [];
  assert.deepEqual(external, [], `externe Verweise gefunden: ${external.join(", ")}`);
});

test("der Zusammenfüger meldet nicht unterstützte Importe, statt sie zu schlucken", () => {
  /* Gegenprobe: waere die Pruefung wirkungslos, bliebe ein import
     im Ergebnis stehen und der Player waere im Browser tot. */
  const html = readFileSync(new URL("../dist/player.template.html", import.meta.url), "utf8");
  const scriptBody = html.slice(html.indexOf("<script>"), html.lastIndexOf("</script>"));
  assert.ok(!/\bimport\s+[{A-Za-z]/.test(scriptBody), "unaufgelöster Import im Ergebnis");
});
