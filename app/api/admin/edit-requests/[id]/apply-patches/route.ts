/**
 * app/api/admin/edit-requests/[id]/apply-patches/route.ts
 * POST /api/admin/edit-requests/:id/apply-patches
 *
 * The n8n workflow calls this after claude has produced a set of siteProps
 * patches. We are the last line of defence:
 *   1. Verify the HMAC signature (X-Launcharoo-Signature). Rejects
 *      anything that doesn't match EDIT_WORKFLOW_HMAC_SECRET.
 *   2. Enforce the path allowlist. Claude cannot expand its own reach —
 *      even if the model outputs a patch to services.0.slug or
 *      overrides.hero_image_url we refuse.
 *   3. Apply patches to a deep-clone of siteProps and run the full
 *      sitePropsSchema.safeParse. If the mutation produces an invalid
 *      site (wrong type, empty required field), we don't save.
 *   4. On success: persist tenant, mark edit_request applied, email owner
 *      with a friendly "your changes are live" note.
 *   5. On failure: mark edit_request failed with a diagnostic, email
 *      admin so someone can pick it up manually.
 *
 * Body: {
 *   patches: Array<{ path: string, value: unknown }>,
 *   summary?: string,        // Human-friendly summary from claude
 *   outOfScope?: string[],   // Things claude declined — surfaced to admin
 * }
 * Returns: { ok: true, applied: number } on success, 4xx/5xx with
 *          { error } otherwise.
 */

import { NextRequest, NextResponse } from "next/server";
import { getEditRequest, saveEditRequest } from "@/lib/edit-requests-store";
import { getTenant, saveTenant } from "@/lib/tenant-store";
import { verifyInboundSignature } from "@/lib/n8n-edit-webhook";
import { isEditablePath } from "@/lib/edit-request-allowlist";
import { sendEmail } from "@/lib/resend-client";
import { sitePropsSchema } from "@/shared/types/site-props";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ADMIN_INBOX =
  process.env.EDIT_REQUEST_INBOX ?? "hello@launcharoo.online";

interface Patch {
  path: string;
  value: unknown;
}

