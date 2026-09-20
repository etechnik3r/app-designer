/* Die Demo-Anwendungen des Baukastens.
   Drei fertige Partys, die im Einstellungsmenue zur Auswahl stehen -
   verschiedene Storylines, Farbwelten und Raetseltypen, damit man
   auf einen Blick sieht, was der Baukasten kann. Jede liegt als
   .party.json in examples/ und ist zugleich ein Regressionsfall.   */

import { migrate } from "../shared/schema.js";

/* Reihenfolge = Reihenfolge im Menue. icon/preset nur fuer die
   Kachel; die echten Farben stehen in der jeweiligen Datei.        */
export const DEMOS = [
  {
    id: "piraten",
    file: "piraten-schatzsuche",
    name: "Piraten-Schatzsuche",
    icon: "🏴‍☠️",
    tagline: "Freibeuter-Abenteuer in warmem Gold auf Meerblau.",
    covers: "Auswahl · Wort-Antwort · Reihenfolge · Richtig/Falsch · Zahlen-Code",
  },
  {
    id: "weltraum",
    file: "weltraum-mission",
    name: "Sternenmission Andromeda",
    icon: "🚀",
    tagline: "Raumstation retten – dunkles Cockpit, Türkis und Neon. Rätsel nacheinander freischalten.",
    covers: "Zahlen-Code · Reihenfolge · Einsortieren · Auswahl · Richtig/Falsch",
  },
  {
    id: "detektiv",
    file: "detektiv-fall",
    name: "Der Fall der gestohlenen Torte",
    icon: "🕵️",
    tagline: "Kriminalfall in Sepia und Gold – mit Bild-Zuordnung als Beweismittel.",
    covers: "Auswahl · Richtig/Falsch · Einsortieren · Zahlen zuordnen · Wort-Antwort",
  },
];

const DEMO_DIR = new URL("../../examples/", import.meta.url);

/* Laedt eine Demo als frisches Party-Dokument. Wirft bei Fehlern -
   der Aufrufer entscheidet, was dann angezeigt wird.               */
export async function loadDemo(id) {
  const demo = DEMOS.find((d) => d.id === id);
  if (!demo) throw new Error(`Unbekannte Demo: ${id}`);
  const response = await fetch(new URL(`${demo.file}.party.json`, DEMO_DIR));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return migrate(await response.json());
}
