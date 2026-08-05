/**
 * HS256 access tokens via Web Crypto, replacing PyJWT. The claim set is unchanged from
 * backend/app/core/security.py: { sub: email, role, exp } with exp as a UNIX second.
 */
const encoder = new TextEncoder();

export interface TokenPayload {
  sub: string;
  role: string;
  exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function signingKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage]
  );
}

export async function createAccessToken(
  subject: string,
  role: string,
  expiresMinutes: number,
  secret: string
): Promise<string> {
  const header = base64UrlEncode(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const exp = Math.floor(Date.now() / 1000) + expiresMinutes * 60;
  const payload = base64UrlEncode(encoder.encode(JSON.stringify({ sub: subject, role, exp })));
  const body = `${header}.${payload}`;
  const key = await signingKey(secret, "sign");
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Returns null on any malformed, mis-signed, or expired token — never throws. */
export async function decodeAccessToken(token: string, secret: string): Promise<TokenPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts as [string, string, string];

  const key = await signingKey(secret, "verify");
  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlDecode(signature),
      encoder.encode(`${header}.${payload}`)
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as TokenPayload;
    if (typeof decoded.sub !== "string" || typeof decoded.exp !== "number") return null;
    if (decoded.exp <= Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}