interface Body {
  patches?: unknown;
  summary?: unknown;
  outOfScope?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Read the raw body FIRST — HMAC is computed over the exact bytes, so
  // we can't call .json() and later re-stringify.
  const rawBody = await request.text();
  const sig = request.headers.get("x-launcharoo-signature");
  const verify = verifyInboundSignature(sig, rawBody);
  if (!verify.ok) {
    console.warn(
      `[apply-patches] rejected editRequest ${id}: ${verify.reason ?? "unknown"}`,
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = JSON.parse(rawBody) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patches = validatePatchesShape(body.patches);
  if ("error" in patches) {
    return NextResponse.json({ error: patches.error }, { status: 400 });
  }
  const summary =
    typeof body.summary === "string" && body.summary.trim()
      ? body.summary.trim().slice(0, 500)
      : undefined;
  const outOfScope =
    Array.isArray(body.outOfScope)
      ? body.outOfScope.filter((s): s is string => typeof s === "string")
      : [];

  const editReq = await getEditRequest(id);
  if (!editReq) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (editReq.status !== "approved" && editReq.status !== "processing") {
    return NextResponse.json(
      { error: `Cannot apply from status ${editReq.status}` },
      { status: 409 },
    );
  }

  const tenant = await getTenant(editReq.tenantId);
  if (!tenant) {
    await markFailed(editReq.id, "tenant no longer exists");
    return NextResponse.json({ error: "Tenant missing" }, { status: 404 });
  }
  if (!tenant.siteProps) {
    await markFailed(
      editReq.id,
      "tenant has no siteProps yet — generator hasn't finished",
    );
    return NextResponse.json(
      { error: "Tenant not ready" },
      { status: 409 },
    );
  }

  // ---- 1. Path allowlist -------------------------------------------------
  const denied = patches.value.filter((p) => !isEditablePath(p.path));
  if (denied.length > 0) {
    const reason = `${denied.length} patch${denied.length === 1 ? "" : "es"} outside allowlist: ${denied
      .map((p) => p.path)
      .slice(0, 5)
      .join(", ")}`;
    await markFailed(editReq.id, reason);
    await notifyAdminOfFailure({
      editRequestId: editReq.id,
      tenantName: tenant.name,
      reason,
      outOfScope,
    });
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  // ---- 2. Apply patches to a deep-clone ---------------------------------
  let mutated: Record<string, unknown>;
  try {
    mutated = structuredClone(tenant.siteProps) as Record<string, unknown>;
    for (const patch of patches.value) {
      setAtPath(mutated, patch.path, patch.value);
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await markFailed(editReq.id, `patch application error: ${reason}`);
    await notifyAdminOfFailure({
      editRequestId: editReq.id,
      tenantName: tenant.name,
      reason,
      outOfScope,
    });
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  // ---- 3. Zod-validate the mutated shape --------------------------------
  const parsed = sitePropsSchema.safeParse(mutated);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .slice(0, 5)
      .join(" | ");
    const reason = `schema validation failed: ${issues}`;
    await markFailed(editReq.id, reason);
    await notifyAdminOfFailure({
      editRequestId: editReq.id,
      tenantName: tenant.name,
      reason,
      outOfScope,
    });
    return NextResponse.json({ error: reason }, { status: 400 });
  }

  // ---- 4. Persist + mark applied ----------------------------------------
  const now = new Date().toISOString();
  await saveTenant({ ...tenant, siteProps: parsed.data });
  await saveEditRequest({
    ...editReq,
    status: "applied",
    appliedAt: now,
    resolvedAt: now,
    changeSummary: summary,
  });

  console.log(
    `[apply-patches] applied editRequest ${id} → tenant ${tenant.id} (${patches.value.length} patches)`,
  );

  // ---- 5. Notify owner (best-effort) ------------------------------------
  if (tenant.ownerEmail) {
    try {
      await sendEmail({
        to: tenant.ownerEmail,
        subject: `Your changes to ${tenant.name} are live`,
        html: renderOwnerAppliedHtml({
          businessName: tenant.name,
          summary,
          request: editReq.request,
        }),
        text: renderOwnerAppliedText({
          businessName: tenant.name,
          summary,
          request: editReq.request,
        }),
      });
    } catch (err) {
      console.error(`[apply-patches] owner email failed for ${id}:`, err);
    }
  }

  // ---- 6. Surface out-of-scope items to admin (best-effort) -------------
  if (outOfScope.length > 0) {
    try {
      await sendEmail({
        to: ADMIN_INBOX,
        subject: `Partial edit applied — ${tenant.name}`,
        html: renderAdminPartialHtml({
          editRequestId: id,
          tenantName: tenant.name,
          outOfScope,
          summary,
        }),
        text: renderAdminPartialText({
          editRequestId: id,
          tenantName: tenant.name,
          outOfScope,
          summary,
        }),
      });
    } catch (err) {
      console.error(`[apply-patches] admin partial email failed:`, err);
    }
  }

  return NextResponse.json({ ok: true, applied: patches.value.length });
}

/* ------------------------------------------------------------ validation */

type PatchesOk = { value: Patch[] };
type PatchesErr = { error: string };

function validatePatchesShape(input: unknown): PatchesOk | PatchesErr {
  if (!Array.isArray(input)) {
    return { error: "`patches` must be an array" };
  }
  if (input.length === 0) {
    return { error: "`patches` must contain at least one entry" };
  }
  if (input.length > 100) {
    return { error: "`patches` cannot exceed 100 entries" };
  }
  const out: Patch[] = [];
  for (const [i, raw] of input.entries()) {
    if (raw === null || typeof raw !== "object") {
      return { error: `patches[${i}] must be an object` };
    }
    const obj = raw as Record<string, unknown>;
    if (typeof obj.path !== "string" || obj.path.length === 0) {
      return { error: `patches[${i}].path must be a non-empty string` };
    }
    if (obj.path.length > 200) {
      return { error: `patches[${i}].path is too long` };
    }
    if (!("value" in obj)) {
      return { error: `patches[${i}] must include a value key` };
    }
    out.push({ path: obj.path, value: obj.value });
  }
  return { value: out };
}

/* ------------------------------------------------------------ path setter */

/**
 * Walk `obj` down `path` (dotted, with numeric segments = array indices)
 * and set the value at the leaf. Throws Error if the containing shape
 * doesn't exist — we never auto-create intermediate objects or arrays
 * because the intent is always "edit an existing field".
 */
function setAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const segments = path.split(".");
  const leaf = segments.pop();
  if (!leaf) throw new Error(`empty path`);

  let cursor: unknown = obj;
  for (const seg of segments) {
    if (Array.isArray(cursor)) {
      const idx = /^\d+$/.test(seg) ? Number(seg) : NaN;
      if (Number.isNaN(idx) || idx < 0 || idx >= cursor.length) {
        throw new Error(`path ${path}: index ${seg} out of range`);
      }
      cursor = cursor[idx];
    } else if (cursor !== null && typeof cursor === "object") {
      const record = cursor as Record<string, unknown>;
      if (!(seg in record)) {
        throw new Error(`path ${path}: no key "${seg}"`);
      }
      cursor = record[seg];
    } else {
      throw new Error(`path ${path}: cannot descend into non-object`);
    }
  }

  if (Array.isArray(cursor)) {
    const idx = /^\d+$/.test(leaf) ? Number(leaf) : NaN;
    if (Number.isNaN(idx) || idx < 0 || idx >= cursor.length) {
      throw new Error(`path ${path}: index ${leaf} out of range`);
    }
    cursor[idx] = value;
  } else if (cursor !== null && typeof cursor === "object") {
    (cursor as Record<string, unknown>)[leaf] = value;
  } else {
    throw new Error(`path ${path}: cannot set leaf on non-object`);
  }
}

/* -------------------------------------------------------- failure helper */

async function markFailed(id: string, reason: string): Promise<void> {
  try {
    const editReq = await getEditRequest(id);
    if (!editReq) return;
    const now = new Date().toISOString();
    await saveEditRequest({
      ...editReq,
      status: "failed",
      resolvedAt: now,
      error: reason.slice(0, 2000),
    });
  } catch (err) {
    console.error(`[apply-patches] markFailed(${id}) crashed:`, err);
  }
}

interface AdminFailureInput {
  editRequestId: string;
  tenantName: string;
  reason: string;
  outOfScope: string[];
}

async function notifyAdminOfFailure(
  input: AdminFailureInput,
): Promise<void> {
  try {
    await sendEmail({
      to: ADMIN_INBOX,
      subject: `Edit workflow failed — ${input.tenantName}`,
      html: renderAdminFailureHtml(input),
      text: renderAdminFailureText(input),
    });
  } catch (err) {
    console.error("[apply-patches] admin failure email failed:", err);
  }
}

/* -------------------------------------------------------------- emails */

interface OwnerAppliedContent {
  businessName: string;
  summary?: string;
  request: string;
}

function renderOwnerAppliedHtml(c: OwnerAppliedContent): string {
  return `<!doctype html>
<html lang="en">
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0A0F1E;color:#fff;padding:32px;">
    <div style="max-width:560px;margin:0 auto;background:#111827;padding:32px;border-radius:16px;">
      <h1 style="font-size:22px;margin:0 0 12px;">Your changes are live</h1>
      <p style="color:rgba(255,255,255,0.75);line-height:1.55;margin:0 0 20px;">
        We&rsquo;ve applied your recent change to <strong>${escapeHtml(c.businessName)}</strong>.
      </p>
      ${
        c.summary
          ? `<div style="border-left:3px solid #22c55e;padding:12px 16px;background:rgba(34,197,94,0.08);margin:0 0 20px;color:#fff;line-height:1.5;">
              ${escapeHtml(c.summary)}
            </div>`
          : ""
      }
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.55;margin:0 0 6px;">
        Your original request, for reference:
      </p>
      <p style="color:rgba(255,255,255,0.75);font-size:14px;line-height:1.5;margin:0 0 24px;white-space:pre-line;">
        ${escapeHtml(c.request)}
      </p>
      <p style="color:rgba(255,255,255,0.5);font-size:14px;line-height:1.5;margin:0;">
        If anything doesn&rsquo;t look right, reply to this email and we&rsquo;ll sort it.
      </p>
    </div>
    <p style="text-align:center;color:rgba(255,255,255,0.3);font-size:12px;margin-top:16px;">launcharoo.online</p>
  </body>
</html>`;
}

function renderOwnerAppliedText(c: OwnerAppliedContent): string {
  return `Your changes are live

We've applied your recent change to ${c.businessName}.
${c.summary ? `\n${c.summary}\n` : ""}
Your original request:
${c.request}

If anything doesn't look right, reply to this email and we'll sort it.

— Launcharoo`;
}

function renderAdminFailureHtml(c: AdminFailureInput): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px">
    <h2 style="margin:0 0 12px">Edit workflow failed</h2>
    <p style="margin:0 0 8px"><strong>Tenant:</strong> ${escapeHtml(c.tenantName)}</p>
    <p style="margin:0 0 8px"><strong>Edit request:</strong> ${escapeHtml(c.editRequestId)}</p>
    <p style="margin:16px 0 8px"><strong>Reason:</strong></p>
    <blockquote style="margin:0;padding:12px 16px;border-left:3px solid #ef4444;background:#fef2f2;white-space:pre-wrap;color:#7f1d1d">${escapeHtml(c.reason)}</blockquote>
    ${
      c.outOfScope.length > 0
        ? `<p style="margin:16px 0 4px"><strong>Out of scope (from claude):</strong></p>
           <ul style="margin:0;padding-left:20px">${c.outOfScope
             .map((s) => `<li>${escapeHtml(s)}</li>`)
             .join("")}</ul>`
        : ""
    }
    <p style="margin:24px 0 0"><a href="https://launcharoo.online/admin/edit-requests/${escapeAttr(c.editRequestId)}">Open the request</a></p>
  </div>`;
}

function renderAdminFailureText(c: AdminFailureInput): string {
  return `Edit workflow failed

Tenant: ${c.tenantName}
Edit request: ${c.editRequestId}

Reason:
${c.reason}
${
  c.outOfScope.length > 0
    ? `\nOut of scope:\n${c.outOfScope.map((s) => `- ${s}`).join("\n")}\n`
    : ""
}
Open the request: https://launcharoo.online/admin/edit-requests/${c.editRequestId}
`;
}

interface AdminPartialInput {
  editRequestId: string;
  tenantName: string;
  outOfScope: string[];
  summary?: string;
}

function renderAdminPartialHtml(c: AdminPartialInput): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:640px">
    <h2 style="margin:0 0 12px">Partial edit applied</h2>
    <p style="margin:0 0 8px">Some of the request couldn&rsquo;t be handled safely — the rest was applied.</p>
    <p style="margin:0 0 8px"><strong>Tenant:</strong> ${escapeHtml(c.tenantName)}</p>
    ${c.summary ? `<p style="margin:0 0 8px"><strong>Summary:</strong> ${escapeHtml(c.summary)}</p>` : ""}
    <p style="margin:16px 0 4px"><strong>Not applied:</strong></p>
    <ul style="margin:0;padding-left:20px">${c.outOfScope
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join("")}</ul>
    <p style="margin:24px 0 0"><a href="https://launcharoo.online/admin/edit-requests/${escapeAttr(c.editRequestId)}">Open the request</a></p>
  </div>`;
}

function renderAdminPartialText(c: AdminPartialInput): string {
  return `Partial edit applied

Tenant: ${c.tenantName}
${c.summary ? `Summary: ${c.summary}\n` : ""}
Not applied:
${c.outOfScope.map((s) => `- ${s}`).join("\n")}

Open the request: https://launcharoo.online/admin/edit-requests/${c.editRequestId}
`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
