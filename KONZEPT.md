# Party-Baukasten — Konzept

Ein Werkzeug, mit dem Eltern eine Rätsel-Party wie den bestehenden
Forschergeburtstag **direkt im Browser zusammenklicken**: Ablauf, Rätsel,
Texte und Design. Das Ergebnis ist eine einzelne HTML-Datei, die offline auf
einem Tablet läuft. Für 2 € entfällt das Wasserzeichen.

Stand dieses Ordners: **Stufe 0 und Stufe 1 sind gebaut und laufen** (siehe
Abschnitt 9). Der Rest dieses Dokuments beschreibt das Gesamtbild, damit
Stufe 2 und 3 nicht gegen die falschen Annahmen entwickelt werden.

---

## 1. Ausgangslage

Die bestehende `index.html` des Forschergeburtstags (1399 Zeilen) war bereits
fast die richtige Architektur:

| Vorhanden | Rolle im Baukasten |
|---|---|
| `CONFIG`-Objekt oben im Script | war schon das Datenmodell — wurde zu `party.json` |
| 5 Rätseltypen per `switch` | wurden zur Registry aus austauschbaren Modulen |
| `:root` mit CSS-Custom-Properties | war schon ein Design-Token-System — wurde zu den Themes |
| Screens als `<section>` + `show(id)` | Ablauf war fest verdrahtet — wurde zur Liste `flow[]` |
| PIN-Konsole, `localStorage`, PWA | unverändert übernommen, PIN jetzt konfigurierbar |

Die Arbeit bestand nicht darin, etwas Neues zu erfinden, sondern drei
Verdrahtungen aufzulösen: **Ablauf**, **Rätseltypen** und **Design** mussten
von Code zu Daten werden.

---

## 2. Gesamtarchitektur

```
app-designer/
├── src/shared/     Datenmodell, Themes, Lizenz, ZIP — kennt weder Editor noch Player
├── src/puzzles/    ein Modul je Rätseltyp (Registry)
├── src/player/     die Spiel-Engine; kennt einen Bearbeitungsmodus
├── src/editor/     der Baukasten; lädt den Player im iframe
├── dist/           die gebaute Player-Vorlage für den Export
├── tools/          Bündler, Entwicklungsserver, Schlüsselwerkzeuge
├── license-fn/     der einzige Serverteil: Stripe-Webhook (Cloudflare Worker)
└── examples/       die Forscher-Mission, vollständig als Daten
```

**Der zentrale Trick: Player und Editor rendern nicht zweimal.** Der Editor
besitzt keine eigene Darstellung der Party. Er lädt den *echten* Player in
einen `<iframe>` und schaltet ihn in den Bearbeitungsmodus. Was man im Editor
sieht, ist das, was exportiert wird. Das schließt die häufigste Fehlerklasse
solcher Werkzeuge aus — „im Editor sah es anders aus".

### Warum kein Framework

Das ursprüngliche Konzept sah Svelte + Vite vor. Gebaut ist es **ohne jede
Abhängigkeit** in ES-Modulen. Gründe:

- Der Ordner soll ohne `npm install` laufen und sich als Ganzes verschieben
  lassen. Es gibt keine Lockfile-Alterung und keine Angriffsfläche über
  fremde Pakete.
- Der Player muss winzig und offline-fähig sein. Er wiegt gebaut **81 kB**
  (unkomprimiert, inklusive Stylesheet) — unter dem, was allein React+ReactDOM
  kosten würde.
- Die Bedienoberfläche des Editors ist zwar größer, hat aber wenig
  gemeinsamen Zustand: drei Spalten, die auf ein einziges Dokument schauen.
  Das trägt ein Store mit Abonnenten problemlos.

**Wann ein Framework sinnvoll wird:** sobald Stufe 3 kommt (Konten, gehostete
Party-Adressen, serverseitiges Rendern der Landingpage). Dann gehört
SvelteKit oder Next.js um den Editor herum — der Player und `src/shared/`
bleiben davon unberührt, weil sie kein DOM-Framework kennen.

---

## 3. Das Datenmodell (`party.json`)

