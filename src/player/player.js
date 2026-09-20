/* Die Spiel-Engine.
   Bekommt ein Party-Dokument und fuehrt es aus. Sie kennt keinen
   Editor - aber einen Bearbeitungsmodus, in dem sie zusaetzlich
   Datenpfade im Markup mitliefert (data-bind). Dadurch ist die
   Vorschau im Editor exakt das, was spaeter exportiert wird.       */

import { h, clear, assetUrl } from "./dom.js";
import { applyTheme } from "../shared/themes.js";
import { puzzleDef } from "../puzzles/index.js";
import { normalize } from "../shared/schema.js";
import { verifyLicense } from "../shared/license.js";

export const P = {
  cfg: null,
  mode: "play",          // "play" | "edit"
  view: { kind: "flow", idx: 0 },
  solved: new Set(),
  root: null,
  stage: null,
  license: { ok: false, features: [] },
  renderHooks: [],
};

/* ---------------- Spielstand ---------------- */

function storageKey() {
  return `party.progress.${P.cfg?.id || "unbekannt"}`;
}

function saveProgress() {
  if (P.mode === "edit") return;   // Testen soll den echten Stand nicht anfassen
  try {
    localStorage.setItem(storageKey(), JSON.stringify({ v: 1, solved: [...P.solved] }));
  } catch { /* privater Modus, voller Speicher: kein Grund abzustuerzen */ }
}

function loadProgress() {
  if (P.mode === "edit") return;
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey()) || "null");
    if (raw && Array.isArray(raw.solved)) P.solved = new Set(raw.solved);
  } catch { /* ignorieren */ }
}

export function resetProgress() {
  P.solved = new Set();
  try { localStorage.removeItem(storageKey()); } catch { /* ignorieren */ }
  gotoFlow(0);
}

/* ---------------- Ton und Konfetti ---------------- */

let audioCtx = null;
function tone(freqs, duration = 0.12) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = audioCtx.currentTime + i * duration;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + duration + 0.02);
    });
  } catch { /* ohne Ton ist auch gut */ }
}

