// HMAC verification via Web Crypto. Build Guide §14.1: crypto.subtle.verify
// is constant-time by design — no manual timingSafeEqual needed.
// First webhook handler lands in S3 (Transfeera); the helper exists from S1
// so the convention is set.

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('hex_length_odd');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(clean.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) throw new Error('hex_invalid');
    out[i] = byte;
  }
  return out;
}

/**
 * Verify an HMAC-SHA256 signature on a raw request body.
 * @param rawBody  the bytes that were signed (must NOT be re-serialized JSON)
 * @param signatureHex hex-encoded signature from the provider
 * @param secret  the shared secret (utf-8)
 * @returns true if the signature is valid; false otherwise (never throws on bad sig)
 */
export async function verifyHmacSha256(
  rawBody: ArrayBuffer | Uint8Array,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  let sigBytes: Uint8Array;
  try {
    sigBytes = hexToBytes(signatureHex.trim());
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  // crypto.subtle.verify is constant-time by spec.
  return crypto.subtle.verify('HMAC', key, sigBytes as BufferSource, rawBody as BufferSource);
}
