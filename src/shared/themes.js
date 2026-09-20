/* Design-Tokens.
   Jeder Schluessel ist 1:1 eine CSS-Custom-Property im Player:
   "panel-2" wird zu --panel-2. Keine Umrechnung, keine Magie -
   dadurch kann man ein Theme im Browser-Inspektor direkt nachvollziehen. */

export const TOKEN_KEYS = [
  "bg", "grid", "panel", "panel-2", "edge",
  "ink", "muted",
  "primary", "on-primary",
  "info",
  "amber", "on-amber",
  "ok", "on-ok",
  "no",
  "radius",
];

/* Nur diese Tokens bekommen im Editor einen Farbwaehler.
   Der Rest wird abgeleitet oder ist selten interessant. */
export const EDITABLE_COLORS = [
  { key: "bg", label: "Hintergrund" },
  { key: "panel", label: "Kachel" },
  { key: "ink", label: "Schrift" },
  { key: "primary", label: "Hauptfarbe" },
  { key: "amber", label: "Aktueller Schritt" },
  { key: "ok", label: "Richtig" },
  { key: "no", label: "Falsch" },
];

export const THEMES = {
  labor: {
    label: "Labor", icon: "🔬",
    tokens: {
      "bg": "#171540", "grid": "rgba(150,140,255,.07)",
      "panel": "#221f57", "panel-2": "#2c286e", "edge": "rgba(170,160,255,.18)",
      "ink": "#f4f2ff", "muted": "#b3aee0",
      "primary": "#8b6cff", "on-primary": "#ffffff",
      "info": "#5b9dff",
      "amber": "#ffb62e", "on-amber": "#3a2600",
      "ok": "#37d67a", "on-ok": "#053021",
      "no": "#ff6a5a",
      "radius": "20px",
    },
  },
  detektiv: {
    label: "Detektiv", icon: "🕵️",
    tokens: {
      "bg": "#12161f", "grid": "rgba(255,210,140,.06)",
      "panel": "#1c2231", "panel-2": "#252d40", "edge": "rgba(230,200,150,.18)",
      "ink": "#f3efe6", "muted": "#a9a596",
      "primary": "#c8a04a", "on-primary": "#1a1408",
      "info": "#6fa8d6",
      "amber": "#e8b04b", "on-amber": "#231803",
      "ok": "#4fc98a", "on-ok": "#04281a",
      "no": "#e0645a",
      "radius": "12px",
    },
  },
  pirat: {
    label: "Piraten", icon: "🏴‍☠️",
    tokens: {
      "bg": "#10263a", "grid": "rgba(255,225,160,.07)",
      "panel": "#17384f", "panel-2": "#1f4a66", "edge": "rgba(255,220,160,.22)",
      "ink": "#fdf6e3", "muted": "#a8c2d2",
      "primary": "#e0a13a", "on-primary": "#2a1900",
      "info": "#58b3d8",
      "amber": "#ffcf5c", "on-amber": "#3a2a00",
      "ok": "#4ecb8c", "on-ok": "#04291b",
      "no": "#e4635a",
      "radius": "16px",
    },
  },
  weltraum: {
    label: "Weltraum", icon: "🚀",
    tokens: {
      "bg": "#05070f", "grid": "rgba(120,220,255,.08)",
      "panel": "#0d1426", "panel-2": "#152037", "edge": "rgba(120,200,255,.2)",
      "ink": "#eaf4ff", "muted": "#8ea6c4",
      "primary": "#35d6d0", "on-primary": "#00201f",
      "info": "#6fa9ff",
      "amber": "#ffc960", "on-amber": "#2e2000",
      "ok": "#4be08f", "on-ok": "#012a18",
      "no": "#ff7a6b",
      "radius": "18px",
    },
  },
  einhorn: {
    label: "Einhorn", icon: "🦄",
    tokens: {
      "bg": "#3a1f52", "grid": "rgba(255,200,255,.08)",
      "panel": "#4d2a6b", "panel-2": "#5e3582", "edge": "rgba(255,210,250,.25)",
      "ink": "#fff4fd", "muted": "#dcbde8",
      "primary": "#ff8ad1", "on-primary": "#3d0026",
      "info": "#8ad4ff",
      "amber": "#ffd166", "on-amber": "#3d2a00",
      "ok": "#5fe2a5", "on-ok": "#01331f",
      "no": "#ff6f8d",
      "radius": "26px",
    },
  },
};

