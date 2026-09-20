import { h } from "../player/dom.js";

/* Mehrere Aussagen, jede richtig oder falsch. Gut fuer Wissensfragen,
   weil alle Kinder gleichzeitig mitdenken koennen.                 */
export default {
  id: "truefalse",
  label: "Richtig oder falsch",
  icon: "✅",
  summary: "Zu mehreren Aussagen wird jeweils richtig oder falsch getippt.",

  fields: [
    { key: "statements", type: "objectlist", label: "Aussagen",
      itemLabel: (it) => it.text || "Aussage",
      itemFields: [
        { key: "text", type: "text", label: "Aussage" },
        { key: "value", type: "toggle", label: "Diese Aussage ist richtig" },
      ],
      newItem: () => ({ text: "Neue Aussage", value: true }) },
  ],

  defaults: () => ({
    statements: [
      { text: "Eis schwimmt auf Wasser.", value: true },
      { text: "Magnete ziehen Holz an.", value: false },
    ],
  }),

  validate(p) {
    const list = p.statements || [];
    if (!list.length) return [{ field: "statements", msg: "Es ist keine Aussage eingetragen." }];
    return list
      .map((s, i) => (String(s.text ?? "").trim() ? null : { field: `statements.${i}.text`, msg: `Aussage ${i + 1} ist leer.` }))
      .filter(Boolean);
  },

  check(p, answer) {
    const list = p.statements || [];
    if (!Array.isArray(answer) || answer.length !== list.length) return false;
    return list.every((s, i) => answer[i] !== null && answer[i] === !!s.value);
  },

  render(ctx) {
    const { puzzle, path } = ctx;
    const picks = new Array((puzzle.statements || []).length).fill(null);

    const node = h("div", { class: "p-truefalse" },
      (puzzle.statements || []).map((statement, i) => {
        const yes = h("button", { class: "btn tf tf--yes", type: "button", text: "Richtig" });
        const no = h("button", { class: "btn tf tf--no", type: "button", text: "Falsch" });
        const set = (value) => {
          picks[i] = value;
          yes.classList.toggle("is-picked", value === true);
          no.classList.toggle("is-picked", value === false);
        };
        yes.addEventListener("click", () => set(true));
        no.addEventListener("click", () => set(false));
        return h("div", { class: "tf-row" },
          h("span", { class: "tf-text", bind: `${path}.statements.${i}.text`, text: statement.text }),
          h("div", { class: "tf-btns" }, yes, no),
        );
      }),
    );

    return { node, getAnswer: () => picks };
  },
};
