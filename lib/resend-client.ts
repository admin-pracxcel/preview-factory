/**
 * lib/resend-client.ts
 * Resend transactional-email helper. Pure fetch — no npm package required.
 *
 * Key resolution:
 *   RESEND_API_KEY set   → real send
 *   Not set              → log-only mode (writes the message to server logs and
 *                          returns success). Used in local dev so the dev flow
 *                          doesn't require anyone to plug credentials in.
 *
 * Human deploy note:
 *   1. Sign up at resend.com (free tier is enough for launch).
 *   2. Developers → API Keys → create a "Full access" key → RESEND_API_KEY.
 *   3. RESEND_FROM_EMAIL: for dev use `onboarding@resend.dev` (only sends to
 *      your account email). For prod: verify a domain in Resend and use
 *      something like `hello@yourdomain.com`.
 */

/* ---------------------------------------------------------------- types */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  id?: string;
  /** True if RESEND_API_KEY was unset and we short-circuited to logs. */
  logOnly: boolean;
}

/* -------------------------------------------------------- public helper */

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

  if (!apiKey) {
    console.warn("[resend-client] RESEND_API_KEY not set — log-only mode.");
    console.log(`[resend-client:log] to=${input.to} subject=${input.subject}`);
    console.log(`[resend-client:log] body:\n${input.text ?? input.html}`);
    return { logOnly: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(input.text ? { text: input.text } : {}),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend send failed: ${res.status} ${err}`);
  }

  const body = (await res.json()) as { id?: string };
  return { id: body.id, logOnly: false };
}
