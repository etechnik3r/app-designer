import { h } from "../player/dom.js";

/* Zahlencode ueber ein grosses Tastenfeld. Bewusst kein <input>:
   auf Tablets soll keine Systemtastatur hochklappen.               */
export default {
  id: "number",
  label: "Zahlen-Code",
  icon: "🔢",
  summary: "Kinder tippen eine Zahl auf einem großen Tastenfeld ein.",

  fields: [
    { key: "answer", type: "text", label: "Richtige Zahl", pattern: "^[0-9]{1,8}$",
      help: "Nur Ziffern, höchstens acht Stellen." },
    { key: "maxLength", type: "slider", label: "Anzahl Stellen", min: 1, max: 8, step: 1 },
  ],

  defaults: () => ({ answer: "123", maxLength: 3 }),

  validate(p) {
    const issues = [];
    const answer = String(p.answer ?? "");
    if (!answer) issues.push({ field: "answer", msg: "Es fehlt die richtige Zahl." });
    else if (!/^\d{1,8}$/.test(answer)) issues.push({ field: "answer", msg: "Die Antwort darf nur aus Ziffern bestehen." });
    else if (answer.length > (p.maxLength || 8)) {
      issues.push({ field: "maxLength", msg: `Die Antwort hat ${answer.length} Stellen, eingestellt sind ${p.maxLength}.` });
    }
    return issues;
  },

  check: (p, answer) => String(answer ?? "").trim() === String(p.answer ?? "").trim(),

  render(ctx) {
    const { puzzle } = ctx;
    const maxLength = Math.max(1, Math.min(8, Number(puzzle.maxLength) || 3));
    let value = "";

    const display = h("div", { class: "num-display" });
    const paint = () => {
      display.textContent = value.padEnd(maxLength, "·");
    };
    paint();

    const key = (label, onPress, cls) =>
      h("button", { class: `btn key ${cls || ""}`, type: "button", text: label,
        onclick: () => { onPress(); paint(); } });

    const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) =>
      key(d, () => { if (value.length < maxLength) value += d; }));

    const node = h("div", { class: "p-number" },
      display,
      h("div", { class: "num-pad" },
        digits,
        key("←", () => { value = value.slice(0, -1); }, "key--soft"),
        key("0", () => { if (value.length < maxLength) value += "0"; }),
        key("C", () => { value = ""; }, "key--soft"),
      ),
    );

    return { node, getAnswer: () => value };
  },
};
