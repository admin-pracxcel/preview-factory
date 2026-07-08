/**
 * GET /api/dashboard/[tenantId]/export/leads.csv
 *
 * Owner-facing CSV of every captured lead for this tenant. Imports
 * directly into Excel / Google Sheets / HubSpot without conversion.
 *
 * Session-gated. Same auth rules as the JSON export.
 *
 * Columns: created_at, source, name, phone, email, message, page
 * (kept in the order that reads best in a spreadsheet)
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertOwnsTenant, type MutableCookies } from "@/lib/session";
import { getTenant } from "@/lib/tenant-store";
import { listLeads, type LeadRecord } from "@/lib/leads-store";

export const runtime = "nodejs";

/**
 * Escape a single value for CSV: wrap in quotes if it contains comma,
 * newline, or a quote; double up embedded quotes. Empty / undefined
 * becomes an empty cell.
 */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(leads: LeadRecord[]): string {
  const header = ["created_at", "source", "name", "phone", "email", "message", "page"];
  const rows = leads.map((l) =>
    [l.createdAt, l.source, l.name, l.phone, l.email, l.message, l.page]
      .map(csvEscape)
      .join(","),
  );
  // BOM prefix so Excel opens UTF-8 correctly on Windows.
  return "﻿" + [header.join(","), ...rows].join("\n") + "\n";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;

  try {
    const store = (await cookies()) as unknown as MutableCookies;
    await assertOwnsTenant(store, tenantId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unauthorized" },
      { status: 403 },
    );
  }

  const tenant = await getTenant(tenantId);
  if (!tenant) {
    return NextResponse.json({ error: "tenant not found" }, { status: 404 });
  }

  const leads = await listLeads(tenantId);
  const csv = toCsv(leads);

  const safeName = tenant.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const filename = `launcharoo-${safeName}-leads.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