function confetti() {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["var(--ok)", "var(--amber)", "var(--primary)", "var(--info)"];
  for (let i = 0; i < 40; i++) {
    const bit = document.createElement("i");
    Object.assign(bit.style, {
      position: "fixed", zIndex: "70", left: `${50 + (Math.random() - 0.5) * 40}%`,
      top: "45%", width: "9px", height: "14px", borderRadius: "2px",
      background: colors[i % colors.length], pointerEvents: "none",
    });
    document.body.appendChild(bit);
    const dx = (Math.random() - 0.5) * 520;
    const dy = -160 - Math.random() * 220;
    bit.animate(
      [
        { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${Math.random() * 540}deg)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx * 1.3}px, 70vh) rotate(${Math.random() * 900}deg)`, opacity: 0 },
      ],
      { duration: 1500 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.4,1)" },
    ).onfinish = () => bit.remove();
  }
}

/* ---------------- Navigation ---------------- */

export function gotoFlow(idx) {
  const max = (P.cfg?.flow?.length || 1) - 1;
  P.view = { kind: "flow", idx: Math.max(0, Math.min(max, idx)) };
  render();
}

export function gotoPuzzle(idx) {
  P.view = { kind: "puzzle", idx };
  render();
}

export function overviewIndex() {
  const i = P.cfg.flow.findIndex((s) => s.type === "overview");
  return i < 0 ? 0 : i;
}

export function backToOverview() {
  gotoFlow(overviewIndex());
}

function allSolved() {
  return P.cfg.puzzles.length > 0 && P.cfg.puzzles.every((p) => P.solved.has(p.id));
}

/* ---------------- Bildschirme ---------------- */

function screenStart(screen, path) {
  return h("section", { class: "screen screen--center is-active" },
    h("div", { class: "eyebrow", bind: `${path}.eyebrow`, text: screen.eyebrow || "Mission" }),
    h("h1", { bind: `${path}.headline`, text: screen.headline || "" }),
    h("p", { class: "sub", bind: `${path}.sub`, text: screen.sub || "" }),
    h("button", {
      class: "btn btn--primary btn--big", type: "button",
      bind: `${path}.cta`, text: screen.cta || "Start",
      onclick: () => { tone([520, 700]); gotoFlow(P.view.idx + 1); },
    }),
    badgeHero(),
  );
}

function embedUrl(url) {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return null;
}

function screenVideo(screen, path) {
  const source = screen.source || { kind: "none" };
  const next = () => gotoFlow(P.view.idx + 1);

  let media;
  if (source.kind === "url" && source.url) {
    const embed = embedUrl(source.url);
    media = embed
      ? h("iframe", { class: "party-video", src: embed, allow: "autoplay; fullscreen",
                      allowfullscreen: true, frameborder: "0", style: { height: "50vh", border: "0" } })
      : h("video", { class: "party-video", src: source.url, controls: true, playsinline: true });
  } else if (source.kind === "file" && source.name && P.mode === "edit") {
    /* Im Editor liegt die Videodatei praktisch nie neben dem Player.
       Statt bei jedem Neuzeichnen einen 404 zu erzeugen, zeigen wir
       den Platzhalter - abgespielt wird im Export.                 */
    media = h("div", { class: "video-missing" },
      h("p", { text: `🎬 ${source.name}` }),
      h("p", { class: "opt-note", text: "Wird beim Export abgespielt, sobald die Datei daneben liegt." }));
  } else if (source.kind === "file" && source.name) {
    const video = h("video", {
      class: "party-video", src: source.name, playsinline: true, controls: true,
      autoplay: screen.autoplay !== false, muted: screen.autoplay !== false,
    });
    video.addEventListener("ended", () => { if (P.mode === "play") next(); });
    video.addEventListener("error", () => {
      video.replaceWith(h("div", { class: "video-missing" },
        h("p", { text: `Die Videodatei „${source.name}" liegt nicht neben dieser Seite.` }),
        h("p", { class: "opt-note", text: "Der Ablauf läuft trotzdem weiter." })));
    });
    media = video;
  } else {
    media = h("div", { class: "video-missing", text: "Für diesen Bildschirm ist noch kein Video hinterlegt." });
  }

  return h("section", { class: "screen screen--center is-active" },
    h("div", { class: "video-wrap" },
      media,
      h("div", { class: "row" },
        h("button", {
          class: "btn btn--primary", type: "button",
          bind: `${path}.cta`, text: screen.cta || "Weiter", onclick: next,
        }),
        screen.skippable !== false && P.mode === "play"
          ? h("button", { class: "btn btn--ghost", type: "button", text: "Überspringen", onclick: next })
          : null,
      ),
    ),
    badge(),
  );
}

function screenOverview(screen, path) {
  const solvedCount = P.cfg.puzzles.filter((p) => P.solved.has(p.id)).length;
  const linear = screen.mode === "linear";

  const cards = P.cfg.puzzles.map((puzzle, i) => {
    const isSolved = P.solved.has(puzzle.id);
    const locked = linear && !isSolved && P.cfg.puzzles.slice(0, i).some((p) => !P.solved.has(p.id));
    return h("button", {
      class: `puzzle-card ${isSolved ? "is-solved" : ""} ${locked ? "is-locked" : ""}`,
      type: "button", bind: `puzzles.${i}`, disabled: locked,
      onclick: () => { if (!locked) gotoPuzzle(i); },
    },
      h("span", { class: "nr", text: isSolved ? "✓" : String(puzzle.nr ?? i + 1) }),
      h("span", { text: puzzle.title || `Rätsel ${i + 1}` }),
    );
  });

  const done = allSolved();
  return h("section", { class: "screen is-active" },
    h("h2", { bind: `${path}.headline`, text: screen.headline || "" }),
    h("div", { class: "progress", text: `${solvedCount} von ${P.cfg.puzzles.length} gelöst` }),
    h("div", { class: "overview-grid" }, cards),
    h("button", {
      class: `btn ${done ? "btn--ok btn--big" : "btn--ghost"}`, type: "button",
      bind: `${path}.finalCta`, text: screen.finalCta || "Zum Abschluss",
      disabled: !done && P.mode === "play",
      onclick: () => gotoFlow(P.view.idx + 1),
    }),
    badge(),
  );
}

