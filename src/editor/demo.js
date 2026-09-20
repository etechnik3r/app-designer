/* Die Beispiel-Party.
   Einzige Quelle ist examples/forschergeburtstag.party.json - das
   ist gleichzeitig der Regressionsfall: die urspruengliche, real
   gespielte Forscher-Mission, vollstaendig als Daten ausgedrueckt.
   Laeuft sie, traegt das Datenmodell.                              */

import { migrate, emptyParty } from "../shared/schema.js";

const EXAMPLE_URL = new URL("../../examples/forschergeburtstag.party.json", import.meta.url);

export async function loadDemoParty() {
  try {
    const response = await fetch(EXAMPLE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return migrate(await response.json());
  } catch (err) {
    console.warn("Beispiel-Party nicht ladbar, es geht leer weiter:", err);
    return emptyParty("Neue Rätsel-Party");
  }
}
