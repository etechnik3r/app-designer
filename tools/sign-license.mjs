#!/usr/bin/env node
/* Stellt von Hand einen Lizenzschluessel aus - zum Ausprobieren und
   fuer Kulanzfaelle ("Zahlung kam an, Schluessel ist verloren").

   Aufruf:
     node tools/sign-license.mjs <party-id|*> [privater-schluessel-base64]

   Ohne zweites Argument wird der DEMO-Schluessel benutzt. Der ist
   oeffentlich bekannt und taugt nur zum Testen.                    */

import { createPrivateKey, sign } from "node:crypto";

const DEMO_PRIVATE_KEY = "MC4CAQAwBQYDK2VwBCIEIBz19rRprzbYVPUktA/yb18Y90lOpOsrJS8B8QRbyNUa";

const partyId = process.argv[2];
const keyB64 = process.argv[3] || DEMO_PRIVATE_KEY;

if (!partyId) {
  console.error(`
Aufruf: node tools/sign-license.mjs <party-id|*> [privater-schluessel-base64]

  <party-id>  bindet den Schlüssel an genau eine Party (steht im
              Kaufdialog des Editors), "*" gilt für alle.
`);
  process.exit(1);
}

function b64url(buffer) {
  return Buffer.from(buffer).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const payload = {
  pid: partyId,
  iat: Math.floor(Date.now() / 1000),
  feat: ["nobadge", "pdf", "unlimited", "branding"],
};

const signed = `PARTY-1.${b64url(JSON.stringify(payload))}`;
const key = createPrivateKey({ key: Buffer.from(keyB64, "base64"), format: "der", type: "pkcs8" });
const signature = sign(null, Buffer.from(signed, "utf8"), key);

console.log(`${signed}.${b64url(signature)}`);
if (keyB64 === DEMO_PRIVATE_KEY) {
  console.error("\nHinweis: mit dem DEMO-Schlüssel signiert. Vor dem Verkauf tools/keygen.mjs benutzen.");
}
