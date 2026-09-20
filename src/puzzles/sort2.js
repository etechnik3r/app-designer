import { h } from "../player/dom.js";

/* Gegenstaende in zwei Faecher einsortieren ("schwimmt / sinkt").
   Bedienung doppelt ausgelegt: ziehen ODER antippen-und-ablegen.
   Ziehen mit Pointer-Events statt HTML5-Drag-and-Drop, weil
   letzteres auf iOS gar nicht funktioniert.                        */
export default {
  id: "sort2",
  label: "Einsortieren",
  icon: "🗂️",
  summary: "Gegenstände werden in zwei Fächer einsortiert.",

  fields: [
    { key: "zones", type: "list", label: "Die beiden Fächer", fixedLength: 2 },
    { key: "objects", type: "objectlist", label: "Gegenstände",
      itemLabel: (it) => `${it.emoji || "•"} ${it.label || ""}`.trim(),
      itemFields: [
        { key: "label", type: "text", label: "Name" },
        { key: "emoji", type: "emoji", label: "Symbol" },
        { key: "zone", type: "zonepick", label: "Gehört in Fach", from: "zones" },
      ],
      newItem: () => ({ label: "Neuer Gegenstand", emoji: "🔹", zone: 0 }) },
  ],

  defaults: () => ({
    zones: ["Schwimmt", "Sinkt"],
    objects: [
      { label: "Holz", emoji: "🪵", zone: 0 },
      { label: "Stein", emoji: "🪨", zone: 1 },
      { label: "Korken", emoji: "🍾", zone: 0 },
      { label: "Münze", emoji: "🪙", zone: 1 },
    ],
  }),

  validate(p) {
    const issues = [];
    const zones = p.zones || [];
    if (zones.length !== 2 || zones.some((z) => !String(z).trim())) {
      issues.push({ field: "zones", msg: "Es müssen genau zwei benannte Fächer sein." });
    }
    const objects = p.objects || [];
    if (objects.length < 2) issues.push({ field: "objects", msg: "Mindestens zwei Gegenstände nötig." });
    objects.forEach((o, i) => {
      if (!String(o.label ?? "").trim()) {
        issues.push({ field: `objects.${i}.label`, msg: `Gegenstand ${i + 1} hat keinen Namen.` });
      }
      if (o.zone !== 0 && o.zone !== 1) {
        issues.push({ field: `objects.${i}.zone`, msg: `Gegenstand ${i + 1} ist keinem Fach zugeordnet.` });
      }
    });
    return issues;
  },

  check(p, answer) {
    const objects = p.objects || [];
    if (!Array.isArray(answer) || answer.length !== objects.length) return false;
    return objects.every((o, i) => answer[i] === o.zone);
  },

  render(ctx) {
    const { puzzle, path } = ctx;
    const objects = puzzle.objects || [];
    const zones = puzzle.zones || ["A", "B"];
    const placement = new Array(objects.length).fill(null); // null = noch im Vorrat
    let selected = null;

    const pool = h("div", { class: "sort-pool", dataset: { zone: "pool" } });
    const zoneEls = zones.slice(0, 2).map((label, z) =>
      h("div", { class: "sort-zone", dataset: { zone: String(z) } },
        h("div", { class: "sort-zone-title", bind: `${path}.zones.${z}`, text: label }),
        h("div", { class: "sort-zone-body", dataset: { zone: String(z) } }),
      ),
    );

    const chips = objects.map((obj, i) =>
      h("button", {
        class: "chip", type: "button", dataset: { idx: String(i) },
        bind: `${path}.objects.${i}`,
      },
        h("span", { class: "chip-emoji", text: obj.emoji || "🔹" }),
        h("span", { class: "chip-label", text: obj.label || "" }),
      ),
    );

    const place = (idx, zone) => {
      placement[idx] = zone;
      const target = zone === null ? pool : zoneEls[zone].querySelector(".sort-zone-body");
      target.appendChild(chips[idx]);
      select(null);
    };

    const select = (idx) => {
      selected = idx;
      chips.forEach((c, i) => c.classList.toggle("is-selected", i === idx));
    };

    /* --- Antippen: erst Gegenstand, dann Fach --- */
    chips.forEach((chip, i) => {
      chip.addEventListener("click", (event) => {
        if (chip.dataset.dragged === "1") { delete chip.dataset.dragged; return; }
        event.stopPropagation();
        select(selected === i ? null : i);
      });
    });

    const dropTargets = [pool, ...zoneEls];
    dropTargets.forEach((el) => {
      el.addEventListener("click", () => {
        if (selected === null) return;
        place(selected, el === pool ? null : Number(el.dataset.zone));
      });
    });

    /* --- Ziehen: Geisterbild folgt dem Finger --- */
    let drag = null;
    const onDown = (event, idx) => {
      if (event.button !== undefined && event.button !== 0) return;
      drag = { idx, startX: event.clientX, startY: event.clientY, ghost: null };
      chips[idx].setPointerCapture?.(event.pointerId);
    };
    const onMove = (event) => {
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.ghost && Math.hypot(dx, dy) < 8) return;
      if (!drag.ghost) {
        const chip = chips[drag.idx];
        const rect = chip.getBoundingClientRect();
        drag.ghost = chip.cloneNode(true);
        drag.ghost.className = "chip chip--ghost";
        drag.ghost.style.width = `${rect.width}px`;
        drag.offX = drag.startX - rect.left;
        drag.offY = drag.startY - rect.top;
        document.body.appendChild(drag.ghost);
        chip.classList.add("is-dragging");
      }
      drag.ghost.style.left = `${event.clientX - drag.offX}px`;
      drag.ghost.style.top = `${event.clientY - drag.offY}px`;
      const over = dropTargetAt(event.clientX, event.clientY);
      dropTargets.forEach((el) => el.classList.toggle("is-over", el === over));
    };
    const onUp = (event) => {
      if (!drag) return;
      const chip = chips[drag.idx];
      if (drag.ghost) {
        drag.ghost.remove();
        chip.classList.remove("is-dragging");
        chip.dataset.dragged = "1";
        const over = dropTargetAt(event.clientX, event.clientY);
        if (over) place(drag.idx, over === pool ? null : Number(over.dataset.zone));
      }
      dropTargets.forEach((el) => el.classList.remove("is-over"));
      drag = null;
    };
    const dropTargetAt = (x, y) => {
      const el = document.elementFromPoint(x, y);
      if (!el) return null;
      const zone = el.closest("[data-zone]");
      if (!zone) return null;
      return zone.dataset.zone === "pool" ? pool : zoneEls[Number(zone.dataset.zone)] || null;
    };

    chips.forEach((chip, i) => {
      chip.addEventListener("pointerdown", (e) => onDown(e, i));
      chip.addEventListener("pointermove", onMove);
      chip.addEventListener("pointerup", onUp);
      chip.addEventListener("pointercancel", onUp);
    });

    chips.forEach((chip) => pool.appendChild(chip));

    const node = h("div", { class: "p-sort2" },
      h("div", { class: "sort-hint", text: "Ziehen — oder antippen und dann das Fach antippen." },),
      pool,
      h("div", { class: "sort-zones" }, zoneEls),
    );

    return { node, getAnswer: () => placement.slice() };
  },
};
