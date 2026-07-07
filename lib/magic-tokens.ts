/**
 * lib/magic-tokens.ts
 * Issue + verify magic-link login tokens.
 *
 * Tokens are 32-byte random values, base64url-encoded and delivered in the
 * email link. Only the SHA-256 hash is persisted — a DB reader can't log in
 * as anyone, they'd have to intercept a live email. The `magic_tokens.token`
 * column stores the hash (schema comment updated to reflect that).
 *
 * Rate-limiting: request-link short-circuits if the caller emailed within
 * REQUEST_COOLDOWN_MS. Cheap protection against accidental double-clicks and
 * mild abuse; not a substitute for a proper rate-limiter.
 */

import { createHash, randomBytes } from "node:crypto";
import { supabase } from "@/lib/supabase";

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 min
const REQUEST_COOLDOWN_MS = 60 * 1000; // 60 s per email

export interface IssueResult {
  /** The raw token to embed in the magic link. Never persisted. */
  rawToken: string;
  expiresAt: Date;
}

/**
 * Mint a new token for `email`. Returns null if we're within the cooldown
 * window for that address — caller should still respond 200 to avoid leaking
 * whether the address exists.
 */
export async function issueMagicToken(email: string): Promise<IssueResult | null> {
  const normalized = email.trim().toLowerCase();

  const cooldownSince = new Date(Date.now() - REQUEST_COOLDOWN_MS).toISOString();
  const { data: recent, error: recentError } = await supabase()
    .from("magic_tokens")
    .select("created_at")
    .eq("email", normalized)
    .gt("created_at", cooldownSince)
    .limit(1)
    .maybeSingle();
  if (recentError) {
    throw new Error(`magic-token cooldown check failed: ${recentError.message}`);
  }
  if (recent) return null;

  const raw = randomBytes(32).toString("base64url");
  const hash = sha256(raw);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  const { error: insertError } = await supabase()
    .from("magic_tokens")
    .insert({
      token: hash,
      email: normalized,
      expires_at: expiresAt.toISOString(),
    });
  if (insertError) {
    throw new Error(`magic-token insert failed: ${insertError.message}`);
  }

  return { rawToken: raw, expiresAt };
}

export interface VerifyResult {
  email: string;
}

/**
 * Verify a raw token from the URL. Returns the associated email on success,
 * or throws a user-safe Error. Marks the token used_at atomically to prevent
 * replay. One-shot: a second call with the same token throws.
 */
export async function verifyMagicToken(rawToken: string): Promise<VerifyResult> {
  if (!rawToken || rawToken.length < 32) {
    throw new Error("Invalid link");
  }
  const hash = sha256(rawToken);

  const { data, error } = await supabase()
    .from("magic_tokens")
    .select("email, expires_at, used_at")
    .eq("token", hash)
    .maybeSingle();
  if (error) throw new Error(`magic-token lookup failed: ${error.message}`);
  if (!data) throw new Error("Invalid link");
  if (data.used_at) throw new Error("This link has already been used");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new Error("This link has expired");
  }

  const { error: updateError } = await supabase()
    .from("magic_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token", hash)
    .is("used_at", null);
  if (updateError) {
    throw new Error(`magic-token consume failed: ${updateError.message}`);
  }

  return { email: data.email as string };
}

function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
