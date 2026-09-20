# Lizenz-Worker

Der einzige Serverteil des Baukastens. Er nimmt den Stripe-Webhook entgegen
und stellt einen signierten Lizenzschlüssel aus. Geprüft wird der Schlüssel
später ausschließlich im Browser — dieser Worker wird zum Spielen der Party
und zum Bauen nie gebraucht.

Er hält **keinen Zustand**: keine Datenbank, keine Nutzerkonten, keine Liste
verkaufter Lizenzen. Was er wissen muss, steht in der Stripe-Sitzung.

## Einrichten

```bash
npm create cloudflare@latest party-lizenz -- --type=hello-world
# worker.js aus diesem Ordner übernehmen

npx wrangler secret put LICENSE_PRIVATE_KEY     # aus `npm run keygen`
npx wrangler secret put STRIPE_WEBHOOK_SECRET   # whsec_… aus Stripe
npx wrangler secret put STRIPE_SECRET_KEY       # sk_… , nur für /recover
npx wrangler deploy
```

In Stripe:

- **Webhook** auf `https://<worker>/stripe`, Ereignis
  `checkout.session.completed`.
- **Zahlungslink** über 2 €, Rückleitung auf
  `https://<editor>/?license={CHECKOUT_SESSION_ID}`.

Der Editor hängt beim Öffnen des Kaufdialogs die Party-Kennung als
`client_reference_id` an den Zahlungslink. Der Worker bindet den Schlüssel
daran, sodass eine Lizenz zu genau einer Party gehört.

## Endpunkte

| Pfad | Zweck |
|---|---|
| `POST /stripe` | Webhook. Prüft die Stripe-Signatur (HMAC-SHA256, Zeitfenster 5 min), stellt das Token aus und legt es in die Metadaten der Sitzung. |
| `GET /recover?session=cs_…` | Gibt das Token zu einer bezahlten Sitzung zurück — für den Fall, dass der Käufer den Tab geschlossen hat. |

## Tokenformat

```
PARTY-1.<base64url({ pid, iat, feat[], exp? })>.<base64url(Ed25519-Signatur)>
```

Signiert wird der String `PARTY-1.<base64url(payload)>`. `pid` ist die
Party-Kennung oder `*` für „gilt überall". Geprüft wird in
`src/shared/license.js`.

## Von Hand ausstellen

Für Kulanzfälle („Zahlung kam an, Schlüssel ist weg"):

```bash
node tools/sign-license.mjs p_7f3a… "$LICENSE_PRIVATE_KEY"
```

Ohne zweites Argument wird der Demo-Schlüssel benutzt — nur zum Ausprobieren.