function screenPuzzle(puzzle, i) {
  const def = puzzleDef(puzzle.type);
  const path = `puzzles.${i}`;

  if (!def) {
    return h("section", { class: "screen screen--center is-active" },
      h("h2", { text: `Unbekannter Rätseltyp „${puzzle.type}"` }),
      h("button", { class: "btn", type: "button", text: "Zurück", onclick: backToOverview }),
    );
  }

  const instance = def.render({ puzzle, path, cfg: P.cfg, mode: P.mode });
  const feedback = h("div", { class: "feedback" });
  const isSolved = P.solved.has(puzzle.id);

  const markSolved = () => {
    P.solved.add(puzzle.id);
    saveProgress();
    tone([660, 880, 1100]);
    confetti();
    feedback.className = "feedback is-ok";
    feedback.textContent = "Richtig!";
    setTimeout(() => { if (P.view.kind === "puzzle") backToOverview(); }, 1200);
  };

  const onCheck = () => {
    if (def.check(puzzle, instance.getAnswer())) {
      markSolved();
    } else {
      tone([220, 180], 0.16);
      feedback.className = "feedback is-no shake";
      feedback.textContent = "Noch nicht ganz — probiert es nochmal.";
      setTimeout(() => feedback.classList.remove("shake"), 420);
    }
  };

  return h("section", { class: "screen is-active" },
    h("div", { class: "eyebrow", text: `Rätsel ${puzzle.nr ?? i + 1}` }),
    h("h2", { bind: `${path}.title`, text: puzzle.title || "" }),
    h("div", { class: "puzzle-wrap" },
      puzzle.prompt ? h("p", { class: "prompt", bind: `${path}.prompt`, text: puzzle.prompt }) : null,
      instance.node,
      puzzle.hint ? h("div", { class: "hint-box", bind: `${path}.hint`, text: `💡 ${puzzle.hint}` }) : null,
      feedback,
      h("div", { class: "row" },
        h("button", { class: "btn btn--ghost", type: "button", text: "Zurück", onclick: backToOverview }),
        h("button", { class: "btn btn--primary btn--big", type: "button", text: "Prüfen", onclick: onCheck }),
        isSolved ? h("span", { class: "progress", text: "bereits gelöst" }) : null,
      ),
    ),
    badge(),
  );
}

function screenFinal(screen, path) {
  const video = screen.video || { kind: "none" };
  const reveal = h("div", { class: "reveal", bind: `${path}.reveal`, text: screen.reveal || "" });

  return h("section", { class: "screen screen--center is-active" },
    h("h1", { bind: `${path}.headline`, text: screen.headline || "" }),
    h("p", { class: "sub", bind: `${path}.text`, text: screen.text || "" }),
    video.kind === "file" && video.name && P.mode === "edit"
      ? h("div", { class: "video-missing", style: { maxWidth: "620px" } },
          h("p", { text: `🎬 ${video.name}` }),
          h("p", { class: "opt-note", text: "Wird beim Export abgespielt, sobald die Datei daneben liegt." }))
      : video.kind === "file" && video.name
        ? h("video", { class: "party-video", src: video.name, controls: true, playsinline: true,
                       style: { maxWidth: "620px" } })
        : null,
    screen.reveal
      ? h("div", null,
          h("div", { class: "eyebrow", bind: `${path}.revealLabel`, text: screen.revealLabel || "Lösungswort" }),
          reveal)
      : null,
    P.mode === "play"
      ? h("button", { class: "btn btn--ghost", type: "button", text: "Von vorn beginnen", onclick: resetProgress })
      : null,
    badgeHero(),
  );
}

/* ---------------- Wasserzeichen ---------------- */

function brandingOff() {
  return P.license.ok && (P.license.features || []).includes("nobadge");
}

