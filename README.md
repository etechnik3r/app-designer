# Party-Baukasten

Rätsel-Geburtstage im Browser zusammenklicken: Ablauf, Rätsel, Texte und
Design. Heraus kommt eine einzelne HTML-Datei, die offline auf einem Tablet
läuft.

Das ausführliche Konzept — Datenmodell, Architektur, Bezahlmodell,
Kalkulation, Fallstricke — steht in **[KONZEPT.md](KONZEPT.md)**.

---

## Loslegen

Es gibt **keine Abhängigkeiten**. Node 20+ genügt, und selbst das nur für den
Entwicklungsserver.

```bash
npm start            # startet http://localhost:8080 und baut die Player-Vorlage
```

Alternativ mit irgendeinem statischen Server:

```bash
python3 -m http.server 8080
```

> Per Doppelklick auf `index.html` funktioniert es **nicht**: Browser
> blockieren ES-Module und IndexedDB unter `file://`. Der Export dagegen
> läuft ausdrücklich per Doppelklick — darum geht es ja.

Beim ersten Start legt der Editor die Beispiel-Party an: die echte
Forscher-Mission mit sechs Rätseln.

---

## Bedienung in drei Sätzen

1. **Links** ist der Ablauf: Bildschirme und Rätsel anlegen, löschen, sortieren.
2. **In der Mitte** ist die Party selbst — auf einen Text tippen und ihn direkt
   überschreiben. Der erste Klick wählt den ganzen Text, der zweite setzt den
   Cursor.
3. **Rechts** steht, was man nicht sieht: richtige Antworten, Bilder, PIN —
   und unter *Design* die Farben.

Oben schaltet **Testen** in den echten Spielmodus, **Prüfen** sucht Fehler und
**Export** erzeugt die fertige Datei.

---

## Befehle

| Befehl | Wirkung |
|---|---|
| `npm start` | Entwicklungsserver; baut die Player-Vorlage bei Bedarf neu |
| `npm run build` | baut nur `dist/player.template.html` |
| `npm test` | 44 Tests zu Datenmodell, Rätseln, Historie, ZIP und Lizenz |
| `npm run test:browser` | Durchstich im echten Browser (braucht Playwright) |
| `npm run keygen` | neues Ed25519-Schlüsselpaar für die Lizenzen |
| `npm run sign -- '*'` | stellt von Hand einen Lizenzschlüssel aus (zum Ausprobieren) |

Der Browsertest ist bewusst keine Abhängigkeit des Projekts:

```bash
npm i -D playwright && npx playwright install chromium
npm start &
npm run test:browser
```

---

## Wo was liegt

```
index.html              der Editor
src/shared/             Datenmodell, Themes, Lizenz, ZIP — ohne DOM, voll getestet
src/puzzles/            ein Modul je Rätseltyp; eine Datei = ein neuer Typ
src/player/             die Spiel-Engine samt Bearbeitungsmodus
src/editor/             Oberfläche: Store, iframe-Brücke, Inspektor, Export
dist/player.template.html  gebauter Player mit Platzhalter (liegt bewusst mit im Repo)
tools/                  Bündler, Server, Schlüsselwerkzeuge
license-fn/             Cloudflare Worker für den Stripe-Webhook
examples/               die Forscher-Mission als Daten
tests/                  Unit-Tests und der Browser-Durchstich
```

---

## Einen Rätseltyp hinzufügen

1. `src/puzzles/meintyp.js` anlegen, Vorlage ist `src/puzzles/number.js`.
2. In `src/puzzles/index.js` importieren und in `PUZZLES` eintragen.
3. `npm run build`, fertig — Eingabemaske, Prüfung und Export ergeben sich
   aus dem `fields`-Manifest von selbst.

---

## Vor dem ersten Verkauf

Der mitgelieferte Lizenzschlüssel ist ein **Demo**-Schlüssel; sein privater
Teil steht offen in `license-fn/DEMO-SCHLUESSEL.txt`. Damit kann jeder
beliebige Lizenzen ausstellen.

```bash
npm run keygen          # öffentlichen Teil in src/shared/license.js eintragen,
                        # privaten Teil nur als Worker-Secret
```

Danach: `PAY_URL` in `src/editor/main.js` auf den echten Stripe-Zahlungslink
setzen, Worker ausrollen (`license-fn/README.md`) und
`license-fn/DEMO-SCHLUESSEL.txt` löschen. Was rechtlich noch fehlt
(Widerrufs-Checkbox, Impressum, AGB), steht in KONZEPT.md, Abschnitt 8.4.
