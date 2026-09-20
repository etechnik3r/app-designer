/* Lizenzpruefung.
   Erzeugt werden Token serverseitig (license-fn/worker.js) nach der
   Stripe-Zahlung, geprueft werden sie hier - vollstaendig im Browser,
   offline, ohne Konto und ohne Datenbank.

   Format:  PARTY-1.<base64url(payload)>.<base64url(signatur)>
   Signiert wird der String "PARTY-1.<base64url(payload)>".

   ACHTUNG: Der hier eingetragene Schluessel ist ein DEMO-Schluessel,
   dessen privater Teil in license-fn/DEMO-SCHLUESSEL.txt liegt und
   damit oeffentlich ist. Vor dem ersten echten Verkauf mit
   `node tools/keygen.mjs` ein eigenes Paar erzeugen.                */

export const PUBLIC_KEY_B64 = "YKGumZJcPlreMIBcSwE6yiCqjpR0pWgWtfO+CDZC/oA=";

export const FEATURES = {
  nobadge: "Wasserzeichen entfernt",
  pdf: "Begleitmaterial als PDF",
  unlimited: "Beliebig viele Rätsel",
  branding: "Eigener Titel und eigenes Symbol",
};

/* In der Gratis-Version begrenzt, damit der Kauf nicht nur
   "Nervigkeit abkaufen" ist. Siehe KONZEPT.md, Abschnitt 8.2. */
export const FREE_PUZZLE_LIMIT = 4;

export function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes) {
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function parseToken(token) {
  if (typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3 || parts[0] !== "PARTY-1") return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    return { payload, signed: `${parts[0]}.${parts[1]}`, signature: b64urlDecode(parts[2]) };
  } catch {
    return null;
  }
}

/* Prueft Signatur und Bindung an die Party.
   Ergebnis: { ok, reason, payload, features }                      */
export async function verifyLicense(token, { partyId } = {}) {
  const fail = (reason) => ({ ok: false, reason, payload: null, features: [] });
  if (!token) return fail("keine Lizenz hinterlegt");

  const parsed = parseToken(token);
  if (!parsed) return fail("Lizenzschlüssel unlesbar");

  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return fail("Browser unterstützt keine Signaturprüfung");

  let valid = false;
  try {
    const key = await subtle.importKey(
      "raw", b64urlDecode(PUBLIC_KEY_B64.replace(/\+/g, "-").replace(/\//g, "_")),
      { name: "Ed25519" }, false, ["verify"],
    );
    valid = await subtle.verify(
      { name: "Ed25519" }, key, parsed.signature,
      new TextEncoder().encode(parsed.signed),
    );
  } catch (err) {
    return fail(`Signatur nicht prüfbar (${err.name || "Fehler"})`);
  }
  if (!valid) return fail("Signatur stimmt nicht");

  const payload = parsed.payload;
  if (payload.exp && Date.now() / 1000 > payload.exp) return fail("Lizenz abgelaufen");
  if (partyId && payload.pid && payload.pid !== "*" && payload.pid !== partyId) {
    return fail("Lizenz gehört zu einer anderen Party");
  }

  return { ok: true, reason: "gültig", payload, features: payload.feat || [] };
}

export function hasFeature(licenseState, feature) {
  return !!licenseState?.ok && (licenseState.features || []).includes(feature);
}
