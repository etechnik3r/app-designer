import { h } from "../player/dom.js";

/* Wort-Antwort ueber die Systemtastatur. Fuer Loesungswoerter. */
export default {
  id: "text",
  label: "Wort-Antwort",
  icon: "🔤",
  summary: "Ein Wort wird über die Tastatur eingegeben.",

  fields: [
    { key: "answer", type: "text", label: "Richtiges Wort" },
    { key: "caseSensitive", type: "toggle", label: "Groß- und Kleinschreibung beachten" },
    { key: "placeholder", type: "text", label: "Hinweis im Eingabefeld" },
  ],

  defaults: () => ({ answer: "Hefe", caseSensitive: false, placeholder: "Antwort eintippen" }),

  validate(p) {
    return String(p.answer ?? "").trim()
      ? []
      : [{ field: "answer", msg: "Es fehlt das richtige Wort." }];
  },

  check(p, answer) {
    const given = String(answer ?? "").trim();
    const want = String(p.answer ?? "").trim();
    if (!given) return false;
    return p.caseSensitive ? given === want : given.toLowerCase() === want.toLowerCase();
  },

  render(ctx) {
    const input = h("input", {
      class: "text-input", type: "text", autocomplete: "off", autocapitalize: "off",
      spellcheck: "false", placeholder: ctx.puzzle.placeholder || "Antwort eintippen",
    });
    const node = h("div", { class: "p-text" }, input);
    return { node, getAnswer: () => input.value };
  },
};
