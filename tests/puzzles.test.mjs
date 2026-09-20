import test from "node:test";
import assert from "node:assert/strict";
import { PUZZLES, puzzleDef } from "../src/puzzles/index.js";
import { defaultPuzzle } from "../src/shared/schema.js";

test("jeder Rätseltyp erfüllt den Vertrag der Registry", () => {
  for (const def of PUZZLES) {
    assert.ok(def.id, "id fehlt");
    assert.ok(def.label, `${def.id}: label fehlt`);
    assert.ok(def.icon, `${def.id}: icon fehlt`);
    assert.equal(typeof def.check, "function", `${def.id}: check fehlt`);
    assert.equal(typeof def.validate, "function", `${def.id}: validate fehlt`);
    assert.equal(typeof def.render, "function", `${def.id}: render fehlt`);
    assert.ok(Array.isArray(def.fields), `${def.id}: fields fehlt`);
  }
});

test("die Voreinstellung jedes Typs ist sofort spielbar", () => {
  for (const def of PUZZLES) {
    const puzzle = defaultPuzzle(def.id, 1);
    /* Hinweise sind erlaubt - ein frisches Zuordnungsrätsel hat noch
       keine Bilder. Fehler waeren dagegen ein kaputter Standardwert. */
    const errors = (def.validate(puzzle) || []).filter((i) => (i.level || "error") === "error");
    assert.deepEqual(errors, [], `${def.id} hat fehlerhafte Voreinstellungen`);
  }
});

test("Auswahl: nur die hinterlegte Antwort zählt", () => {
  const def = puzzleDef("choice");
  const puzzle = { options: ["A", "B"], answer: "B" };
  assert.equal(def.check(puzzle, "B"), true);
  assert.equal(def.check(puzzle, "A"), false);
  assert.equal(def.check(puzzle, null), false);
});

test("Zahlen-Code: führende und folgende Leerzeichen stören nicht", () => {
  const def = puzzleDef("number");
  assert.equal(def.check({ answer: "231" }, " 231 "), true);
  assert.equal(def.check({ answer: "231" }, "213"), false);
  assert.ok(def.validate({ answer: "12a", maxLength: 3 }).length);
});

test("Wort-Antwort achtet auf die Einstellung zur Groß-/Kleinschreibung", () => {
  const def = puzzleDef("text");
  assert.equal(def.check({ answer: "Hefe", caseSensitive: false }, "hefe"), true);
  assert.equal(def.check({ answer: "Hefe", caseSensitive: true }, "hefe"), false);
  assert.equal(def.check({ answer: "Hefe" }, ""), false);
});

test("Zuordnung vergleicht alle Zahlen", () => {
  const def = puzzleDef("assign");
  const puzzle = { items: [{ value: "9" }, { value: "13" }] };
  assert.equal(def.check(puzzle, ["9", "13"]), true);
  assert.equal(def.check(puzzle, ["9", "12"]), false);
  assert.equal(def.check(puzzle, ["9"]), false);
});

test("Einsortieren: unabgelegte Gegenstände gelten als falsch", () => {
  const def = puzzleDef("sort2");
  const puzzle = { zones: ["A", "B"], objects: [{ zone: 0 }, { zone: 1 }] };
  assert.equal(def.check(puzzle, [0, 1]), true);
  assert.equal(def.check(puzzle, [0, null]), false);
  assert.equal(def.check(puzzle, [1, 0]), false);
});

test("Richtig/Falsch braucht zu jeder Aussage eine Entscheidung", () => {
  const def = puzzleDef("truefalse");
  const puzzle = { statements: [{ value: true }, { value: false }] };
  assert.equal(def.check(puzzle, [true, false]), true);
  assert.equal(def.check(puzzle, [true, null]), false);
});

test("Reihenfolge vergleicht die ganze Folge", () => {
  const def = puzzleDef("order");
  const puzzle = { items: ["a", "b", "c"] };
  assert.equal(def.check(puzzle, ["a", "b", "c"]), true);
  assert.equal(def.check(puzzle, ["b", "a", "c"]), false);
  assert.ok(def.validate({ items: ["a", "a"] }).length, "doppelte Einträge sind nicht eindeutig");
});
