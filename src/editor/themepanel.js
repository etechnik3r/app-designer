/* Design-Spalte.
   Das Theme besteht aus denselben CSS-Variablen, die der Player
   benutzt - deshalb wirkt jede Aenderung sofort in der Vorschau,
   ohne dass irgendetwas neu gebaut werden muss.

   Die Kontrastpruefung ist keine Spielerei: ohne sie entstehen
   zuverlaessig hellgelbe Schriften auf weissem Grund.             */

import { h, clear } from "../player/dom.js";
import { store, applyOps, setValue } from "./store.js";
import { THEMES, EDITABLE_COLORS, themeTokens, contrastRatio, readableInk } from "../shared/themes.js";
import { makeIcon } from "./media.js";

function contrastPill(label, foreground, background, onFix) {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return null;
  const level = ratio >= 4.5 ? "ok" : ratio >= 3 ? "warn" : "no";
  const pill = h("span", { class: `pill pill--${level}`, text: `${label}: ${ratio.toFixed(1)}:1` });
  if (level === "ok") return pill;
  return h("div", { class: "rowline" },
    pill,
    h("button", { class: "mini", type: "button", text: "✓", title: "automatisch korrigieren", onclick: onFix }),
  );
}

export function renderThemePanel(container) {
  clear(container);
  const theme = store.cfg.theme;
  const tokens = themeTokens(theme);

  /* --- Vorlagen --- */
  container.append(h("div", { class: "group-label", text: "Vorlage" }));
  const presetRow = h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } });
  for (const [key, preset] of Object.entries(THEMES)) {
    presetRow.appendChild(h("button", {
      class: `item ${theme.preset === key ? "is-active" : ""}`, type: "button",
      onclick: () => applyOps([
        { op: "set", path: "theme.preset", value: key },
        { op: "set", path: "theme.tokens", value: {} },     // eigene Farben weichen der Vorlage
      ], { label: "Vorlage gewechselt" }),
    },
      h("span", { class: "ico", text: preset.icon }),
      h("span", { class: "label", text: preset.label }),
    ));
  }
  container.appendChild(presetRow);

  /* --- Farben --- */
  container.append(h("div", { class: "hr" }), h("div", { class: "group-label", text: "Farben" }));

  for (const { key, label } of EDITABLE_COLORS) {
    const value = tokens[key];
    const swatch = h("input", { class: "swatch", type: "color", value: toHex(value) });
    swatch.addEventListener("input", () =>
      setValue(`theme.tokens.${key}`, swatch.value, { coalesce: true, label: `Farbe ${label}` }));

    const text = h("input", { type: "text", value });
    text.addEventListener("change", () =>
      setValue(`theme.tokens.${key}`, text.value, { label: `Farbe ${label}` }));

    container.appendChild(h("div", { class: "field" },
      h("label", { text: label }),
      h("div", { class: "rowline" }, swatch, text),
    ));
  }

  container.appendChild(h("button", {
    class: "tbtn", type: "button", text: "Farben auf Vorlage zurücksetzen",
    onclick: () => applyOps({ op: "set", path: "theme.tokens", value: {} }, { label: "Farben zurückgesetzt" }),
  }));

  /* --- Lesbarkeit --- */
  container.append(h("div", { class: "hr" }), h("div", { class: "group-label", text: "Lesbarkeit" }));
  const checks = h("div", { style: { display: "flex", flexDirection: "column", gap: "6px" } },
    contrastPill("Schrift auf Hintergrund", tokens.ink, tokens.bg,
      () => setValue("theme.tokens.ink", readableInk(tokens.bg), { label: "Schriftfarbe korrigiert" })),
    contrastPill("Schrift auf Kachel", tokens.ink, tokens.panel,
      () => setValue("theme.tokens.panel", readableInk(tokens.ink) === "#ffffff" ? "#1a1a24" : "#eef0f6",
        { label: "Kachelfarbe korrigiert" })),
    contrastPill("Knopfschrift", tokens["on-primary"], tokens.primary,
      () => setValue("theme.tokens.on-primary", readableInk(tokens.primary), { label: "Knopfschrift korrigiert" })),
  );
  container.appendChild(checks);
  container.appendChild(h("div", { class: "help",
    text: "Ab 4,5:1 gilt Text als gut lesbar (Richtwert der Barrierefreiheits-Richtlinie WCAG AA)." }));

  /* --- Schriftgroesse --- */
  container.append(h("div", { class: "hr" }), h("div", { class: "group-label", text: "Schrift und Symbol" }));
  const scale = Number(theme.fontScale) || 1;
  const scaleOut = h("span", { class: "pill", text: `${Math.round(scale * 100)} %` });
  const scaleInput = h("input", { type: "range", min: "0.85", max: "1.35", step: "0.05", value: String(scale), style: { flex: "1" } });
  scaleInput.addEventListener("input", () => {
    scaleOut.textContent = `${Math.round(Number(scaleInput.value) * 100)} %`;
    setValue("theme.fontScale", Number(scaleInput.value), { coalesce: true, label: "Schriftgröße" });
  });
  container.appendChild(h("div", { class: "field" },
    h("label", { text: "Schriftgröße (kleines Tablet vs. großes iPad)" }),
    h("div", { class: "rowline" }, scaleInput, scaleOut),
  ));

  const emojiInput = h("input", { type: "text", maxlength: "4", value: theme.iconSeed || "🔬",
    style: { width: "5em", textAlign: "center", fontSize: "18px" } });
  emojiInput.addEventListener("input", () => setValue("theme.iconSeed", emojiInput.value, { coalesce: true, label: "App-Symbol" }));

  const iconPreview = h("img", { src: makeIcon(theme.iconSeed || "🔬", tokens.bg, 96),
    style: { width: "48px", height: "48px", borderRadius: "10px" }, alt: "" });

  container.appendChild(h("div", { class: "field" },
    h("label", { text: "App-Symbol" }),
    h("div", { class: "rowline" }, emojiInput, iconPreview),
    h("div", { class: "help", text: "Wird beim ZIP-Export zu icon-192.png und icon-512.png." }),
  ));
}

/* <input type="color"> versteht nur #rrggbb. */
function toHex(value) {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value;
  if (typeof value === "string" && /^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value.slice(1).split("").map((c) => c + c).join("")}`;
  }
  return "#000000";
}