Alles, was eine Party ausmacht, ist ein JSON-Dokument. Der Editor bearbeitet
es, der Player führt es aus, der Export bettet es ein.

```jsonc
{
  "schemaVersion": 1,
  "id": "p_7f3a…",                    // stabil, auch für die Lizenzbindung
  "meta":  { "title": "Lauras Forschergeburtstag", "language": "de" },
  "theme": { "preset": "labor", "tokens": { "primary": "#8b6cff" },
             "fontScale": 1, "iconSeed": "🔬" },
  "flow":  [ { "id": "s1", "type": "start",    "headline": "…", "cta": "…" },
             { "id": "s2", "type": "video",    "source": { "kind": "file", "name": "video1.mp4" } },
             { "id": "s3", "type": "overview", "mode": "free" },
             { "id": "s4", "type": "final",    "reveal": "Hefe" } ],
  "puzzles": [ { "id": "q1", "nr": 1, "type": "choice", "title": "…",
                 "options": [ … ], "answer": "Ameisensäure" } ],
  "assets":  { "img_a1b2": { "mime": "image/webp", "w": 512, "h": 512, "data": "data:…" } },
  "parent":  { "pin": "1337", "allowMarkSolved": true },
  "branding": { "license": null }
}
```

Vier Entwurfsentscheidungen, die sich später gerächt hätten:

1. **`flow` ist eine Liste.** Im Original war Start→Video→Übersicht→Abschluss
   fest im Code. Als Liste kann man ein Video weglassen, zwei Zwischenvideos
   einbauen oder mit der Rätselübersicht beginnen.
2. **`assets` ist ein eigener Namensraum mit IDs**, keine Dateinamen im
   Rätsel. Ein Bild in drei Rätseln wird einmal gespeichert, Umbenennen
   bricht nichts.
3. **`schemaVersion` von Anfang an**, mit Migrationskette in `schema.js`.
   Sobald die erste `.party.json` in fremden Händen ist, ist das Schema ein
   Vertrag. `migrate()` weist neuere Versionen mit klarer Meldung ab, statt
   Daten zu verstümmeln.
4. **Antworten stehen im Klartext.** Kein Hashing. Es ist ein Kindergeburtstag,
   kein Prüfungssystem — und die Eltern-Konsole soll die Lösungen zeigen können.

`normalize()` ist bewusst tolerant: eine handgeschriebene, lückenhafte Datei
läuft trotzdem. Streng ist dagegen `validateParty()` vor dem Export.

---

## 4. Die Player-Engine

### 4.1 Rätseltypen als Registry

Jeder Typ ist ein Modul mit einem Manifest:

```js
export default {
  id: "number", label: "Zahlen-Code", icon: "🔢", summary: "…",
  fields:   [ { key: "answer", type: "text", label: "Richtige Zahl" }, … ],
  defaults: () => ({ answer: "123", maxLength: 3 }),
  validate: (p) => p.answer ? [] : [{ field: "answer", msg: "Antwort fehlt" }],
  check:    (p, answer) => String(answer).trim() === String(p.answer).trim(),
  render:   (ctx) => ({ node, getAnswer }),
};
```

**Ein neuer Rätseltyp ist eine Datei plus eine Zeile in `puzzles/index.js`.**
Eingabemaske im Inspektor, Prüfung vor dem Export und Export ergeben sich
daraus von selbst — `fields` beschreibt die Maske, der Inspektor baut sie.

`check` und `validate` sind reine Funktionen ohne DOM. Deshalb sind sie in
`npm test` vollständig geprüft, ohne Browser.

### 4.2 Gebaute Typen

| Typ | Beschreibung | Herkunft |
|---|---|---|
| `choice` | Auswahl aus mehreren Antworten | aus dem Original |
| `number` | Zahlencode über großes Tastenfeld (keine Systemtastatur) | aus dem Original |
| `text` | Wort über die Tastatur, optional ohne Groß-/Kleinschreibung | aus dem Original |
| `assign` | Bild → Zahl zuordnen | aus dem Original (Stromkreis) |
| `sort2` | Zwei Fächer, Ziehen **oder** Antippen | aus dem Original (schwimmt/sinkt) |
| `truefalse` | Mehrere Aussagen, je richtig/falsch | neu |
| `order` | Reihenfolge herstellen, mit Pfeiltasten | neu |

