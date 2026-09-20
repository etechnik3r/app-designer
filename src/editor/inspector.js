/* Der Inspektor rechts.
   Faustregel der Bedienung: Was man sieht, bearbeitet man dort, wo
   man es sieht (direkt in der Vorschau). Was man NICHT sieht - die
   richtige Antwort, Zuordnungen, die PIN - bearbeitet man hier.

   Die Oberflaeche wird nicht von Hand gebaut, sondern aus den
   fields-Manifesten der Raetseltypen erzeugt. Ein neuer Typ bekommt
   seine Eingabemaske dadurch geschenkt.                            */

import { h, clear } from "../player/dom.js";
import { getPath } from "../shared/path.js";
import { store, setValue, applyOps, setSelection } from "./store.js";
import { puzzleDef, PUZZLES } from "../puzzles/index.js";
import { defaultPuzzle } from "../shared/schema.js";
import { importImage, pickFile } from "./media.js";
import { toast } from "./dialogs.js";

/* Felder der Bildschirmtypen. Bewusst hier und nicht im Schema:
   der Player soll diese Beschreibungen nicht mitschleppen.        */
const SCREEN_FIELDS = {
  start: [
    { key: "eyebrow", type: "text", label: "Kleine Zeile oben" },
    { key: "headline", type: "text", label: "Überschrift" },
    { key: "sub", type: "textarea", label: "Untertitel" },
    { key: "cta", type: "text", label: "Beschriftung des Knopfs" },
  ],
  video: [
    { key: "source.kind", type: "select", label: "Woher kommt das Video?",
      options: [
        { value: "none", label: "noch keins" },
        { value: "file", label: "Datei liegt daneben" },
        { value: "url", label: "Adresse im Netz" },
      ] },
    { key: "source.name", type: "text", label: "Dateiname", showIf: (s) => s.source?.kind === "file",
      help: "z. B. video1.mp4 — die Datei kommt später in denselben Ordner." },
    { key: "source.url", type: "text", label: "Adresse", showIf: (s) => s.source?.kind === "url",
      help: "YouTube- und Vimeo-Links werden automatisch eingebettet." },
    { key: "autoplay", type: "toggle", label: "Automatisch starten" },
    { key: "skippable", type: "toggle", label: "Überspringen erlauben" },
    { key: "cta", type: "text", label: "Beschriftung des Knopfs" },
  ],
  overview: [
    { key: "headline", type: "text", label: "Überschrift" },
    { key: "mode", type: "select", label: "Reihenfolge",
      options: [
        { value: "free", label: "frei wählbar" },
        { value: "linear", label: "der Reihe nach" },
      ] },
    { key: "finalCta", type: "text", label: "Knopf zum Abschluss" },
  ],
  final: [
    { key: "headline", type: "text", label: "Überschrift" },
    { key: "text", type: "textarea", label: "Text" },
    { key: "revealLabel", type: "text", label: "Beschriftung über dem Lösungswort" },
    { key: "reveal", type: "text", label: "Lösungswort" },
    { key: "video.kind", type: "select", label: "Abschlussvideo",
      options: [
        { value: "none", label: "keins" },
        { value: "file", label: "Datei liegt daneben" },
      ] },
    { key: "video.name", type: "text", label: "Dateiname", showIf: (s) => s.video?.kind === "file" },
  ],
};

const COMMON_PUZZLE_FIELDS = [
  { key: "title", type: "text", label: "Titel des Rätsels" },
  { key: "nr", type: "number", label: "Nummer in der Übersicht", min: 1, max: 99 },
  { key: "prompt", type: "textarea", label: "Frage oder Erklärtext", help: "Leer lassen, wenn das Rätsel im Raum steht." },
  { key: "hint", type: "textarea", label: "Tipp (wird unter dem Rätsel angezeigt)" },
];

/* ---- Einzelne Feldtypen ------------------------------------------ */

function fieldShell(field, ...children) {
  return h("div", { class: "field" },
    h("label", { text: field.label }),
    ...children,
    field.help ? h("div", { class: "help", text: field.help }) : null,
  );
}

