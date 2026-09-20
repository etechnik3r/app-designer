import { h, assetUrl } from "../player/dom.js";

/* Bild -> Zahl. Im Raum haengen Symbole mit Zahlen daneben; hier
   wird zugeordnet. Der urspruengliche Stromkreis-Typ.              */
export default {
  id: "assign",
  label: "Zahlen zuordnen",
  icon: "🔗",
  summary: "Zu jedem Bild wird eine Zahl eingetragen.",

  fields: [
    { key: "items", type: "objectlist", label: "Bilder und Zahlen",
      itemLabel: (it, i) => `Bild ${i + 1}`,
      itemFields: [
        { key: "image", type: "image", label: "Bild" },
        { key: "caption", type: "text", label: "Beschriftung (optional)" },
        { key: "value", type: "text", label: "Richtige Zahl", pattern: "^[0-9]{1,4}$" },
      ],
      newItem: () => ({ image: "", caption: "", value: "1" }) },
  ],

  defaults: () => ({
    items: [
      { image: "", caption: "Symbol 1", value: "10" },
      { image: "", caption: "Symbol 2", value: "20" },
    ],
  }),

  validate(p) {
    const issues = [];
    const items = p.items || [];
    if (!items.length) issues.push({ field: "items", msg: "Es ist kein einziges Bild eingetragen." });
    items.forEach((item, i) => {
      if (!String(item.value ?? "").trim()) {
        issues.push({ field: `items.${i}.value`, msg: `Bild ${i + 1} hat keine Zahl.` });
      }
      if (!item.image) {
        issues.push({ field: `items.${i}.image`, level: "warn", msg: `Bild ${i + 1} hat kein Bild — es wird nur die Beschriftung angezeigt.` });
      }
    });
    return issues;
  },

  check(p, answer) {
    const items = p.items || [];
    if (!Array.isArray(answer) || answer.length !== items.length) return false;
    return items.every((item, i) => String(answer[i] ?? "").trim() === String(item.value ?? "").trim());
  },

  render(ctx) {
    const { puzzle, path, cfg } = ctx;
    const inputs = [];

    const node = h("div", { class: "p-assign" },
      (puzzle.items || []).map((item, i) => {
        const input = h("input", {
          class: "assign-input", type: "text", inputmode: "numeric",
          maxlength: "4", autocomplete: "off", placeholder: "?",
        });
        inputs.push(input);
        const src = assetUrl(cfg, item.image);
        return h("div", { class: "assign-row", bind: `${path}.items.${i}` },
          src
            ? h("img", { class: "assign-img", src, alt: item.caption || "" })
            : h("div", { class: "assign-img assign-img--empty", text: "🖼" }),
          h("span", { class: "assign-caption", text: item.caption || "" }),
          input,
        );
      }),
    );

    return { node, getAnswer: () => inputs.map((i) => i.value) };
  },
};
