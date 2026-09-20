/* Design-Spalte.
   Das Theme besteht aus denselben CSS-Variablen, die der Player
   benutzt - deshalb wirkt jede Aenderung sofort in der Vorschau,
   ohne dass irgendetwas neu gebaut werden muss.

   Die Kontrastpruefung ist keine Spielerei: ohne sie entstehen
   zuverlaessig hellgelbe Schriften auf weissem Grund.             */

import { h, clear } from "../player/dom.js";
import { store, applyOps, setValue } from "./store.js";
import { THEMES, GRADIENT_PRESETS, EDITABLE_COLORS, themeTokens, contrastRatio, readableInk } from "../shared/themes.js";
import { makeIcon, importImage, pickFile } from "./media.js";
import { toast } from "./dialogs.js";

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

  /* --- Hintergrund --- */
  container.append(h("div", { class: "hr" }), h("div", { class: "group-label", text: "Hintergrund" }));
  container.appendChild(renderBackgroundSection(store.cfg.theme.background || { kind: "pattern" }));

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

/* ---- Hintergrund: Punktmuster, Farbverlauf oder eigenes Bild ----- */

const BACKGROUND_KINDS = [
  { key: "pattern", icon: "▦", label: "Punktmuster" },
  { key: "gradient", icon: "🎨", label: "Farbverlauf" },
  { key: "image", icon: "🖼", label: "Eigenes Bild" },
];

function setBackground(patch, label) {
  applyOps({ op: "set", path: "theme.background", value: { ...store.cfg.theme.background, ...patch } }, { label });
}

function renderBackgroundSection(background) {
  const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });

  const kindRow = h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" } });
  for (const { key, icon, label } of BACKGROUND_KINDS) {
    kindRow.appendChild(h("button", {
      class: `item ${background.kind === key ? "is-active" : ""}`, type: "button",
      onclick: () => {
        /* Ohne Vorlage waere "Farbverlauf" ein Klick ohne sichtbare
           Wirkung - es gibt ja noch keinen Verlauf zum Zeigen. */
        const patch = { kind: key };
        if (key === "gradient" && !background.gradient) patch.gradient = { ...GRADIENT_PRESETS[0] };
        setBackground(patch, "Hintergrundart geändert");
      },
    },
      h("span", { class: "ico", text: icon }),
      h("span", { class: "label", text: label }),
    ));
  }
  wrap.appendChild(kindRow);

  if (background.kind === "gradient") wrap.appendChild(renderGradientEditor(background));
  else if (background.kind === "image") wrap.appendChild(renderImageEditor(background));
  else wrap.appendChild(h("div", { class: "help",
    text: "Das gepunktete Raster auf der Grundfarbe unten (Farben → Hintergrund)." }));

  return wrap;
}

function renderGradientEditor(background) {
  const grad = background.gradient || GRADIENT_PRESETS[0];
  const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });

  const presetRow = h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" } });
  for (const preset of GRADIENT_PRESETS) {
    const active = grad.from === preset.from && grad.to === preset.to;
    presetRow.appendChild(h("button", {
      class: `item ${active ? "is-active" : ""}`, type: "button",
      style: { background: `linear-gradient(${preset.angle}deg, ${preset.from}, ${preset.to})`, border: "1px solid var(--e-edge)" },
      onclick: () => setBackground({ kind: "gradient", gradient: { ...preset } }, "Farbverlauf gewählt"),
    },
      h("span", { class: "label", style: { color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.6)" }, text: preset.label }),
    ));
  }
  wrap.appendChild(presetRow);

  const fromInput = h("input", { class: "swatch", type: "color", value: toHex(grad.from) });
  fromInput.addEventListener("input", () =>
    setBackground({ kind: "gradient", gradient: { ...grad, from: fromInput.value } }, "Farbverlauf geändert"));
  const toInput = h("input", { class: "swatch", type: "color", value: toHex(grad.to) });
  toInput.addEventListener("input", () =>
    setBackground({ kind: "gradient", gradient: { ...grad, to: toInput.value } }, "Farbverlauf geändert"));

  wrap.appendChild(h("div", { class: "field" },
    h("label", { text: "Eigene Farben" }),
    h("div", { class: "rowline" },
      h("span", { class: "help", text: "von" }), fromInput,
      h("span", { class: "help", text: "nach" }), toInput),
  ));

  const angleOut = h("span", { class: "pill", text: `${grad.angle ?? 135}°` });
  const angleInput = h("input", { type: "range", min: "0", max: "360", step: "5", value: String(grad.angle ?? 135), style: { flex: "1" } });
  angleInput.addEventListener("input", () => {
    angleOut.textContent = `${angleInput.value}°`;
    setBackground({ kind: "gradient", gradient: { ...grad, angle: Number(angleInput.value) } }, "Verlaufsrichtung");
  });
  wrap.appendChild(h("div", { class: "field" },
    h("label", { text: "Richtung" }),
    h("div", { class: "rowline" }, angleInput, angleOut),
  ));

  return wrap;
}

function renderImageEditor(background) {
  const wrap = h("div", { style: { display: "flex", flexDirection: "column", gap: "8px" } });
  const asset = background.image ? store.cfg.assets?.[background.image] : null;

  const preview = asset
    ? h("img", { class: "thumb", src: asset.data, alt: "", style: { maxHeight: "140px" } })
    : h("div", { class: "drop-hint", text: "Hintergrundbild hierher ziehen oder klicken" });

  const setImage = async (file) => {
    try {
      const { id, asset: newAsset } = await importImage(file, "gross");
      applyOps([
        { op: "set", path: `assets.${id}`, value: newAsset },
        { op: "set", path: "theme.background", value: { ...store.cfg.theme.background, kind: "image", image: id } },
      ], { label: "Hintergrundbild eingefügt" });
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

  wrap.appendChild(h("div", { class: "field" }, h("label", { text: "Bild" }), preview));

  if (asset) {
    wrap.appendChild(h("button", {
      class: "tbtn", type: "button", text: "Bild entfernen",
      onclick: () => setBackground({ image: null, kind: "pattern" }, "Hintergrundbild entfernt"),
    }));
  }

  const dim = Number(background.dim ?? 0.35);
  const dimOut = h("span", { class: "pill", text: `${Math.round(dim * 100)} %` });
  const dimInput = h("input", { type: "range", min: "0", max: "0.8", step: "0.05", value: String(dim), style: { flex: "1" } });
  dimInput.addEventListener("input", () => {
    dimOut.textContent = `${Math.round(Number(dimInput.value) * 100)} %`;
    setBackground({ dim: Number(dimInput.value) }, "Bild abgedunkelt");
  });
  wrap.appendChild(h("div", { class: "field" },
    h("label", { text: "Abdunkeln (für lesbare Schrift)" }),
    h("div", { class: "rowline" }, dimInput, dimOut),
  ));

  return wrap;
}

/* <input type="color"> versteht nur #rrggbb. */
function toHex(value) {
  if (typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)) return value;
  if (typeof value === "string" && /^#[0-9a-f]{3}$/i.test(value)) {
    return `#${value.slice(1).split("").map((c) => c + c).join("")}`;
  }
  return "#000000";
}
