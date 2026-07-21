/**
 * lib/clicksend-client.ts
 * Thin wrapper around ClickSend's Send-SMS REST endpoint.
 *
 * Env vars (Vercel):
 *   CLICKSEND_USERNAME    account username (email you signed up with)
 *   CLICKSEND_API_KEY     API key from ClickSend dashboard → API Credentials
 *   CLICKSEND_SENDER_ID   alphanumeric sender ID, e.g. "LAUNCHAROO"
 *                         (11 chars max, letters/digits only, no spaces)
 *                         Falls back to "Launcharoo" if unset.
 *
 * All three are required — the client refuses to send if any is missing
 * so we fail loudly in dev instead of silently in prod.
 *
 * ClickSend rules:
 *   - Australian mobiles must be E.164: +614xxxxxxxx (drop the leading 0)
 *   - Body >160 chars is charged as multi-part; we keep messages tight
 *   - Reply-STOP handling is automatic on ClickSend's side once configured
 */

const ENDPOINT = "https://rest.clicksend.com/v3/sms/send";

export interface SendSmsInput {
  to: string;
  body: string;
}

export interface SendSmsResult {
  ok: boolean;
  messageId?: string;
  reason?: string;
}

/**
 * Normalise an Australian mobile to E.164.
 *   "0412345678"    → "+61412345678"
 *   "+61412345678"  → "+61412345678"
 *   "61412345678"   → "+61412345678"
 *   "412345678"     → "+61412345678"
 * Returns null if the input doesn't look like an AU mobile.
 */
export function normaliseAuMobile(raw: string): string | null {
  const digitsOnly = raw.replace(/[^\d+]/g, "");
  if (/^\+614\d{8}$/.test(digitsOnly)) return digitsOnly;
  if (/^04\d{8}$/.test(digitsOnly)) return `+61${digitsOnly.slice(1)}`;
  if (/^614\d{8}$/.test(digitsOnly)) return `+${digitsOnly}`;
  if (/^4\d{8}$/.test(digitsOnly)) return `+61${digitsOnly}`;
  return null;
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const username = process.env.CLICKSEND_USERNAME?.trim();
  const apiKey = process.env.CLICKSEND_API_KEY?.trim();
  const senderId = process.env.CLICKSEND_SENDER_ID?.trim() || "Launcharoo";
  if (!username || !apiKey) {
    return { ok: false, reason: "credentials_missing" };
  }

  const to = normaliseAuMobile(input.to);
  if (!to) {
    return { ok: false, reason: "invalid_recipient" };
  }

  const auth = Buffer.from(`${username}:${apiKey}`).toString("base64");
  const payload = {
    messages: [
      {
        source: "launcharoo",
        from: senderId,
        to,
        body: input.body,
      },
    ],
  };

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return {
      ok: false,
      reason: `network_error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const data = (await res.json().catch(() => ({}))) as {
    response_code?: string;
    response_msg?: string;
    data?: { messages?: Array<{ message_id?: string; status?: string }> };
  };

  if (!res.ok || data.response_code !== "SUCCESS") {
    console.error("[clicksend] send failed:", res.status, data.response_msg ?? data);
    return {
      ok: false,
      reason: `api_error: ${data.response_msg ?? res.statusText}`,
    };
  }

  const messageId = data.data?.messages?.[0]?.message_id;
  return { ok: true, messageId };
}
