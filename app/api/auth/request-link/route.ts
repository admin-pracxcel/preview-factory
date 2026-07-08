/**
 * app/api/auth/request-link/route.ts
 * POST /api/auth/request-link  { email }
 *
 * Emails a magic-link to owners who have a claimed tenant under this address.
 * Always returns 200 to avoid leaking whether an email is registered — the
 * caller can't distinguish "no such user" from "sent" from "you already asked
 * within the last minute".
 */

import { NextRequest, NextResponse } from "next/server";
import { issueMagicToken } from "@/lib/magic-tokens";
import { sendEmail } from "@/lib/resend-client";
import { supabase } from "@/lib/supabase";
import { applyRateLimit, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

function baseUrl(request: NextRequest): string {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL;
  if (envBase) return envBase.replace(/\/$/, "");
  return new URL(request.url).origin;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown };
  try {
    body = (await request.json()) as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!raw || !/^\S+@\S+\.\S+$/.test(raw)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  // Two-layer rate limit: per-IP guards against a single attacker spraying
  // many emails; per-email guards against an attacker rotating IPs to spam
  // one victim's inbox. Both must pass.
  const ipLimit = await applyRateLimit({
    key: `auth:request-link:ip:${clientIp(request)}`,
    limit: 5,
    windowSeconds: 60,
  });
  if (ipLimit) return ipLimit;
  const emailLimit = await applyRateLimit({
    key: `auth:request-link:email:${raw}`,
    limit: 3,
    windowSeconds: 60,
  });
  if (emailLimit) return emailLimit;

  // Look up whether any claimed tenant matches. If nothing matches, we quietly
  // no-op — same response shape as the happy path, so the caller can't probe.
  const { data: match, error: lookupError } = await supabase()
    .from("tenants")
    .select("id")
    .eq("owner_email", raw)
    .not("claimed_at", "is", null)
    .limit(1)
    .maybeSingle();
  if (lookupError) {
    console.error("[auth:request-link] tenant lookup failed:", lookupError);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }

  if (!match) {
    // No such owner. Behave as if we sent something.
    return NextResponse.json({ ok: true });
  }

  let issued;
  try {
    issued = await issueMagicToken(raw);
  } catch (err) {
    console.error("[auth:request-link] issue failed:", err);
    return NextResponse.json({ error: "Something went wrong. Try again." }, { status: 500 });
  }
  if (!issued) {
    // Cooldown hit — we already sent a fresh link in the last minute. Silent
    // success so the user doesn't retry-spam.
    return NextResponse.json({ ok: true });
  }

  const link = `${baseUrl(request)}/api/auth/verify?token=${encodeURIComponent(issued.rawToken)}`;
  try {
    await sendEmail({
      to: raw,
      subject: "Your Launcharoo sign-in link",
      html: `<p>Click the link below to sign in to your Launcharoo dashboard. It expires in 15 minutes.</p>
             <p><a href="${link}">Sign in to Launcharoo</a></p>
             <p style="color:#666;font-size:12px">If you didn't ask for this, ignore this email. Your account is safe.</p>`,
      text: `Sign in to Launcharoo:\n${link}\n\nExpires in 15 minutes. If you didn't ask for this, ignore this email.`,
    });
  } catch (err) {
    console.error("[auth:request-link] send failed:", err);
    return NextResponse.json({ error: "Email send failed. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