Noch offen, in dieser Reihenfolge sinnvoll: `dial` (Zahlenschloss mit
Drehrädern — haptisch, Kinder lieben es), `hotspot` (Stelle im Bild antippen),
`memory`, `qr` (Kamera; braucht HTTPS und ist auf iOS heikel), `audio`,
`photo` (Erwachsener bestätigt).

### 4.3 Der Bearbeitungsmodus

Jedes Element, das aus Daten kommt, trägt seinen Datenpfad im Markup:

```html
<h1 data-bind="flow.0.headline">Forscher-Mission</h1>
<div data-bind="puzzles.3">…</div>
```

Mit `?mode=edit` schaltet der Player um:

- **Klick wählt aus, statt zu spielen.** Ein Listener in der Capture-Phase
  fängt jeden Klick ab und ermittelt das nächstgelegene `[data-bind]`.
  Die Rätseltypen müssen davon nichts wissen.
- **Texte werden `contenteditable`,** sobald der gebundene Wert eine
  Zeichenkette ist. Erster Klick wählt den ganzen Text (schnelles Ersetzen),
  ein zweiter setzt den Cursor.
- **Der Auswahlrahmen ist eine eigene Ebene** über dem Inhalt, kein Rahmen am
  Element — sonst verschöbe die Auswahl das Layout.
- **Doppelklick auf eine Rätselkarte** öffnet das Rätsel in der Vorschau.
- **„Testen"** schaltet in den echten Spielmodus, mit wegwerfbarem Spielstand.

Das Protokoll zwischen Editor und Player ist absichtlich schmal:

```
Editor → Player:  state | goto | select | mode | rerender
Player → Editor:  ready | patch | click | view | error
```

Der Editor schickt **ganze Zustände**, der Player nur Absichten. Deltas in
beide Richtungen wären sparsamer, aber auseinanderlaufende Zustände sind die
häufigste Fehlerklasse solcher Werkzeuge. Bei einem Dokument von einigen
hundert Kilobyte kostet das nichts.

Zwei Feinheiten, die erst im Browser auffielen und jetzt gelöst sind:

- **Cursor-Sprung:** Der Player schickt zu jeder Inline-Eingabe eine
  `editId` mit; der Editor spiegelt sie als `echo` zurück. Bei passendem Echo
  übernimmt der Player den Zustand, zeichnet aber **nicht** neu — sonst
  springt der Cursor bei jedem Tastendruck an den Anfang.
- **Echo der Auswahl:** Der Editor spiegelt jede Auswahl zurück, auch die
  gerade im Player entstandene. Ohne Bremse beendete dieses Echo die eben
  begonnene Inline-Bearbeitung und der erste Tastendruck ging verloren.

---

## 5. Design-Anpassung

Weil das Original schon Tokens hatte, ist das der billigste große Effekt im
ganzen Projekt.

- **Fünf Vorlagen:** Labor (das Original), Detektiv, Piraten, Weltraum,
  Einhorn. Eine Vorlage ist ein Satz von 16 Werten, nicht mehr.
- **Farbwähler** auf sieben Tokens, der Rest wird abgeleitet.
- **Kontrast-Wächter:** nach jeder Farbänderung wird gegen WCAG AA (4,5:1)
  geprüft, mit Knopf „automatisch korrigieren". Ohne das bauen Nutzer
  zuverlässig hellgelbe Schrift auf Weiß — und man bekommt Support-Post.
- **Schriftgrößen-Skala** statt Einzelgrößen: ein 8-Zoll-Tablet und ein
  13-Zoll-iPad brauchen unterschiedliche Skalen, nicht unterschiedliche Layouts.
- **Keine Schriften aus dem Netz.** Das erhält die Offline-Fähigkeit und
  spart die DSGVO-Diskussion über Google Fonts.

---

## 6. Medien

**Bilder** werden im Browser verkleinert (max. 1000 px), als WebP mit
Qualität 0,82 kodiert (JPEG-Rückfall für ältere Safari-Versionen) und als
Data-URL eingebettet. Nebeneffekt, der hier Absicht ist: das Neukodieren über
ein Canvas wirft **sämtliche EXIF-Daten** weg — Handyfotos tragen sonst
GPS-Koordinaten in die exportierte Datei.

