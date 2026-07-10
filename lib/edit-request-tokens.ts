/**
 * lib/edit-request-tokens.ts
 *
 * HMAC-signed single-use tokens for the "approve/reject from email" path.
 * The email delivered to the concierge inbox contains a signed URL like
 * `/admin/edit-requests/<id>?token=<token>`; the token proves "we sent
 * this link", so clicking it doesn't require the recipient to already be
 * signed in as admin.
 *
 * Design notes:
 *   - Encoding is `<base64url(payload)>.<base64url(hmac)>`. base64url is
 *     URL-safe and copy-paste friendly.
 *   - Payload is `{ id, exp }`. `id` is the edit_requests row id; `exp`
 *     is a unix epoch second.
 *   - Signature is HMAC-SHA256 over the base64url-encoded payload.
 *   - Compared with `timingSafeEqual` to blunt timing attacks.
 *   - Single-use is *not* enforced by the token itself. The state machine
 *     already gates it: after approve, status flips off `pending`, and
 *     replaying the same token is a 409 "Already approved". We keep the
 *     `token_hash` column reserved (Phase 0) in case we later want to
 *     rotate/invalidate before the state changes.
 *   - Config: EDIT_APPROVAL_TOKEN_SECRET. Missing → verify + sign both
 *     throw so we never accidentally accept an unsigned token in prod.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

interface Payload {
  id: string;
  exp: number;
}

function secret(): string {
  const s = process.env.EDIT_APPROVAL_TOKEN_SECRET?.trim();
  if (!s) throw new Error("EDIT_APPROVAL_TOKEN_SECRET is not set");
  return s;
}

function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const normalised = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(normalised, "base64");
}

function sign(payloadB64: string): string {
  return b64urlEncode(
    createHmac("sha256", secret()).update(payloadB64).digest(),
  );
}

/**
 * Sign an approval token for a given edit request id.
 *
 * @param editRequestId  UUID of the edit_requests row
 * @param ttlSeconds     seconds until expiry; defaults to 7 days
 */
export function signApprovalToken(
  editRequestId: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): string {
  const payload: Payload = {
    id: editRequestId,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

export interface VerifiedToken {
  editRequestId: string;
  /** Unix epoch second when this token expires. */
  exp: number;
}

export class TokenError extends Error {
  constructor(
    message: string,
    readonly code:
      | "malformed"
      | "bad_signature"
      | "expired"
      | "payload_invalid",
  ) {
    super(message);
    this.name = "TokenError";
  }
}

/**
 * Verify a token. Throws TokenError on any problem. Callers should catch
 * and fall back to admin-session auth (or return 401).
 */
export function verifyApprovalToken(token: string): VerifiedToken {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new TokenError("token is not in <payload>.<sig> form", "malformed");
  }
  const [payloadB64, presentedSigB64] = parts;

  const expectedSigB64 = sign(payloadB64);
  const a = b64urlDecode(presentedSigB64);
  const b = b64urlDecode(expectedSigB64);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new TokenError("signature does not match", "bad_signature");
  }

  let payload: Payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8")) as Payload;
  } catch {
    throw new TokenError("payload is not valid JSON", "payload_invalid");
  }
  if (
    typeof payload.id !== "string" ||
    payload.id.length === 0 ||
    typeof payload.exp !== "number"
  ) {
    throw new TokenError("payload missing id or exp", "payload_invalid");
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) {
    throw new TokenError("token has expired", "expired");
  }

  return { editRequestId: payload.id, exp: payload.exp };
}
