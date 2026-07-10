/**
 * app/api/tenants/[tenantId]/contact/route.ts
 * PATCH — update phone / email / address on a claimed tenant.
 *
 * These fields are the highest-frequency, most time-sensitive edits an owner
 * makes (new mobile, moved office). Routing them through the concierge queue
 * meant a 2-hour delay during which the tradie could miss real calls, so this
 * endpoint gives owners an instant self-serve path — no AI, no queue.
 *
 * Body: { phone?, email?, address? } — undefined leaves the field alone,
 *       empty string clears it (renders to a blank contact block).
 * Returns: the persisted values so the caller can hydrate without re-fetching.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { applyRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

interface ContactPatchBody {
  phone?: string;
  email?: string;
  address?: string;
}

/**
 * GET — read the current phone / email / address for the tenant.
 * Used by the preview editor's Business Details section to hydrate its
 * initial form values. Not gated on ownership: the same values render on
 * the public site, so a read here is no more sensitive than a page view.
 * Writes (PATCH) remain owner-gated.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const site = (tenant.siteProps as Record<string, unknown> | undefined) ?? {};
  const business = (site.business as Record<string, unknown> | undefined) ?? {};
  const home = (site.home as Record<string, unknown> | undefined) ?? {};
  const contact = (home.contact as Record<string, unknown> | undefined) ?? {};

  const phone =
    (typeof contact.phone === "string" && contact.phone) ||
    (typeof business.phone === "string" && business.phone) ||
    "";
  const email =
    (typeof contact.email === "string" && contact.email) ||
    (typeof business.email === "string" && business.email) ||
    "";
  const address =
    (typeof contact.address === "string" && contact.address) || "";

  return NextResponse.json(
    { phone, email, address },
    { headers: { "cache-control": "no-store" } },
  );
}

// Loose format checks. Strict RFC parsing is a rathole and Zod's .email() has
// rejected valid AU addresses in the past — we just make sure it *looks like*
// an email and only reject the obviously wrong. Empty string is allowed and
// means "clear this field".
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  const cookieStore = (await cookies()) as unknown as MutableCookies;
  try {
    await assertOwnsTenant(cookieStore, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not allowed" },
      { status: 403 },
    );
  }

  const limited = await applyRateLimit({
    key: `contact-edit:tenant:${tenantId}`,
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  let body: ContactPatchBody;
  try {
    body = (await request.json()) as ContactPatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (!tenant.siteProps) {
    return NextResponse.json(
      { error: "Site is still generating — try again in a minute." },
      { status: 409 },
    );
  }

  const nextPhone = body.phone !== undefined ? body.phone.trim() : undefined;
  const nextEmail =
    body.email !== undefined ? body.email.trim().toLowerCase() : undefined;
  const nextAddress =
    body.address !== undefined ? body.address.trim() : undefined;

  if (nextEmail && nextEmail.length > 0 && !EMAIL_RE.test(nextEmail)) {
    return NextResponse.json(
      { error: "That email doesn't look right — check for typos." },
      { status: 400 },
    );
  }
  if (nextPhone && nextPhone.length > 40) {
    return NextResponse.json({ error: "Phone number is too long." }, { status: 400 });
  }
  if (nextAddress && nextAddress.length > 200) {
    return NextResponse.json({ error: "Address is too long." }, { status: 400 });
  }

  const site = tenant.siteProps as Record<string, unknown>;
  const business = { ...((site.business as Record<string, unknown>) ?? {}) };
  const home = { ...((site.home as Record<string, unknown>) ?? {}) };
  const contact = { ...((home.contact as Record<string, unknown>) ?? {}) };

  // Phone + email are duplicated into both `business` (the canonical record)
  // and `home.contact` (the display copy) — templates prefer the contact
  // value and fall back to business. Writing both keeps them in lockstep so
  // the fallback path never surfaces a stale number.
  if (nextPhone !== undefined) {
    if (nextPhone === "") {
      delete business.phone;
      delete contact.phone;
    } else {
      business.phone = nextPhone;
      contact.phone = nextPhone;
    }
  }
  if (nextEmail !== undefined) {
    if (nextEmail === "") {
      delete business.email;
      delete contact.email;
    } else {
      business.email = nextEmail;
      contact.email = nextEmail;
    }
  }
  if (nextAddress !== undefined) {
    if (nextAddress === "") {
      delete contact.address;
    } else {
      contact.address = nextAddress;
    }
  }

  home.contact = contact;

  await saveTenant({
    ...tenant,
    siteProps: {
      ...tenant.siteProps,
      business: business as (typeof tenant.siteProps)["business"],
      home: home as (typeof tenant.siteProps)["home"],
    },
  });

  return NextResponse.json({
    phone: typeof business.phone === "string" ? business.phone : "",
    email: typeof business.email === "string" ? business.email : "",
    address: typeof contact.address === "string" ? contact.address : "",
  });
}
