# Changelog

Alle spürbaren Änderungen am Party-Baukasten, neueste zuerst.
Die gleiche Liste erscheint im Editor selbst (Werkzeugleiste → Versionsnummer anklicken).

## 0.3.0 – 2026-09-20

- **Tipp-Fehler behoben:** Bei schnellem Tippen konnten sich zwei Bestätigungen aus dem
  Player überholen; das löste mitten im Wort ein komplettes Neuzeichnen aus, das Cursor
  und Fokus wegriss (Ursache eines Teils der gemeldeten „nichts passiert beim Klicken“-
  Berichte). Betraf auch Klicks kurz nacheinander.
- Ablaufliste links markiert jetzt zuverlässig den gewählten Bildschirm bzw. das Rätsel
  (vorher wurde die Liste bei Auswahl nicht neu gezeichnet).
- Im Bearbeiten-Modus zeigt ein Hinweis an, dass zum Ausprobieren „▶ Testen“ nötig ist,
  statt dass ein Klick auf Prüfen/Zurück/Antworten stumm bleibt.
- Der gelbe Auswahlrahmen aus dem Bearbeiten-Modus bleibt nicht mehr im Testen-Modus stehen.
- Auswahl-Rätsel: Felder heißen jetzt „Antwort-Schaltflächen“ und „Richtige Antwort“ mit
  erklärender Hilfe.
- Design-Reiter: Hintergrund der gebauten App frei wählbar – Punktmuster (bisher einzige
  Option), Farbverlauf mit Vorlagen, oder ein eigenes Hintergrundbild (mit Abdunkeln für
  Lesbarkeit).
- Werkzeugleiste: heller/dunkler Modus für die Editor-Oberfläche selbst (unabhängig vom
  Design der gebauten Party), Wahl wird im Browser gemerkt.
- Versionsnummer und „Was ist neu“-Verlauf sichtbar in der Werkzeugleiste.
- `.nojekyll` ergänzt, damit GitHub Pages die Dateien unverändert ausliefert.

## 0.2.0 – 2026-09-20

- Einstellungsmenü (PIN 0000) mit drei auswählbaren Demo-Anwendungen.

## 0.1.0 – 2026-09-20

- Erste Fassung: Ablauf, Rätsel und Design zusammenklicken, als einzelne HTML-Datei oder
  ZIP-Paket exportieren.