function textField(field, path, value) {
  const input = h("input", { type: "text", value: value ?? "" });
  input.addEventListener("input", () => setValue(path, input.value, { coalesce: true, label: field.label }));
  return fieldShell(field, input);
}

function textareaField(field, path, value) {
  const area = h("textarea", null);
  area.value = value ?? "";
  area.addEventListener("input", () => setValue(path, area.value, { coalesce: true, label: field.label }));
  return fieldShell(field, area);
}

function numberField(field, path, value) {
  const input = h("input", { type: "number", value: value ?? 0, min: field.min ?? 0, max: field.max ?? 999 });
  input.addEventListener("input", () => setValue(path, Number(input.value), { coalesce: true, label: field.label }));
  return fieldShell(field, input);
}

function sliderField(field, path, value) {
  const out = h("span", { class: "pill", text: String(value ?? field.min ?? 0) });
  const input = h("input", {
    type: "range", min: field.min ?? 0, max: field.max ?? 10, step: field.step ?? 1, value: value ?? field.min ?? 0,
    style: { flex: "1" },
  });
  input.addEventListener("input", () => {
    out.textContent = input.value;
    setValue(path, Number(input.value), { coalesce: true, label: field.label });
  });
  return fieldShell(field, h("div", { class: "rowline" }, input, out));
}

function toggleField(field, path, value) {
  const input = h("input", { type: "checkbox" });
  input.checked = value !== false;
  input.addEventListener("change", () => setValue(path, input.checked, { label: field.label }));
  return h("label", { class: "switch" }, input, h("span", { text: field.label }));
}

function selectField(field, path, value) {
  const select = h("select", null,
    (field.options || []).map((option) =>
      h("option", { value: String(option.value), text: option.label })),
  );
  select.value = String(value ?? field.options?.[0]?.value ?? "");
  select.addEventListener("change", () => {
    const raw = select.value;
    const picked = (field.options || []).find((o) => String(o.value) === raw);
    setValue(path, picked ? picked.value : raw, { label: field.label });
  });
  return fieldShell(field, select);
}

/* Liste von Texten als mehrzeiliges Feld: eine Zeile je Eintrag.
   Knapper als Einzelfelder und erlaubt Umsortieren per Ausschneiden. */
function listField(field, path, value) {
  const area = h("textarea", { style: { minHeight: "110px" } });
  area.value = (value || []).join("\n");
  area.addEventListener("input", () => {
    let lines = area.value.split("\n");
    if (field.fixedLength) lines = lines.slice(0, field.fixedLength);
    setValue(path, lines, { coalesce: true, label: field.label });
  });
  const hint = field.fixedLength ? `Genau ${field.fixedLength} Zeilen.` : "Eine Zeile je Eintrag.";
  return fieldShell({ ...field, help: field.help || hint }, area);
}

function emojiField(field, path, value) {
  const input = h("input", { type: "text", maxlength: "4", value: value ?? "", style: { width: "5em", textAlign: "center", fontSize: "18px" } });
  input.addEventListener("input", () => setValue(path, input.value, { coalesce: true, label: field.label }));
  return fieldShell(field, input);
}

function optionPickField(field, path, value, context) {
  const options = getPath(store.cfg, `${context.basePath}.${field.from}`) || [];
  const select = h("select", null,
    options.map((option) => h("option", { value: String(option), text: String(option) })),
  );
  select.value = String(value ?? "");
  select.addEventListener("change", () => setValue(path, select.value, { label: field.label }));
  const ok = options.includes(value);
  return fieldShell(field, select,
    ok ? null : h("div", { class: "help", style: { color: "var(--e-no)" }, text: "Die markierte Antwort steht nicht in der Liste." }));
}

function zonePickField(field, path, value, context) {
  const zones = getPath(store.cfg, `${context.basePath}.${field.from}`) || ["A", "B"];
  const select = h("select", null,
    zones.slice(0, 2).map((zone, i) => h("option", { value: String(i), text: String(zone) })),
  );
  select.value = String(value ?? 0);
  select.addEventListener("change", () => setValue(path, Number(select.value), { label: field.label }));
  return fieldShell(field, select);
}

