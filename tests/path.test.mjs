import test from "node:test";
import assert from "node:assert/strict";
import { getPath, setPath, delPath, moveItem, clone } from "../src/shared/path.js";

test("getPath liest verschachtelte Werte", () => {
  const obj = { a: { b: [{ c: 7 }] } };
  assert.equal(getPath(obj, "a.b.0.c"), 7);
  assert.equal(getPath(obj, "a.x.y"), undefined);
  assert.equal(getPath(obj, ""), obj);
});

test("setPath legt fehlende Ebenen an, Zahlen werden zu Arrays", () => {
  const obj = {};
  setPath(obj, "flow.0.headline", "Hallo");
  assert.ok(Array.isArray(obj.flow));
  assert.equal(obj.flow[0].headline, "Hallo");
});

test("delPath spleisst Arrays, statt Löcher zu hinterlassen", () => {
  const obj = { list: ["a", "b", "c"] };
  delPath(obj, "list.1");
  assert.deepEqual(obj.list, ["a", "c"]);
});

test("moveItem verschiebt und meldet, ob sich etwas geändert hat", () => {
  const list = [1, 2, 3];
  assert.equal(moveItem(list, 0, 2), true);
  assert.deepEqual(list, [2, 3, 1]);
  assert.equal(moveItem(list, 1, 1), false);
  assert.equal(moveItem(list, 5, 0), false);
});

test("clone koppelt die Kopie ab", () => {
  const original = { a: { b: 1 } };
  const copy = clone(original);
  copy.a.b = 2;
  assert.equal(original.a.b, 1);
});
