// Minimal APNs (HTTP/2 provider API) client — no npm package needed since
// Deno's fetch negotiates HTTP/2 over TLS automatically, and Web Crypto
// covers the ES256 JWT signing APNs uses for provider auth tokens.
//
// Uses the production APNs host: TestFlight and App Store builds carry the
// `aps-environment: production` entitlement, so that's the host they need.
// Only a local Xcode debug build would need api.sandbox.push.apple.com.

export interface ApnsConfig {
  auth_key: string;
  key_id: string;
  team_id: string;
  bundle_id: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importApnsSigningKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// APNs provider tokens are valid up to an hour — cache the signed JWT for
// this invocation rather than re-signing per device.
let cachedJwt: { token: string; keyId: string; expiresAt: number } | null = null;

async function getApnsJwt(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.keyId === config.key_id && cachedJwt.expiresAt > now + 60) {
    return cachedJwt.token;
  }
  const header = { alg: "ES256", kid: config.key_id };
  const payload = { iss: config.team_id, iat: now };
  const encoder = new TextEncoder();
  const signingInput = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(
    encoder.encode(JSON.stringify(payload)),
  )}`;
  const key = await importApnsSigningKey(config.auth_key);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    encoder.encode(signingInput),
  );
  const token = `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
  cachedJwt = { token, keyId: config.key_id, expiresAt: now + 3000 };
  return token;
}

export interface ApnsPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

/** Sends to one device token; returns whether the token should be dropped
 * (APNs said it's no longer valid) rather than throwing, so callers can
 * batch cleanup the same way they do for expired Web Push endpoints. */
export async function sendApnsNotification(
  config: ApnsConfig,
  deviceToken: string,
  payload: ApnsPayload,
): Promise<{ ok: boolean; shouldRemoveToken: boolean }> {
  const jwt = await getApnsJwt(config);
  const res = await fetch(`https://api.push.apple.com/3/device/${deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": config.bundle_id,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify({
      aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
      tag: payload.tag,
      url: payload.url,
    }),
  });
  if (res.ok) return { ok: true, shouldRemoveToken: false };
  // BadDeviceToken / Unregistered / DeviceTokenNotForTopic all mean the
  // token is dead and should stop being retried.
  const shouldRemoveToken = res.status === 400 || res.status === 410;
  await res.body?.cancel();
  return { ok: false, shouldRemoveToken };
}
