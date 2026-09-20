#!/usr/bin/env node
/* Erzeugt ein Ed25519-Schluesselpaar fuer die Lizenzen.
   Oeffentlicher Teil kommt in src/shared/license.js,
   privater Teil ausschliesslich als Secret in den Worker.        */

import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const spki = publicKey.export({ type: "spki", format: "der" });
const raw = spki.subarray(spki.length - 32);             // die letzten 32 Byte sind der Schlüssel
const pkcs8 = privateKey.export({ type: "pkcs8", format: "der" });

console.log(`
Neues Schlüsselpaar
===================

1) In src/shared/license.js eintragen:

   export const PUBLIC_KEY_B64 = "${raw.toString("base64")}";

2) Im Cloudflare Worker als Secret hinterlegen
   (wrangler secret put LICENSE_PRIVATE_KEY):

   ${pkcs8.toString("base64")}

Der private Schlüssel darf nirgends ins Repository. Wer ihn hat,
kann beliebig viele Lizenzen ausstellen.
`);
