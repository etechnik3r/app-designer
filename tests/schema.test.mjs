import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyParty, migrate, normalize, validateParty, defaultPuzzle,
  defaultScreen, estimateSize, SCHEMA_VERSION,
} from "../src/shared/schema.js";

test("eine frische Party ist ohne Beanstandung", () => {
  assert.deepEqual(validateParty(emptyParty()), []);
});

test("die Beispiel-Party ist ohne Beanstandung", () => {
  const raw = JSON.parse(readFileSync(new URL("../examples/forschergeburtstag.party.json", import.meta.url)));
  const cfg = migrate(raw);
  assert.deepEqual(validateParty(cfg), []);
  assert.equal(cfg.puzzles.length, 6);
});

test("migrate weist neuere Schemaversionen ab, statt sie zu verstümmeln", () => {
  assert.throws(
    () => migrate({ schemaVersion: SCHEMA_VERSION + 1 }),
    /neueren Version/,
  );
});

test("normalize verträgt eine handgeschriebene, lückenhafte Datei", () => {
  const cfg = normalize({ puzzles: [{ type: "text", answer: "Hefe" }] });
  assert.equal(cfg.schemaVersion, SCHEMA_VERSION);
  assert.ok(cfg.puzzles[0].id);
  assert.equal(cfg.puzzles[0].nr, 1);
  assert.ok(cfg.flow.length >= 1);
});

test("Prüfung erkennt eine Auswahl ohne passende Antwort", () => {
  const cfg = emptyParty();
  cfg.puzzles[0].answer = "steht nicht in der Liste";
  const issues = validateParty(cfg);
  assert.ok(issues.some((i) => i.level === "error" && i.path.endsWith("answer")));
});

test("Prüfung erkennt Rätsel ohne Übersicht im Ablauf", () => {
  const cfg = emptyParty();
  cfg.flow = cfg.flow.filter((s) => s.type !== "overview");
  assert.ok(validateParty(cfg).some((i) => i.msg.includes("Rätselübersicht")));
});

test("Prüfung erkennt fehlende Bilder", () => {
  const cfg = emptyParty();
  cfg.puzzles = [{ ...defaultPuzzle("assign", 1) }];
  cfg.puzzles[0].items[0].image = "img_gibtsnicht";
  assert.ok(validateParty(cfg).some((i) => i.msg.includes("img_gibtsnicht")));
});

test("Prüfung erkennt eine untaugliche Eltern-PIN", () => {
  const cfg = emptyParty();
  cfg.parent.pin = "12";
  assert.ok(validateParty(cfg).some((i) => i.path === "parent.pin"));
});

test("defaultScreen kennt alle Bildschirmtypen", () => {
  for (const type of ["start", "video", "overview", "final"]) {
    assert.equal(defaultScreen(type).type, type);
  }
  assert.throws(() => defaultScreen("gibtsnicht"));
});

test("Größenschätzung wächst mit eingebetteten Bildern", () => {
  const small = emptyParty();
  const big = emptyParty();
  big.assets.img_x = { mime: "image/webp", w: 10, h: 10, data: "x".repeat(200_000) };
  assert.ok(estimateSize(big) > estimateSize(small) + 150_000);
});