function imageField(field, path, value) {
  const asset = store.cfg.assets?.[value];
  const preview = asset
    ? h("img", { class: "thumb", src: asset.data, alt: "" })
    : h("div", { class: "drop-hint", text: "Bild hierher ziehen oder klicken" });

  const setImage = async (file) => {
    try {
      const { id, asset: newAsset } = await importImage(file, "normal");
      applyOps([
        { op: "set", path: `assets.${id}`, value: newAsset },
        { op: "set", path, value: id },
      ], { label: "Bild eingefügt" });
    } catch (err) {
      toast(`Bild konnte nicht gelesen werden: ${err.message}`, true);
    }
  };

  preview.addEventListener("click", async () => {
    const file = await pickFile();
    if (file) setImage(file);
  });
  preview.addEventListener("dragover", (event) => { event.preventDefault(); preview.classList.add("is-over"); });
  preview.addEventListener("dragleave", () => preview.classList.remove("is-over"));
  preview.addEventListener("drop", (event) => {
    event.preventDefault();
    preview.classList.remove("is-over");
    const file = event.dataTransfer?.files?.[0];
    if (file) setImage(file);
  });

  return fieldShell(field, preview,
    asset
      ? h("div", { class: "rowline" },
          h("span", { class: "help", text: `${asset.w}×${asset.h}` }),
          h("button", { class: "mini", type: "button", text: "✕", title: "Bild entfernen",
            onclick: () => setValue(path, "", { label: "Bild entfernt" }) }))
      : null,
  );
}

function objectListField(field, path, value, context) {
  const items = value || [];
  const wrap = h("div", { class: "field" }, h("label", { text: field.label }));

  items.forEach((item, index) => {
    const card = h("div", { class: "subcard" },
      h("div", { class: "subcard-head" },
        h("span", { class: "label", text: field.itemLabel ? field.itemLabel(item, index) : `Eintrag ${index + 1}` }),
        h("button", { class: "mini", type: "button", text: "▲", disabled: index === 0,
          onclick: () => applyOps({ op: "move", path, from: index, to: index - 1 }, { label: "verschoben" }) }),
        h("button", { class: "mini", type: "button", text: "▼", disabled: index === items.length - 1,
          onclick: () => applyOps({ op: "move", path, from: index, to: index + 1 }, { label: "verschoben" }) }),
        h("button", { class: "mini", type: "button", text: "🗑",
          onclick: () => applyOps({ op: "remove", path, index }, { label: "Eintrag gelöscht" }) }),
      ),
      field.itemFields.map((sub) =>
        renderField(sub, `${path}.${index}.${sub.key}`, getPath(store.cfg, `${path}.${index}.${sub.key}`), context)),
    );
    wrap.appendChild(card);
  });

  wrap.appendChild(h("button", {
    class: "tbtn", type: "button", text: "+ Eintrag",
    onclick: () => applyOps({ op: "insert", path, value: field.newItem() }, { label: "Eintrag hinzugefügt" }),
  }));
  return wrap;
}

export function renderField(field, path, value, context = {}) {
  switch (field.type) {
    case "text": return textField(field, path, value);
    case "textarea": return textareaField(field, path, value);
    case "number": return numberField(field, path, value);
    case "slider": return sliderField(field, path, value);
    case "toggle": return toggleField(field, path, value);
    case "select": return selectField(field, path, value);
    case "list": return listField(field, path, value);
    case "objectlist": return objectListField(field, path, value, context);
    case "image": return imageField(field, path, value);
    case "emoji": return emojiField(field, path, value);
    case "optionpick": return optionPickField(field, path, value, context);
    case "zonepick": return zonePickField(field, path, value, context);
    default: return h("div", { class: "help", text: `Unbekannter Feldtyp „${field.type}"` });
  }
}