export function themeTokens(theme) {
  const preset = THEMES[theme?.preset] || THEMES.labor;
  return { ...preset.tokens, ...(theme?.tokens || {}) };
}

/* Vorlagen fuer den Farbverlauf-Hintergrund. Eigene Farben bleiben
   trotzdem moeglich - das sind nur die Startpunkte im Design-Reiter. */
export const GRADIENT_PRESETS = [
  { label: "Labor-Lila", from: "#241c5e", to: "#5a48c9", angle: 140 },
  { label: "Sonnenuntergang", from: "#ff7a45", to: "#c7396b", angle: 135 },
  { label: "Ozean", from: "#0b3d5c", to: "#1fb6b0", angle: 135 },
  { label: "Dschungel", from: "#0e3b2b", to: "#4cb573", angle: 130 },
  { label: "Zuckerwatte", from: "#5c1f4e", to: "#ff8ad1", angle: 140 },
  { label: "Sternennacht", from: "#04060d", to: "#1c2c52", angle: 160 },
];

/* Setzt die Tokens auf ein Element (im Player: <html>). assets wird
   nur fuer ein Hintergrundbild gebraucht - dort steckt die Data-URL. */
export function applyTheme(rootEl, theme, assets) {
  const tokens = themeTokens(theme);
  for (const key of TOKEN_KEYS) {
    if (tokens[key] != null) rootEl.style.setProperty(`--${key}`, tokens[key]);
  }
  const scale = Number(theme?.fontScale) || 1;
  rootEl.style.setProperty("--font-scale", String(scale));
  applyBackground(rootEl, theme?.background, assets);
}

function applyBackground(rootEl, background, assets) {
  const style = rootEl.style;
  const kind = background?.kind || "pattern";

  if (kind === "gradient" && background.gradient) {
    const { from, to, angle } = background.gradient;
    style.setProperty("--bg-image", `linear-gradient(${Number.isFinite(angle) ? angle : 135}deg, ${from || "#241c5e"}, ${to || "#5a48c9"})`);
    style.setProperty("--bg-image-size", "auto");
    style.setProperty("--grid-opacity", "0");
    style.setProperty("--bg-dim", "0");
  } else if (kind === "image" && background.image && assets?.[background.image]?.data) {
    /* Anfuehrungszeichen um die Data-URL: sonst reisst ein "#" darin
       (kommt in manchen Base64-Auffuellungen zufaellig vor) die URL ab. */
    style.setProperty("--bg-image", `url("${assets[background.image].data}")`);
    style.setProperty("--bg-image-size", "cover");
    style.setProperty("--grid-opacity", "0");
    style.setProperty("--bg-dim", String(background.dim ?? 0.35));
  } else {
    /* "pattern" oder ein Bild, das (noch) fehlt: die bisherige Optik -
       Punktraster auf der Grundfarbe, kein Hintergrund haengt in der Luft. */
    style.setProperty("--bg-image", "none");
    style.setProperty("--bg-image-size", "auto");
    style.setProperty("--grid-opacity", "1");
    style.setProperty("--bg-dim", "0");
  }
}

/* ---- Kontrastpruefung (WCAG 2.1) --------------------------------
   Ohne diese Pruefung bauen Nutzer zuverlaessig hellgelbe Schrift
   auf Weiss. Der Editor warnt damit direkt beim Farbwaehlen.       */

export function parseColor(value) {
  if (typeof value !== "string") return null;
  const hex = value.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16));
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const m = value.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const parts = m[1].split(",").map((s) => parseFloat(s));
    if (parts.length >= 3) return parts.slice(0, 3).map((n) => Math.round(n));
  }
  return null;
}

function channelLuminance(c) {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function luminance(color) {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/* Waehlt Schwarz oder Weiss als Textfarbe auf einem Grund. */
export function readableInk(background) {
  const white = contrastRatio(background, "#ffffff") || 0;
  const black = contrastRatio(background, "#000000") || 0;
  return white >= black ? "#ffffff" : "#111111";
}
