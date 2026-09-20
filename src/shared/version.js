/* Versionsstand des Baukastens.
   Eine Zahl an einer Stelle - Werkzeugleiste, Fehlerberichte und der
   Verlauf-Dialog lesen von hier. Bei jeder spuerbaren Aenderung hier
   UND in CHANGELOG.md einen Eintrag ergaenzen; package.json zieht
   bei Gelegenheit nach, ist aber nicht sicherheitsrelevant.         */

export const APP_VERSION = "0.3.0";

/* Neueste Eintraege zuerst. Kurz und in Bedienersprache - das ist
   kein Git-Log, sondern die "Was ist neu"-Liste im Editor.          */
export const CHANGELOG = [
  {
    version: "0.3.0",
    date: "2026-09-20",
    notes: [
      "Tipp-Fehler behoben: bei schnellem Tippen konnte sich die Bestätigung zweier Tasten überholen und mitten im Wort ein Neuzeichnen auslösen, das Cursor und Fokus wegriss.",
      "Ablaufliste links markiert jetzt zuverlässig den gewählten Bildschirm bzw. das Rätsel.",
      "Im Bearbeiten-Modus zeigt ein Hinweis an, dass zum Ausprobieren „▶ Testen“ nötig ist, statt stumm zu bleiben.",
      "Der gelbe Auswahlrahmen bleibt nicht mehr im Testen-Modus stehen.",
      "Auswahl-Rätsel: Felder heißen jetzt „Antwort-Schaltflächen“ und „Richtige Antwort“ mit Erklärung.",
      "Design-Reiter: Hintergrund frei wählbar - Punktmuster, Farbverlauf oder eigenes Bild.",
      "Werkzeugleiste: heller/dunkler Modus für den Editor selbst.",
      "Versionsnummer und Verlauf („Was ist neu“) sichtbar in der Werkzeugleiste.",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-09-20",
    notes: [
      "Einstellungsmenü (PIN 0000) mit drei auswählbaren Demo-Anwendungen.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-09-20",
    notes: [
      "Erste Fassung: Ablauf, Rätsel und Design zusammenklicken, als einzelne HTML-Datei oder ZIP exportieren.",
    ],
  },
];
