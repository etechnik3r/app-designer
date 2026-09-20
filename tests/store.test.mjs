import test from "node:test";
import assert from "node:assert/strict";
import { getPath } from "../src/shared/path.js";
import { emptyParty, defaultPuzzle } from "../src/shared/schema.js";
import { store, loadConfig, applyOps, setValue, undo, redo, canUndo, canRedo } from "../src/editor/store.js";

function fresh() {
  loadConfig(emptyParty("Test"));
  return store;
}

test("eine geladene Party hat eine leere Historie", () => {
  fresh();
  assert.equal(canUndo(), false);
  assert.equal(canRedo(), false);
  assert.equal(store.dirty, false);
});

test("Rückgängig und Wiederherstellen kehren einzelne Änderungen um", () => {
  fresh();
  setValue("flow.0.headline", "Neu");
  assert.equal(getPath(store.cfg, "flow.0.headline"), "Neu");
  assert.equal(canUndo(), true);

  undo();
  assert.equal(getPath(store.cfg, "flow.0.headline"), "Die geheime Mission");
  assert.equal(canRedo(), true);

  redo();
  assert.equal(getPath(store.cfg, "flow.0.headline"), "Neu");
});

test("Einfügen, Löschen und Verschieben lassen sich zurücknehmen", () => {
  fresh();
  const before = store.cfg.puzzles.length;

  applyOps({ op: "insert", path: "puzzles", value: defaultPuzzle("number", 2) }, { label: "Rätsel" });
  assert.equal(store.cfg.puzzles.length, before + 1);

  applyOps({ op: "move", path: "puzzles", from: 0, to: 1 }, { label: "verschoben" });
  assert.equal(store.cfg.puzzles[0].type, "number");

  undo();
  assert.equal(store.cfg.puzzles[0].type, "choice");
  undo();
  assert.equal(store.cfg.puzzles.length, before);
});

test("eine Änderungsgruppe wird als Ganzes zurückgenommen", () => {
  fresh();
  applyOps([
    { op: "set", path: "theme.preset", value: "pirat" },
    { op: "set", path: "theme.tokens", value: { bg: "#000000" } },
  ], { label: "Vorlage" });

  undo();
  assert.equal(store.cfg.theme.preset, "labor");
  assert.deepEqual(store.cfg.theme.tokens, {});
});

test("Tastendrücke am selben Feld werden zu einem Schritt zusammengefasst", () => {
  fresh();
  setValue("meta.title", "A", { coalesce: true });
  setValue("meta.title", "Ab", { coalesce: true });
  setValue("meta.title", "Abc", { coalesce: true });

  undo();
  assert.equal(store.cfg.meta.title, "Test", "ein Rückgängig muss die ganze Eingabe zurücknehmen");
  assert.equal(canUndo(), false);
});

test("Änderungen an verschiedenen Feldern bleiben getrennt", () => {
  fresh();
  setValue("meta.title", "Neu", { coalesce: true });
  setValue("flow.0.headline", "Anders", { coalesce: true });

  undo();
  assert.equal(store.cfg.flow[0].headline, "Die geheime Mission");
  assert.equal(store.cfg.meta.title, "Neu");
});

test("eine neue Änderung verwirft den Wiederherstellen-Stapel", () => {
  fresh();
  setValue("meta.title", "Eins");
  undo();
  assert.equal(canRedo(), true);
  setValue("meta.title", "Zwei");
  assert.equal(canRedo(), false);
});

test("delkey entfernt einen Schlüssel und legt ihn beim Rückgängig wieder an", () => {
  fresh();
  applyOps({ op: "set", path: "assets.img_a", value: { mime: "image/webp" } }, { label: "Bild" });
  applyOps({ op: "delkey", path: "assets.img_a" }, { label: "Bild weg" });
  assert.equal("img_a" in store.cfg.assets, false);
  undo();
  assert.equal(store.cfg.assets.img_a.mime, "image/webp");
});