function badge() {
  if (brandingOff()) return null;
  return h("div", { class: "badge", text: "erstellt mit Party-Baukasten" });
}

function badgeHero() {
  if (brandingOff()) return null;
  return h("div", { class: "badge badge--hero", text: "erstellt mit Party-Baukasten" });
}

/* ---------------- Eltern-Konsole ---------------- */

function parentSheet() {
  const sheet = h("div", { class: "sheet", hidden: true });
  let entry = "";

  const dots = h("div", { class: "pin-dots" });
  const msg = h("div", { class: "pin-msg" });
  const paintDots = () => {
    dots.replaceChildren(...[0, 1, 2, 3].map((i) => h("i", { class: i < entry.length ? "on" : "" })));
  };

  const pinStep = h("div", null,
    h("div", { class: "eyebrow", text: "🔒 Gesperrt" }),
    h("h2", { class: "sheet-title", text: "PIN eingeben" }),
    dots, msg,
    h("div", { class: "pinpad" },
      ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "C"].map((label) =>
        h("button", { class: "btn key", type: "button", text: label, onclick: () => {
          if (label === "←") entry = entry.slice(0, -1);
          else if (label === "C") entry = "";
          else if (entry.length < 4) entry += label;
          paintDots();
          if (entry.length === 4) {
            if (entry === String(P.cfg.parent?.pin || "1337")) { entry = ""; msg.textContent = ""; paintDots(); showMenu(); }
            else { msg.textContent = "Falsche PIN"; entry = ""; setTimeout(paintDots, 250); }
          }
        } })),
    ),
    h("button", { class: "btn btn--ghost", type: "button", text: "Abbrechen", onclick: () => close() }),
  );

  const menuStep = h("div", { hidden: true });

  const buildMenu = () => {
    const jumpButtons = P.cfg.flow.map((screen, i) =>
      h("button", { class: "btn opt", type: "button",
        text: `${i + 1}. ${screenLabel(screen)}`,
        onclick: () => { close(); gotoFlow(i); } }));

    const solveButtons = P.cfg.puzzles.map((puzzle, i) =>
      h("button", { class: `btn opt ${P.solved.has(puzzle.id) ? "is-picked" : ""}`, type: "button",
        text: `${P.solved.has(puzzle.id) ? "✓" : "○"} ${puzzle.title}`,
        onclick: () => {
          if (P.solved.has(puzzle.id)) P.solved.delete(puzzle.id);
          else P.solved.add(puzzle.id);
          saveProgress();
          buildMenu();
        } }));

    clear(menuStep);
    menuStep.append(
      h("div", { class: "eyebrow", text: "Einstellungen" }),
      h("h2", { class: "sheet-title", text: "Für Erwachsene" }),
      h("button", { class: "btn opt", type: "button", text: "⛶ Vollbild umschalten", onclick: toggleFullscreen }),
      h("div", { class: "sheet-sep", text: "Direkt anspringen" }),
      ...jumpButtons,
      P.cfg.parent?.allowMarkSolved !== false ? h("div", { class: "sheet-sep", text: "Als gelöst markieren" }) : null,
      ...(P.cfg.parent?.allowMarkSolved !== false ? solveButtons : []),
      h("div", { class: "sheet-sep", text: "Spielstand" }),
      h("button", { class: "btn opt", type: "button", text: "↺ Spiel komplett zurücksetzen",
        onclick: () => { close(); resetProgress(); } }),
      h("button", { class: "btn btn--amber", type: "button", text: "Fertig", onclick: () => close() }),
    );
  };

  const showMenu = () => { pinStep.hidden = true; menuStep.hidden = false; buildMenu(); };
  const open = () => { entry = ""; paintDots(); msg.textContent = ""; pinStep.hidden = false; menuStep.hidden = true; sheet.hidden = false; };
  const close = () => { sheet.hidden = true; render(); };

  sheet.append(h("div", { class: "sheet-card" }, pinStep, menuStep));
  sheet.addEventListener("click", (event) => { if (event.target === sheet) close(); });
  paintDots();
  return { node: sheet, open };
}

