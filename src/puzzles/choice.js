import { h } from "../player/dom.js";

/* Eine Antwort aus mehreren anklicken. Der haeufigste Typ:
   "Welcher Stoff fehlt auf dem Poster?"                            */
export default {
  id: "choice",
  label: "Auswahl",
  icon: "🔘",
  summary: "Mehrere Antworten stehen zur Wahl, eine ist richtig.",

  fields: [
    { key: "options", type: "list", label: "Antwortmöglichkeiten",
      help: "Eine Möglichkeit pro Zeile. Mindestens zwei." },
    { key: "answer", type: "optionpick", label: "Richtige Antwort", from: "options" },
  ],

  defaults: () => ({ options: ["Antwort A", "Antwort B", "Antwort C"], answer: "Antwort A" }),

  validate(p) {
    const issues = [];
    const options = p.options || [];
    if (options.length < 2) issues.push({ field: "options", msg: "Mindestens zwei Antwortmöglichkeiten nötig." });
    if (options.some((o) => !String(o).trim())) issues.push({ field: "options", msg: "Eine Antwortmöglichkeit ist leer." });
    if (!p.answer) issues.push({ field: "answer", msg: "Es ist keine richtige Antwort markiert." });
    else if (!options.includes(p.answer)) {
      issues.push({ field: "answer", msg: `Die richtige Antwort "${p.answer}" steht nicht in der Liste.` });
    }
    return issues;
  },

  check: (p, answer) => answer != null && answer === p.answer,

  render(ctx) {
    const { puzzle, path } = ctx;
    let picked = null;
    const buttons = [];

    const node = h("div", { class: "p-choice" },
      (puzzle.options || []).map((option, i) => {
        const btn = h("button", {
          class: "btn opt", type: "button",
          bind: `${path}.options.${i}`,
          text: option,
          onclick: () => {
            picked = option;
            buttons.forEach((b) => b.classList.toggle("is-picked", b === btn));
          },
        });
        buttons.push(btn);
        return btn;
      }),
    );

    return { node, getAnswer: () => picked };
  },
};