Der Editor zeigt permanent die geschätzte Exportgröße. Ab 8 MB warnt die
Prüfung, ab 15 MB blockiert sie: ein Tablet lädt eine 40-MB-Datei nicht mehr
vernünftig.

**Videos** werden nie eingebettet. Drei Wege:

| Weg | Wie | Für wen |
|---|---|---|
| daneben legen (Standard) | Config nennt `video1.mp4`; das ZIP enthält `LIESMICH-videos.txt` | Offline-Betrieb |
| verlinken | URL; YouTube/Vimeo werden als `youtube-nocookie` eingebettet | mit WLAN |
| hochladen | Stufe 3, Cloudflare R2 | später |

Fehlt die Datei, zeigt der Player einen Hinweis und der Ablauf läuft weiter —
genau wie im Original. Im **Bearbeitungsmodus** wird gar nicht erst geladen,
sondern ein Platzhalter gezeigt: im Editor liegt die Datei praktisch nie
daneben, und ein 404 bei jedem Neuzeichnen ist kein guter Umgang.

**Speicherung im Editor:** IndexedDB, nicht `localStorage` (5-MB-Grenze).
Autosave 800 ms nach der letzten Eingabe.

> **Der wichtigste Satz der ganzen Datei:** Browser-Speicher ist flüchtig.
> iOS räumt IndexedDB nach sieben Tagen ohne Besuch ab, „Browserdaten
> löschen" nimmt alles mit. Deshalb fordert der Editor `storage.persist()`
> an, warnt beim Schließen mit ungesicherten Änderungen und drängt auf die
> `.party.json`-Sicherung. Diese Datei ist das eigentliche Eigentum des
> Nutzers.

---

## 7. Export

Der Player wird **nicht** im Browser übersetzt. `tools/build-player.mjs`
erzeugt einmal `dist/player.template.html` mit einem Platzhalter; der Export
setzt nur das Dokument ein und dauert Millisekunden.

Drei Varianten:

1. **Eine einzige HTML-Datei** (~237 kB bei der Beispiel-Party) — per AirDrop
   oder Mail aufs Tablet, doppelklicken, läuft. Für die meisten der richtige Weg.