function screenLabel(screen) {
  const labels = { start: "Start", video: "Video", overview: "Rätselübersicht", final: "Abschluss" };
  return screen.headline || labels[screen.type] || screen.type;
}

function toggleFullscreen() {
  const doc = document;
  if (!doc.fullscreenElement) doc.documentElement.requestFullscreen?.().catch(() => {});
  else doc.exitFullscreen?.().catch(() => {});
}

/* ---------------- Rendern ---------------- */

export function render() {
  if (!P.cfg || !P.stage) return;
  clear(P.stage);

  let node;
  if (P.view.kind === "puzzle") {
    const puzzle = P.cfg.puzzles[P.view.idx];
    node = puzzle ? screenPuzzle(puzzle, P.view.idx) : screenOverview(P.cfg.flow[overviewIndex()], `flow.${overviewIndex()}`);
  } else {
    const idx = Math.max(0, Math.min(P.cfg.flow.length - 1, P.view.idx));
    const screen = P.cfg.flow[idx];
    const path = `flow.${idx}`;
    if (!screen) node = h("section", { class: "screen screen--center is-active" }, h("h2", { text: "Kein Bildschirm im Ablauf." }));
    else if (screen.type === "start") node = screenStart(screen, path);
    else if (screen.type === "video") node = screenVideo(screen, path);
    else if (screen.type === "overview") node = screenOverview(screen, path);
    else if (screen.type === "final") node = screenFinal(screen, path);
    else node = h("section", { class: "screen screen--center is-active" }, h("h2", { text: `Unbekannter Bildschirm „${screen.type}"` }));
  }

  P.stage.appendChild(node);
  for (const hook of P.renderHooks) hook();
}

export function onRender(callback) {
  P.renderHooks.push(callback);
}

/* ---------------- Start ---------------- */

export async function mountPlayer(root, config, options = {}) {
  P.root = root;
  P.mode = options.mode === "edit" ? "edit" : "play";
  P.cfg = normalize(config);

  document.body.classList.toggle("mode-edit", P.mode === "edit");
  applyTheme(document.documentElement, P.cfg.theme, P.cfg.assets);
  document.title = P.cfg.meta?.title || "Rätsel-Party";

  P.stage = h("div", { class: "stage" });
  const parent = parentSheet();
  const topbar = h("div", { class: "topbar" },
    h("div", { class: "spacer" }),
    h("button", { class: "icon-btn", type: "button", title: "Einstellungen",
      text: "⚙", onclick: () => parent.open() }),
  );

  clear(root);
  root.append(P.stage, topbar, parent.node);

  loadProgress();
  render();

  /* Lizenz wird nachtraeglich geprueft: bis das Ergebnis da ist,
     bleibt das Wasserzeichen stehen. Fehlschlag heisst Badge. */
  await refreshLicense();

  return P;
}

/* Fuer den Editor: neues Dokument einspielen, Ansicht behalten. */
export function setConfig(config, { rerender = true } = {}) {
  if (!config) return;
  const previousToken = P.cfg?.branding?.license ?? null;
  P.cfg = normalize(config);
  applyTheme(document.documentElement, P.cfg.theme, P.cfg.assets);
  document.title = P.cfg.meta?.title || "Rätsel-Party";
  if (rerender) render();

  /* Wird im Editor freigeschaltet, aendert sich nur das Dokument.
     Ohne erneute Pruefung bliebe das Wasserzeichen in der Vorschau
     stehen, obwohl der Export schon sauber waere. */
  const token = P.cfg.branding?.license ?? null;
  if (token !== previousToken) refreshLicense();
}

async function refreshLicense() {
  const token = P.cfg.branding?.license ?? null;
  P.license = await verifyLicense(token, { partyId: P.cfg.id });
  if (P.cfg.branding?.license === token) render();   // zwischenzeitlich schon wieder geaendert?
}

export function setMode(mode) {
  P.mode = mode === "edit" ? "edit" : "play";
  document.body.classList.toggle("mode-edit", P.mode === "edit");
  render();
}
