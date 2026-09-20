/* Cloudflare Worker: Stripe-Webhook -> Lizenzschluessel.
   Das ist der einzige Serverteil des ganzen Baukastens. Er haelt
   keinen Zustand, hat keine Datenbank und laeuft im kostenlosen
   Kontingent - geprueft wird der Schluessel spaeter offline im
   Browser gegen den oeffentlichen Teil.

   Einrichten:
     wrangler secret put STRIPE_WEBHOOK_SECRET   (whsec_… aus Stripe)
     wrangler secret put LICENSE_PRIVATE_KEY     (aus tools/keygen.mjs)
     wrangler secret put STRIPE_SECRET_KEY       (sk_… , nur fuer /recover)

   In Stripe eintragen:
     Webhook auf  https://<worker>/stripe
     Ereignis     checkout.session.completed
     Zahlungslink mit Rueckleitung auf
       https://<editor>/?license={CHECKOUT_SESSION_ID}
     — der Editor tauscht die Sitzungskennung ueber /recover
       gegen den Schluessel, falls die Bestaetigungsmail nicht
       abgewartet wird.                                             */

const FEATURES = ["nobadge", "pdf", "unlimited", "branding"];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/stripe" && request.method === "POST") {
      return handleWebhook(request, env);
    }
    if (url.pathname === "/recover" && request.method === "GET") {
      return handleRecover(url, env);
    }
    return new Response("Nicht gefunden", { status: 404 });
  },
};

/* ---- Stripe-Signatur pruefen (ohne SDK) -------------------------- */

async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(
    String(header || "").split(",").map((p) => p.split("=", 2)),
  );
  if (!parts.t || !parts.v1) return false;

  /* Wiedereinspielen aelterer Ereignisse abweisen. */
  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(`${parts.t}.${payload}`),
  );
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(expected, parts.v1);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ---- Schluessel ausstellen --------------------------------------- */

function b64url(bytes) {
  let binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function mintToken(partyId, privateKeyB64) {
  const payload = {
    pid: partyId || "*",
    iat: Math.floor(Date.now() / 1000),
    feat: FEATURES,
  };
  const signed = `PARTY-1.${b64url(new TextEncoder().encode(JSON.stringify(payload)))}`;

  const raw = Uint8Array.from(atob(privateKeyB64), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", raw, { name: "Ed25519" }, false, ["sign"]);
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, key, new TextEncoder().encode(signed));

  return `${signed}.${b64url(signature)}`;
}

async function handleWebhook(request, env) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Signatur ungültig", { status: 400 });

  const event = JSON.parse(payload);
  if (event.type !== "checkout.session.completed") return new Response("ignoriert", { status: 200 });

  const session = event.data.object;
  if (session.payment_status !== "paid") return new Response("nicht bezahlt", { status: 200 });

  const token = await mintToken(session.client_reference_id, env.LICENSE_PRIVATE_KEY);

  /* Der Schluessel geht ueber die Stripe-Metadaten zurueck; von dort
     holt ihn /recover. Ein eigener Speicher ist dafuer nicht noetig. */
  await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ "metadata[license]": token }),
  });

  return new Response("ok", { status: 200 });
}

async function handleRecover(url, env) {
  const sessionId = url.searchParams.get("session");
  if (!sessionId) return json({ error: "session fehlt" }, 400);

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) return json({ error: "Sitzung unbekannt" }, 404);

  const session = await response.json();
  if (session.payment_status !== "paid") return json({ error: "nicht bezahlt" }, 402);

  const token = session.metadata?.license
    || await mintToken(session.client_reference_id, env.LICENSE_PRIVATE_KEY);

  return json({ license: token });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",     // der Editor laeuft auf einer anderen Adresse
    },
  });
}