2. **ZIP-Paket** — `index.html`, `manifest.webmanifest`, `sw.js`, aus dem
   Theme erzeugte Symbole, `LIESMICH-videos.txt`, `loesungsblatt.txt`.
   Für Webspace und PWA-Installation. Der ZIP-Schreiber ist selbst gebaut
   (Methode „store", ~90 Zeilen), weil der Inhalt ohnehin aus bereits
   komprimierten Bildern besteht — Deflate brächte fast nichts und kostete
   eine Fremdbibliothek.
3. **`.party.json`** zur Sicherung und zum Weiterarbeiten woanders.

Vor jedem Export läuft `validateParty()`: fehlende Antworten, leere Rätsel,
unerreichbare Bildschirme, fehlende Bilder, untaugliche PIN, Größenbudget.
Befunde sind anklickbar und springen zur Stelle.

Zwei Kleinigkeiten mit großer Wirkung, beide gelöst:

- Beim Einbetten des JSON wird `<` zu `<` und U+2028/2029 werden
  maskiert. Sonst zerreißt ein `</script>` im Rätseltext das Dokument.
- Der Bündler ersetzt mit **Funktionen** statt Zeichenketten. Im Quelltext
  steht unter anderem `$&`, was `String.replace` sonst als Rückverweis
  deutet und den gerade ersetzten Tag wieder einsetzt.

---

## 8. Wasserzeichen und Bezahlung

### 8.1 Gestaltung

Das Wasserzeichen ist auf **jedem Bildschirm** sichtbar, unten rechts,
11 px, 55 % Deckkraft und `pointer-events: none` — ein Kind soll es nicht
antippen und wegnavigieren können. Auf Start- und Abschlussbildschirm steht
es zusätzlich größer mittig: das sind die Momente, in denen Erwachsene auf
den Bildschirm schauen und fragen „womit habt ihr das gemacht?". Dort sitzt
das Marketing, nicht während Rätsel 4.

### 8.2 Was die 2 € umfassen

Nur „Badge weg" ist ein schwaches Angebot. Gebündelt sind:

- Wasserzeichen entfernt
- beliebig viele Rätsel (gratis: 4)
- eigener Titel und eigenes App-Symbol
- Begleitmaterial (Lösungsblatt; als PDF in Stufe 2)

Damit kaufen Leute etwas, statt etwas abzukaufen — und der Anreiz sinkt, das
Wasserzeichen von Hand aus der HTML zu löschen.

### 8.3 Technik

Gewählt und gebaut: **signiertes Token, Prüfung vollständig im Browser.**

1. Stripe-Zahlungslink, 2 €; die Party-Kennung fährt als
   `client_reference_id` mit.
2. Ein **Cloudflare Worker** (`license-fn/worker.js`, ~150 Zeilen, kostenloses
   Kontingent) prüft die Stripe-Signatur und stellt ein Ed25519-signiertes
   Token aus:
   `PARTY-1.<base64url(payload)>.<base64url(signatur)>`
3. Editor **und** Player prüfen es offline mit `crypto.subtle.verify`
   gegen den eingebauten öffentlichen Schlüssel. Kein Netz, kein Konto,
   keine Datenbank.

Eigenschaften: fälschungssicher (der private Schlüssel liegt nur im Worker),
funktioniert offline, DSGVO-arm (außer bei Stripe wird nichts gespeichert),
und der Worker ist nach der Einrichtung wartungsfrei.

Geprüft wird: Signatur, Bindung an die Party (`pid`, `*` gilt für alle) und
Ablauf (`exp`). Die Tests in `tests/license.test.mjs` weisen nach, dass
verfälschte Signaturen, ausgetauschte Nutzdaten, fremde Partys und Unfug
abgelehnt werden.

**Ehrliche Einordnung, damit nichts überbaut wird:** Ein exportiertes HTML
liegt beim Kunden auf der Platte. Wer einen Texteditor bedienen kann,
entfernt das Wasserzeichen in zwei Minuten. Das ist bei *jedem*
clientseitigen Export so und technisch nicht verhinderbar. Man kann es
unbequem machen, nicht unmöglich. Bei 2 € ist das ökonomisch unerheblich:
der Umgehungsaufwand übersteigt den Preis. Die Zeit gehört in Abschnitt 8.2.

### 8.4 Rechtliches und Kalkulation (Deutschland)

- **Stripe-Gebühren:** ~0,25 € + 1,5 % je europäischer Kartenzahlung. Von
  2 € bleiben ~1,72 €, also **~14 % Gebührenanteil**. Ein Bündel
  („3 Partys für 5 €") verdünnt den Fixanteil deutlich.
- **Umsatzsteuer:** Kleinunternehmerregelung (§ 19 UStG) prüfen. Darüber
  greift bei digitalen Leistungen an EU-Privatkunden das OSS-Verfahren;
  Stripe Tax nimmt das ab, kostet aber extra.
- **Widerrufsrecht:** Bei digitalen Inhalten erlischt es nur mit
  ausdrücklicher Zustimmung vor dem Download. Also eine Pflicht-Checkbox
  im Kaufdialog — **noch nicht gebaut**, siehe Stufe 2.
- **Pflichtseiten:** Impressum, Datenschutzerklärung (Stripe als Empfänger
  nennen), AGB.
- **DSGVO im Editor:** keine Tracker, keine Analytics. Da alles lokal läuft,
  reicht eine schlanke Erklärung — und das ist ein echtes Verkaufsargument
  gegenüber Cloud-Konkurrenten: *eure Kinderfotos verlassen euren Rechner nicht.*

---

## 9. Stand und nächste Schritte

### Gebaut und im Browser nachgewiesen (`npm run test:browser`)

- **Stufe 0 — Fundament.** Player-Engine aus der alten `index.html`
  herausgelöst, Schema v1, Rätsel-Registry, die Forscher-Mission vollständig
  als `examples/forschergeburtstag.party.json`. Sie ist gleichzeitig der
  Regressionsfall: läuft sie, trägt das Datenmodell.
- **Stufe 1 — Editor.** iframe-Brücke, Bearbeitungsmodus, Inline-Texte,
  Inspektor aus Manifesten, Ablaufspalte mit Anlegen/Löschen/Umsortieren,
  Designspalte mit Kontrastprüfung, Bild-Import, IndexedDB mit Autosave,
  Import/Export `.party.json`, Ein-Datei- und ZIP-Export, Prüfliste,
  Rückgängig/Wiederherstellen.
- **Vorgezogen aus Stufe 2.** Lizenzprüfung inklusive Worker und
  Schlüsselwerkzeugen, zwei neue Rätseltypen, fünf Themes, Lösungsblatt.

### Stufe 2 — offen

- Stripe-Konto, echter Zahlungslink, Worker ausrollen, eigene Schlüssel
  (`npm run keygen`) — der mitgelieferte ist ein **Demo**-Schlüssel.
- Widerrufs-Checkbox und die Pflichtseiten.
- Begleitmaterial als PDF (Urkunde mit Namen, QR-Code) via `pdf-lib`.
- Rätseltyp `dial`, danach `hotspot`.
- Rückholung des Schlüssels über `/recover`, falls die Bestätigungsmail
  nicht abgewartet wird (Worker kann es bereits, Editor noch nicht).

### Stufe 3 — offen

Konten, gehostete Party-Adressen mit QR-Code, Video-Upload nach R2. Erst
bauen, wenn Stufe 1/2 zeigen, dass das Werkzeug benutzt wird — das ist die
Stufe mit laufenden Kosten und DSGVO-Pflichten.

### Vor Stufe 2 unbedingt

Einen **Praxistest**: zwei Elternteile ohne Anleitung eine Party bauen lassen
und dabei zusehen, nicht helfen. Bei Baukästen liegen die Stolperstellen fast
nie dort, wo der Entwickler sie vermutet.

---

## 10. Bekannte Fallstricke

**Tablet und iOS**

- `sort2` läuft über **Pointer-Events**, nicht über HTML5-Drag-and-Drop —
  letzteres funktioniert auf iOS Safari gar nicht. Zusätzlich gibt es
  Antippen-und-Ablegen als zweiten Weg.
- Video-Autoplay nur `muted` + `playsinline`; mit Ton erst nach einer
  Nutzergeste. Der Startknopf davor löst das.
- Die Vollbild-API fehlt auf iPhone-Safari; PWA-Installation nur über „Zum
  Home-Bildschirm".
- Tap-Ziele sind auf mindestens 56 px festgelegt, Doppeltipp-Zoom und
  Gummiband-Scrollen sind abgeschaltet.
- **Ed25519 in WebCrypto** gibt es erst ab Chrome 137, Safari 17 und
  Firefox 129. Ältere Browser bekommen „Signatur nicht prüfbar" und damit das
  Wasserzeichen — fail-closed, aber für die Betroffenen ärgerlich. Falls das
  in der Praxis auffällt: Prüfung über eine kleine WASM-Bibliothek nachrüsten.

**Editor**

- `contenteditable` bringt beim Einfügen aus Word HTML mit; das `paste`-
  Ereignis wird abgefangen und nur `text/plain` übernommen.
- Der Auswahlrahmen wird nach jedem Rendern per `requestAnimationFrame` neu
  vermessen.
- Base64-Bilder im Nachrichtenstrom machen das Tippen zäh, sobald eine Party
  viele große Bilder hat. Noch nicht gemessen; falls es auffällt, Assets
  getrennt übertragen und im iframe als `blob:`-URL zwischenspeichern.

**Inhaltlich**

- Kinder-Ergonomie ist eine harte Anforderung, keine Empfehlung: große
  Ziele, kein Zeitdruck ohne Absicht, Falscheingaben nie bestrafend.
- Emoji sehen auf Android, iOS und Windows verschieden aus. Für den Editor
  egal, für „so sieht es beim Kind aus" nicht.
- Schema-Migration: Migrationstests mit eingefrorenen Beispieldateien je
  Version anlegen, sobald es Schema 2 gibt.
