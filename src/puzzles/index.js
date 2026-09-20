/* Registry der Raetseltypen.
   Ein neuer Typ ist genau eine Datei plus eine Zeile hier - Editor-
   Oberflaeche, Pruefung und Export ergeben sich daraus von selbst. */

import choice from "./choice.js";
import number from "./number.js";
import text from "./text.js";
import assign from "./assign.js";
import sort2 from "./sort2.js";
import truefalse from "./truefalse.js";
import order from "./order.js";

export const PUZZLES = [choice, number, text, assign, sort2, truefalse, order];

const BY_ID = new Map(PUZZLES.map((p) => [p.id, p]));

export function puzzleDef(type) {
  return BY_ID.get(type) || null;
}

export function puzzleLabel(type) {
  return puzzleDef(type)?.label || type;
}
