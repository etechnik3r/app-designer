/* Die linke Spalte: der Ablauf und die Raetselliste.
   Hier passiert alles Strukturelle - anlegen, loeschen, umsortieren.
   Inhalte werden dagegen in der Vorschau oder im Inspektor geaendert. */

import { h, clear } from "../player/dom.js";
import { store, applyOps, setSelection, setView } from "./store.js";
import { SCREEN_TYPES, defaultScreen, defaultPuzzle } from "../shared/schema.js";
import { PUZZLES } from "../puzzles/index.js";
import { FREE_PUZZLE_LIMIT } from "../shared/license.js";
import { modal, toast, confirmDialog } from "./dialogs.js";

function itemRow({ icon, label, type, active, onSelect, actions }) {
  return h("div", { class: `item ${active ? "is-active" : ""}`, onclick: onSelect },
    h("span", { class: "ico", text: icon }),
    h("span", { class: "label" },
      h("div", { text: label }),
      type ? h("div", { class: "type", text: type }) : null),
    h("span", { class: "item-actions" }, actions),
  );
}

function miniButton(label, title, disabled, handler) {
  return h("button", {
    class: "mini", type: "button", text: label, title, disabled,
    onclick: (event) => { event.stopPropagation(); handler(); },
  });
}

async function pickFromList(title, entries) {
  const body = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } });
  let resolveChoice;
  const done = new Promise((resolve) => { resolveChoice = resolve; });

  for (const entry of entries) {
    body.appendChild(h("button", { class: "item", type: "button",
      onclick: () => { resolveChoice(entry.value); document.querySelector(".modal")?.remove(); },
    },
      h("span", { class: "ico", text: entry.icon }),
      h("span", { class: "label" },
        h("div", { text: entry.label }),
        entry.help ? h("div", { class: "type", text: entry.help }) : null),
    ));
  }

  modal({ title, body, actions: [{ label: "Abbrechen", value: null }] })
    .then((result) => { if (result === null) resolveChoice(null); });

  return done;
}

/* Neue Bildschirme landen vor dem Abschluss - fast immer die
   gemeinte Stelle. */
function insertIndexForScreen() {
  const finalIndex = store.cfg.flow.findIndex((s) => s.type === "final");
  return finalIndex < 0 ? store.cfg.flow.length : finalIndex;
}

async function addScreen() {
  const existing = new Set(store.cfg.flow.map((s) => s.type));
  const entries = Object.entries(SCREEN_TYPES)
    .filter(([type, def]) => !(def.unique && existing.has(type)))
    .map(([type, def]) => ({ value: type, icon: def.icon, label: def.label }));

  if (!entries.length) { toast("Alle möglichen Bildschirme sind schon im Ablauf."); return; }

  const type = await pickFromList("Bildschirm hinzufügen", entries);
  if (!type) return;
  const index = insertIndexForScreen();
  applyOps({ op: "insert", path: "flow", index, value: defaultScreen(type) }, { label: "Bildschirm hinzugefügt" });
  setSelection(`flow.${index}`);
  setView({ kind: "flow", idx: index });
}

async function addPuzzle(onBlocked) {
  const unlimited = store.license.ok && store.license.features.includes("unlimited");
  if (!unlimited && store.cfg.puzzles.length >= FREE_PUZZLE_LIMIT) {
    onBlocked?.();
    return;
  }
  const entries = PUZZLES.map((def) => ({ value: def.id, icon: def.icon, label: def.label, help: def.summary }));
  const type = await pickFromList("Rätsel hinzufügen", entries);
  if (!type) return;

  const index = store.cfg.puzzles.length;
  applyOps({ op: "insert", path: "puzzles", value: defaultPuzzle(type, index + 1) }, { label: "Rätsel hinzugefügt" });
  setSelection(`puzzles.${index}`);
  setView({ kind: "puzzle", idx: index });
}

export function renderFlowStrip(container, { onBuyPrompt } = {}) {
  clear(container);
  const cfg = store.cfg;
  const selection = store.selection;

  container.appendChild(itemRow({
    icon: "🎉",
    label: cfg.meta.title || "Party",
    type: "Grundeinstellungen",
    active: selection === "__party__",
    onSelect: () => setSelection("__party__"),
    actions: [],
  }));

  container.appendChild(h("div", { class: "group-label", text: "Ablauf" }));

  cfg.flow.forEach((screen, index) => {
    const def = SCREEN_TYPES[screen.type] || { icon: "?", label: screen.type };
    container.appendChild(itemRow({
      icon: def.icon,
      label: screen.headline || def.label,
      type: def.label,
      active: selection === `flow.${index}`,
      onSelect: () => { setSelection(`flow.${index}`); setView({ kind: "flow", idx: index }); },
      actions: [
        miniButton("▲", "nach oben", index === 0, () =>
          applyOps({ op: "move", path: "flow", from: index, to: index - 1 }, { label: "Bildschirm verschoben" })),
        miniButton("▼", "nach unten", index === cfg.flow.length - 1, () =>
          applyOps({ op: "move", path: "flow", from: index, to: index + 1 }, { label: "Bildschirm verschoben" })),
        miniButton("🗑", "löschen", cfg.flow.length <= 1, async () => {
          if (await confirmDialog("Bildschirm löschen?", `„${screen.headline || def.label}" wird aus dem Ablauf entfernt.`, "Löschen")) {
            applyOps({ op: "remove", path: "flow", index }, { label: "Bildschirm gelöscht" });
            setSelection(null);
          }
        }),
      ],
    }));
  });

  container.appendChild(h("button", { class: "tbtn", type: "button", text: "+ Bildschirm", onclick: addScreen }));

  container.appendChild(h("div", { class: "group-label", text: `Rätsel (${cfg.puzzles.length})` }));

  cfg.puzzles.forEach((puzzle, index) => {
    const def = PUZZLES.find((p) => p.id === puzzle.type);
    container.appendChild(itemRow({
      icon: def?.icon || "❓",
      label: `${puzzle.nr ?? index + 1}. ${puzzle.title}`,
      type: def?.label || puzzle.type,
      active: selection === `puzzles.${index}` || String(selection || "").startsWith(`puzzles.${index}.`),
      onSelect: () => { setSelection(`puzzles.${index}`); setView({ kind: "puzzle", idx: index }); },
      actions: [
        miniButton("▲", "nach oben", index === 0, () =>
          applyOps({ op: "move", path: "puzzles", from: index, to: index - 1 }, { label: "Rätsel verschoben" })),
        miniButton("▼", "nach unten", index === cfg.puzzles.length - 1, () =>
          applyOps({ op: "move", path: "puzzles", from: index, to: index + 1 }, { label: "Rätsel verschoben" })),
        miniButton("🗑", "löschen", false, async () => {
          if (await confirmDialog("Rätsel löschen?", `„${puzzle.title}" wird entfernt.`, "Löschen")) {
            applyOps({ op: "remove", path: "puzzles", index }, { label: "Rätsel gelöscht" });
            setSelection(null);
          }
        }),
      ],
    }));
  });

  container.appendChild(h("button", {
    class: "tbtn", type: "button", text: "+ Rätsel",
    onclick: () => addPuzzle(onBuyPrompt),
  }));

  const unlimited = store.license.ok && store.license.features.includes("unlimited");
  if (!unlimited) {
    container.appendChild(h("div", { class: "help", style: { padding: "0 4px" },
      text: `Gratis sind ${FREE_PUZZLE_LIMIT} Rätsel möglich.` }));
  }
}
