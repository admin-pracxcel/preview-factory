/**
 * lib/n8n-edit-webhook.ts
 *
 * Fires the "an edit was approved, please run the workflow" webhook to n8n.
 * The payload is signed with EDIT_WORKFLOW_HMAC_SECRET so n8n can verify
 * it came from us and not a spoofed caller.
 *
 * Config:
 *   N8N_APPROVE_WEBHOOK_URL       — target URL. If unset, calls are no-ops
 *                                    and we log a warning. Approval still
 *                                    works; the edit just sits at status
 *                                    "approved" until an admin handles it
 *                                    manually or the URL is filled in and
 *                                    someone re-triggers.
 *   EDIT_WORKFLOW_HMAC_SECRET     — shared with n8n. Required whenever
 *                                    N8N_APPROVE_WEBHOOK_URL is set.
 *
 * Signature: X-Launcharoo-Signature: t=<epoch>,v1=<hex-hmac>
 *   HMAC-SHA256 of `${t}.${jsonBody}` with the shared secret. Timestamp is
 *   included so replays past a 5-minute window are rejectable on the n8n
 *   side.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

function isHttpUrl(candidate: string): boolean {
  try {
    const u = new URL(candidate);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Verify an inbound signed webhook (n8n → Next). Symmetric with the
 * outbound signer below — same header format, same secret. Returns a
 * result object so callers can log/emit specific failure reasons.
 *
 * `rawBody` MUST be the exact bytes we HMAC'd — always read
 * `await request.text()` first, then hand both to us AND parse the JSON
 * separately. Reading `.json()` first and re-stringifying will re-order
 * keys and break the signature.
 */
export interface VerifyResult {
  ok: boolean;
  reason?:
    | "secret_missing"
    | "signature_header_missing"
    | "signature_malformed"
    | "timestamp_stale"
    | "signature_mismatch";
}

/**
 * Max age of a signature timestamp we'll accept, in seconds. Anything
 * older is treated as a replay attempt. 5 minutes matches Stripe.
 */
const MAX_SIG_AGE_SECONDS = 5 * 60;

export function verifyInboundSignature(
  headerValue: string | null,
  rawBody: string,
): VerifyResult {
  const secret = process.env.EDIT_WORKFLOW_HMAC_SECRET?.trim();
  if (!secret) return { ok: false, reason: "secret_missing" };
  if (!headerValue) return { ok: false, reason: "signature_header_missing" };

  const parts = headerValue.split(",").map((p) => p.trim());
  const t = parts.find((p) => p.startsWith("t="))?.slice(2);
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3);
  if (!t || !v1) return { ok: false, reason: "signature_malformed" };
  const timestamp = Number(t);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "signature_malformed" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestamp) > MAX_SIG_AGE_SECONDS) {
    return { ok: false, reason: "timestamp_stale" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(v1, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "signature_mismatch" };
  }
  return { ok: true };
}

export interface ApprovePayload {
  /** ID of the edit_requests row that was approved. n8n fetches everything
   *  else it needs (tenant siteProps, request text, admin note) from the
   *  Next.js API using its own credentials — we don't ship siteProps over
   *  the wire in case the webhook URL ever leaks. */
  editRequestId: string;
}

/**
 * Post the approval to n8n. Fire-and-forget: returns { ok: false } on any
 * problem so the caller can log and decide whether to surface it. Never
 * throws — the approval state transition already succeeded on our side, we
 * don't want a webhook wobble to also blow that up.
 */
export async function fireApproveWebhook(
  payload: ApprovePayload,
): Promise<{ ok: boolean; reason?: string }> {
  const raw = process.env.N8N_APPROVE_WEBHOOK_URL?.trim();
  if (!raw || !isHttpUrl(raw)) {
    console.warn(
      `[n8n-webhook] N8N_APPROVE_WEBHOOK_URL ${
        raw ? `is not a valid http(s) URL ("${raw}") — treating as unset` : "unset"
      } — approved editRequest ${payload.editRequestId} left for manual pickup`,
    );
    return { ok: false, reason: "webhook_url_unset" };
  }
  const url = raw;

  const secret = process.env.EDIT_WORKFLOW_HMAC_SECRET?.trim();
  if (!secret) {
    console.error(
      "[n8n-webhook] EDIT_WORKFLOW_HMAC_SECRET missing — refusing to send unsigned webhook",
    );
    return { ok: false, reason: "hmac_secret_missing" };
  }

  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Launcharoo-Signature": `t=${timestamp},v1=${signature}`,
      },
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[n8n-webhook] approve webhook returned ${res.status}: ${text.slice(0, 200)}`,
      );
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[n8n-webhook] approve webhook fetch failed:", err);
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
