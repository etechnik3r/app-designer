/* Dialoge und Hinweise. */

import { h, clear } from "../player/dom.js";

let toastTimer = null;

export function toast(message, isBad = false) {
  document.querySelector(".toast")?.remove();
  clearTimeout(toastTimer);
  const node = h("div", { class: `toast ${isBad ? "toast--bad" : ""}`, text: message });
  document.body.appendChild(node);
  toastTimer = setTimeout(() => node.remove(), isBad ? 6000 : 3000);
}

/* actions: [{ label, primary?, value }] - der Rueckgabewert des
   Versprechens ist der value des gedrueckten Knopfs (null bei Abbruch). */
export function modal({ title, body, actions = [{ label: "Schließen", value: null, primary: true }], wide = false }) {
  return new Promise((resolve) => {
    const card = h("div", { class: "modal-card", style: wide ? { width: "min(760px, 100%)" } : null });
    const overlay = h("div", { class: "modal" }, card);

    const close = (value) => { overlay.remove(); document.removeEventListener("keydown", onKey); resolve(value); };
    const onKey = (event) => { if (event.key === "Escape") close(null); };

    card.append(
      h("h2", { text: title }),
      body instanceof Node ? body : h("p", { text: String(body ?? "") }),
      h("div", { class: "modal-actions" },
        actions.map((action) =>
          h("button", {
            class: `tbtn ${action.primary ? "tbtn--primary" : ""}`, type: "button",
            text: action.label, onclick: () => close(action.value),
          })),
      ),
    );

    overlay.addEventListener("click", (event) => { if (event.target === overlay) close(null); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    card.querySelector("input,textarea,button")?.focus();
  });
}

export function confirmDialog(title, text, okLabel = "Ja, weiter") {
  return modal({
    title,
    body: h("p", { text }),
    actions: [
      { label: "Abbrechen", value: false },
      { label: okLabel, value: true, primary: true },
    ],
  });
}

export function promptDialog(title, label, value = "") {
  const input = h("input", { type: "text", value });
  const body = h("div", { class: "field" }, h("label", { text: label }), input);
  return modal({
    title, body,
    actions: [
      { label: "Abbrechen", value: null },
      { label: "Übernehmen", value: "__ok__", primary: true },
    ],
  }).then((result) => (result === "__ok__" ? input.value : null));
}

/* Befundliste vor dem Export. */
export function issuesDialog(issues, onJump) {
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level !== "error");

  const list = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    issues.length === 0
      ? h("p", { text: "Keine Beanstandungen. Die Party kann so exportiert werden." })
      : issues.map((issue) =>
          h("div", { class: `issue issue--${issue.level === "error" ? "error" : "warn"}`,
            onclick: () => onJump?.(issue.path) },
            h("span", { text: issue.level === "error" ? "⛔" : "⚠️" }),
            h("div", null,
              h("div", { text: issue.msg }),
              h("div", { class: "path", text: issue.path })),
          )),
  );

  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "10px" } },
    h("p", { text: `${errors.length} Fehler, ${warnings.length} Hinweise. Ein Klick springt zur Stelle.` }),
    list,
  );

  return modal({ title: "Prüfung", body, wide: true });
}

/* Kaufdialog. Die eigentliche Pruefung passiert im Browser gegen
   den oeffentlichen Schluessel - siehe src/shared/license.js.     */
export function unlockDialog({ payUrl, partyId, onToken }) {
  const input = h("input", { type: "text", placeholder: "PARTY-1.…" });
  const status = h("div", { class: "help" });

  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "12px" } },
    h("p", { text: "Für 2 € entfällt das Wasserzeichen. Dazu kommen: eigener Titel und eigenes App-Symbol, das Begleitmaterial als Textdatei und beliebig viele Rätsel." }),
    h("a", { class: "tbtn tbtn--buy", href: payUrl, target: "_blank", rel: "noopener",
      text: "Jetzt für 2 € freischalten", style: { textDecoration: "none", justifyContent: "center" } }),
    h("p", { class: "help", text: `Nach der Zahlung kommt ein Schlüssel zurück. Diese Party hat die Kennung ${partyId}.` }),
    h("div", { class: "field" },
      h("label", { text: "Schlüssel einsetzen" }),
      input,
      status,
    ),
  );

  return modal({
    title: "Wasserzeichen entfernen",
    body,
    actions: [
      { label: "Später", value: null },
      { label: "Schlüssel prüfen", value: "__check__", primary: true },
    ],
  }).then(async (result) => {
    if (result !== "__check__") return null;
    return onToken(input.value.trim());
  });
}

export function listDialog(title, rows, { emptyText = "Nichts vorhanden." } = {}) {
  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    rows.length ? rows : h("p", { text: emptyText }));
  return modal({ title, body, wide: true });
}

export { clear };
