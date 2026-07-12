import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks (standardwebhooks.com) signing — a self-contained copy of
 * `@mailtea/contracts` `webhook-signing.ts` so the published `mailtea` SDK can
 * verify (and sign) webhooks without a runtime dependency on that package. Kept
 * byte-for-byte in parity by `webhook-signing.test.ts`. node:crypto only.
 *
 * The stored signing secret is `whsec_<base64>`. The HMAC key is the base64
 * remainder decoded to bytes. The signed content is `{msgId}.{timestamp}.{payload}`
 * where `timestamp` is Unix SECONDS, matching the `webhook-timestamp` header.
 */

const SECRET_PREFIX = "whsec_";
const SIGNATURE_VERSION = "v1";

/** Decode the HMAC key from a `whsec_`-prefixed secret (base64 / base64url). */
function decodeSigningKey(secret: string): Buffer {
  const raw = secret.startsWith(SECRET_PREFIX)
    ? secret.slice(SECRET_PREFIX.length)
    : secret;
  // Node's base64 decoder accepts both base64 and base64url alphabets, so a
  // `whsec_` secret minted with base64url decodes correctly here without a
  // separate branch.
  return Buffer.from(raw, "base64");
}

function computeSignature(input: {
  secret: string;
  msgId: string;
  timestamp: number;
  payload: string;
}): string {
  const timestampSeconds = Math.floor(input.timestamp);
  const signedContent = `${input.msgId}.${timestampSeconds}.${input.payload}`;
  const key = decodeSigningKey(input.secret);
  const digest = createHmac("sha256", key).update(signedContent, "utf8").digest("base64");
  return digest;
}

/** Input for {@link signWebhook}. */
export interface SignWebhookInput {
  secret: string;
  msgId: string;
  /** Unix seconds — the same value sent in the `webhook-timestamp` header. */
  timestamp: number;
  payload: string;
}

/**
 * Sign a webhook payload. Returns the `webhook-signature` header value in
 * Standard Webhooks form: `v1,<base64 HMAC-SHA256>`.
 */
export function signWebhook(input: SignWebhookInput): string {
  return `${SIGNATURE_VERSION},${computeSignature(input)}`;
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Input for {@link verifyWebhookSignature}. */
export interface VerifyWebhookSignatureInput {
  secret: string;
  msgId: string;
  /** Unix seconds, as received in the `webhook-timestamp` header. */
  timestamp: number;
  payload: string;
  signatureHeader: string;
  /** Allowed clock skew each way. Default 5 minutes. */
  toleranceSeconds?: number;
  /** Injectable for tests. Unix seconds. */
  now?: number;
}

/**
 * Verify a `webhook-signature` header against the expected HMAC. The header may
 * carry multiple space-delimited `v1,<sig>` tokens (Standard Webhooks allows
 * key rotation); a match against any `v1` token passes. Rejects when the
 * timestamp is outside `toleranceSeconds` of `now` (replay protection).
 */
export function verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
  const tolerance = input.toleranceSeconds ?? 300;
  const nowSeconds = input.now ?? Math.floor(Date.now() / 1000);
  const timestampSeconds = Math.floor(input.timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  if (Math.abs(nowSeconds - timestampSeconds) > tolerance) {
    return false;
  }

  const expected = computeSignature({
    secret: input.secret,
    msgId: input.msgId,
    timestamp: timestampSeconds,
    payload: input.payload
  });

  const tokens = input.signatureHeader.split(" ").filter(Boolean);
  for (const token of tokens) {
    const commaIndex = token.indexOf(",");
    if (commaIndex === -1) {
      continue;
    }
    const version = token.slice(0, commaIndex);
    const signature = token.slice(commaIndex + 1);
    if (version === SIGNATURE_VERSION && safeEqual(signature, expected)) {
      return true;
    }
  }

  return false;
}
