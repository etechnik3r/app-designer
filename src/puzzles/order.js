import { h } from "../player/dom.js";
import { seededShuffle } from "../shared/rng.js";

/* Reihenfolge herstellen. Bewusst mit Pfeiltasten statt Ziehen:
   das funktioniert auf jedem Geraet und auch mit kleinen Fingern. */
export default {
  id: "order",
  label: "Reihenfolge",
  icon: "↕️",
  summary: "Elemente werden mit Pfeilen in die richtige Reihenfolge gebracht.",

  fields: [
    { key: "items", type: "list", label: "Elemente in der richtigen Reihenfolge",
      help: "Von oben nach unten so eintragen, wie es am Ende stimmen soll. Angezeigt wird gemischt." },
  ],

  defaults: () => ({ items: ["Erstes", "Zweites", "Drittes"] }),

  validate(p) {
    const items = p.items || [];
    const issues = [];
    if (items.length < 2) issues.push({ field: "items", msg: "Mindestens zwei Elemente nötig." });
    if (items.some((i) => !String(i).trim())) issues.push({ field: "items", msg: "Ein Element ist leer." });
    if (new Set(items).size !== items.length) {
      issues.push({ field: "items", msg: "Zwei Elemente sind gleich — dann ist die Reihenfolge nicht eindeutig." });
    }
    return issues;
  },

  check(p, answer) {
    const items = p.items || [];
    if (!Array.isArray(answer) || answer.length !== items.length) return false;
    return items.every((item, i) => item === answer[i]);
  },

  render(ctx) {
    const { puzzle } = ctx;
    let current = seededShuffle(puzzle.items || [], puzzle.id || "order");

    const list = h("div", { class: "p-order" });

    const paint = () => {
      list.replaceChildren(
        ...current.map((item, i) =>
          h("div", { class: "order-row" },
            h("span", { class: "order-pos", text: String(i + 1) }),
            h("span", { class: "order-text", text: item }),
            h("button", {
              class: "btn key key--soft", type: "button", text: "▲",
              disabled: i === 0,
              onclick: () => { swap(i, i - 1); },
            }),
            h("button", {
              class: "btn key key--soft", type: "button", text: "▼",
              disabled: i === current.length - 1,
              onclick: () => { swap(i, i + 1); },
            }),
          ),
        ),
      );
    };

    const swap = (a, b) => {
      if (b < 0 || b >= current.length) return;
      [current[a], current[b]] = [current[b], current[a]];
      paint();
    };

    paint();
    return { node: list, getAnswer: () => current.slice() };
  },
};
