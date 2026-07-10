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

import { createHmac } from "node:crypto";

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
  const url = process.env.N8N_APPROVE_WEBHOOK_URL?.trim();
  if (!url) {
    console.warn(
      `[n8n-webhook] N8N_APPROVE_WEBHOOK_URL unset — approved editRequest ${payload.editRequestId} left for manual pickup`,
    );
    return { ok: false, reason: "webhook_url_unset" };
  }

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
