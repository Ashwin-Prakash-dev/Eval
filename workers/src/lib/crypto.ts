/**
 * Passcode generation and hashing.
 *
 * The FastAPI backend hashed passcodes with bcrypt, which cannot run in the Workers
 * runtime (native binding) and would burn hundreds of milliseconds of CPU per call even
 * as pure JS. It is also the wrong tool here: the secret is a 6-digit numeric code, so a
 * 10^6 keyspace falls to any offline attacker in milliseconds regardless of cost factor.
 *
 * Instead the stored value is HMAC-SHA256 keyed by OTP_PEPPER, which lives in Workers
 * Secrets and never in D1. An attacker with database read access cannot brute-force the
 * digest without also holding the key. Verification is constant-time.
 */

const encoder = new TextEncoder();

/**
 * Cryptographically secure, zero-padded to exactly `length` digits. Rejection sampling
 * keeps the distribution uniform — taking a modulo of a random 32-bit value would bias
 * the low digits.
 */
export function generateNumericCode(length: number): string {
  const upperBound = 10 ** length;
  const limit = Math.floor(0xffffffff / upperBound) * upperBound;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0]!;
  } while (value >= limit);
  return String(value % upperBound).padStart(length, "0");
}

async function hmacKey(pepper: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * The email is bound into the signed message so a digest can never be replayed against a
 * different address. This is internal to the hash and has no effect on the API surface.
 */
export async function hashPasscode(code: string, email: string, pepper: string): Promise<string> {
  const key = await hmacKey(pepper);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${email}:${code}`));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison — a plain `===` on the hex digest leaks via timing. */
export async function verifyPasscode(
  code: string,
  email: string,
  pepper: string,
  storedHash: string
): Promise<boolean> {
  const computed = await hashPasscode(code, email, pepper);
  const a = encoder.encode(computed);
  const b = encoder.encode(storedHash);
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
}
