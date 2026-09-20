import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { parseToken, verifyLicense, hasFeature } from "../src/shared/license.js";

function mint(partyId) {
  return execFileSync("node", ["tools/sign-license.mjs", partyId], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

test("ein selbst ausgestellter Schlüssel wird angenommen", async () => {
  const token = mint("p_test123");
  const state = await verifyLicense(token, { partyId: "p_test123" });
  assert.equal(state.ok, true, state.reason);
  assert.ok(hasFeature(state, "nobadge"));
});

test("ein Schlüssel für eine andere Party wird abgelehnt", async () => {
  const token = mint("p_andere");
  const state = await verifyLicense(token, { partyId: "p_test123" });
  assert.equal(state.ok, false);
  assert.match(state.reason, /anderen Party/);
});

test("ein Platzhalter-Schlüssel gilt für jede Party", async () => {
  const token = mint("*");
  assert.equal((await verifyLicense(token, { partyId: "beliebig" })).ok, true);
});

test("eine verfälschte Signatur fliegt auf", async () => {
  const token = mint("*");
  const forged = `${token.slice(0, -6)}AAAAAA`;
  const state = await verifyLicense(forged, { partyId: "beliebig" });
  assert.equal(state.ok, false);
  assert.match(state.reason, /Signatur/);
});

test("veränderte Nutzdaten fliegen auf", async () => {
  const token = mint("p_original");
  const [prefix, payload, signature] = token.split(".");
  const tampered = Buffer.from(JSON.stringify({ pid: "*", iat: 1, feat: ["nobadge"] }))
    .toString("base64url");
  const state = await verifyLicense(`${prefix}.${tampered}.${signature}`, { partyId: "beliebig" });
  assert.equal(state.ok, false);
});

test("Unfug wird sauber abgewiesen, statt zu krachen", async () => {
  for (const junk of [null, "", "hallo", "PARTY-1.x", "PARTY-2.a.b"]) {
    const state = await verifyLicense(junk, { partyId: "x" });
    assert.equal(state.ok, false);
  }
  assert.equal(parseToken("kaputt"), null);
});

test("ein abgelaufener Schlüssel gilt nicht mehr", async () => {
  /* Direkt gebaut, weil das Werkzeug kein exp setzt. */
  const { createPrivateKey, sign } = await import("node:crypto");
  const DEMO = "MC4CAQAwBQYDK2VwBCIEIBz19rRprzbYVPUktA/yb18Y90lOpOsrJS8B8QRbyNUa";
  const payload = Buffer.from(JSON.stringify({ pid: "*", iat: 1, exp: 100, feat: ["nobadge"] })).toString("base64url");
  const signed = `PARTY-1.${payload}`;
  const key = createPrivateKey({ key: Buffer.from(DEMO, "base64"), format: "der", type: "pkcs8" });
  const token = `${signed}.${sign(null, Buffer.from(signed), key).toString("base64url")}`;

  const state = await verifyLicense(token, { partyId: "x" });
  assert.equal(state.ok, false);
  assert.match(state.reason, /abgelaufen/);
});