/* ---- Der ganze Inspektor ------------------------------------------ */

export function renderInspector(container) {
  clear(container);
  const selection = store.selection;
  const cfg = store.cfg;

  const puzzleMatch = String(selection || "").match(/^puzzles\.(\d+)/);
  const flowMatch = String(selection || "").match(/^flow\.(\d+)/);

  if (puzzleMatch) {
    renderPuzzleInspector(container, Number(puzzleMatch[1]));
  } else if (flowMatch) {
    renderScreenInspector(container, Number(flowMatch[1]));
  } else if (selection === "__party__") {
    renderPartyInspector(container);
  } else {
    container.appendChild(h("div", { class: "empty" },
      "Nichts ausgewählt.",
      h("br"),
      "In der Vorschau auf einen Text tippen, um ihn direkt zu ändern — ",
      "oder links einen Bildschirm bzw. ein Rätsel wählen."));
  }
}

function renderScreenInspector(container, index) {
  const screen = store.cfg.flow[index];
  if (!screen) return;
  const path = `flow.${index}`;
  const fields = SCREEN_FIELDS[screen.type] || [];

  container.append(
    h("div", { class: "group-label", text: "Bildschirm" }),
    h("div", { class: "pill", text: screen.type }),
    h("div", { class: "hr" }),
    ...fields
      .filter((field) => !field.showIf || field.showIf(screen))
      .map((field) => renderField(field, `${path}.${field.key}`, getPath(store.cfg, `${path}.${field.key}`), { basePath: path })),
  );
}

function renderPuzzleInspector(container, index) {
  const puzzle = store.cfg.puzzles[index];
  if (!puzzle) return;
  const path = `puzzles.${index}`;
  const def = puzzleDef(puzzle.type);

  const typeSelect = h("select", null,
    PUZZLES.map((p) => h("option", { value: p.id, text: `${p.icon} ${p.label}` })),
  );
  typeSelect.value = puzzle.type;
  typeSelect.addEventListener("change", () => {
    const fresh = defaultPuzzle(typeSelect.value, puzzle.nr);
    /* Gemeinsame Angaben bleiben erhalten, der typabhaengige Teil
       wird ersetzt - sonst blieben unpassende Felder zurueck. */
    const merged = { ...fresh, id: puzzle.id, nr: puzzle.nr, title: puzzle.title, prompt: puzzle.prompt, hint: puzzle.hint };
    applyOps({ op: "set", path, value: merged }, { label: "Rätseltyp gewechselt" });
  });

  container.append(
    h("div", { class: "group-label", text: "Rätsel" }),
    h("div", { class: "field" }, h("label", { text: "Rätseltyp" }), typeSelect,
      def ? h("div", { class: "help", text: def.summary }) : null),
    h("div", { class: "hr" }),
    ...COMMON_PUZZLE_FIELDS.map((field) =>
      renderField(field, `${path}.${field.key}`, getPath(store.cfg, `${path}.${field.key}`), { basePath: path })),
    h("div", { class: "hr" }),
    ...(def?.fields || []).map((field) =>
      renderField(field, `${path}.${field.key}`, getPath(store.cfg, `${path}.${field.key}`), { basePath: path })),
  );
}

function renderPartyInspector(container) {
  const cfg = store.cfg;
  container.append(
    h("div", { class: "group-label", text: "Party" }),
    renderField({ key: "meta.title", type: "text", label: "Name der Party" }, "meta.title", cfg.meta.title),
    h("div", { class: "hr" }),
    h("div", { class: "group-label", text: "Für Erwachsene" }),
    renderField({ key: "parent.pin", type: "text", label: "PIN für das Einstellungsmenü",
      help: "Vier Ziffern. Damit kommen Erwachsene an Sprungmarken und den Spielstand." },
      "parent.pin", cfg.parent.pin),
    renderField({ key: "parent.allowMarkSolved", type: "toggle", label: "Rätsel von Hand auf gelöst schalten" },
      "parent.allowMarkSolved", cfg.parent.allowMarkSolved),
  );
}
