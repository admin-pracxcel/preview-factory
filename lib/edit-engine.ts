/**
 * lib/edit-engine.ts
 * Phase L mutation engine.
 *
 * Applies a plain-English edit request to a tenant's current SiteProps,
 * producing a proposed updated SiteProps blob and a one-sentence change summary.
 *
 * Auth: shells out to the local `claude` CLI (Claude Code subscription).
 * No Anthropic API key required.
 *
 * Fixture mode: set USE_FIXTURE=1 to bypass the model entirely and use
 * fixtureEdit() for deterministic, zero-cost testing.
 */

import { getTenant } from "@/lib/tenant-store";
import { sitePropsSchema, type SiteProps } from "@/shared/types/site-props";
import { callClaudeCli } from "@/lib/claude-cli";

/* --------------------------------------------------------------------- types */

export interface EditEngineResult {
  proposedSiteProps: SiteProps;
  changeSummary: string;
}

/* ------------------------------------------------------------------ constants */

const MODEL = "claude-haiku-4-5";

const SYSTEM_PROMPT = `You are a website content editor. You receive:
1. A current SiteProps JSON object representing a business website.
2. A plain-English edit request from the business owner.

Your job is to apply ONLY the requested change to the SiteProps JSON.

Rules:
- Return the COMPLETE updated SiteProps JSON — do not truncate or omit any fields.
- Preserve all existing IDs and slugs exactly.
- Use Australian English throughout.
- contact.hours entries must use { "label": "...", "value": "..." } format.
- FAQ items must have an "id" field (use a short slug if creating new ones).
- Do not add, remove, or rename any top-level keys beyond what the request asks for.
- Do not add prose, markdown, or commentary before the JSON.
- After the closing brace of the JSON, on a new line, write exactly:
  SUMMARY: <one sentence describing what changed>`;

/* ------------------------------------------------------------------- exports */

export async function applyEditRequest(
  tenantId: string,
  editRequest: string
): Promise<EditEngineResult> {
  const tenant = await getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const currentSiteProps = tenant.siteProps;

  // Explicit fixture mode — deterministic, no model call
  if (process.env.USE_FIXTURE === "1") {
    console.warn("[edit-engine] USE_FIXTURE=1 — using fixture edit.");
    return fixtureEdit(currentSiteProps, editRequest);
  }

  const userMessage = buildUserMessage(currentSiteProps, editRequest);

  // Attempt 1
  console.log("[edit-engine] attempt 1 — calling Claude...");
  const raw1 = await callClaude(userMessage);
  const result1 = parseAndValidate(raw1);
  if (result1.ok) {
    console.log("[edit-engine] attempt 1 — PASSED.");
    return result1.data;
  }
  console.warn(`[edit-engine] attempt 1 failed:\n${result1.errors.slice(0, 400)}`);

  // Attempt 2 — inline previous response + errors into a single corrective prompt
  console.log("[edit-engine] attempt 2 — corrective prompt...");
  const retryPrompt = `Your previous response failed schema validation. Fix the issues and return the complete corrected JSON followed by the SUMMARY line.

## Validation errors
${result1.errors}

## Your previous response (first 4000 chars)
${result1.rawText.slice(0, 4000)}

## Original request
${userMessage}

Return the corrected JSON now, then SUMMARY: <one sentence>.`;
  const raw2 = await callClaude(retryPrompt);
  const result2 = parseAndValidate(raw2);
  if (result2.ok) {
    console.log("[edit-engine] attempt 2 — PASSED.");
    return result2.data;
  }

  throw new Error(
    `Edit engine failed after 2 attempts. Last errors:\n${result2.errors}`
  );
}

/* ----------------------------------------------------------------- internals */

function buildUserMessage(site: SiteProps, editRequest: string): string {
  return `Current SiteProps JSON:
${JSON.stringify(site, null, 2)}

Edit request:
${editRequest}

Return the complete updated SiteProps JSON, then on a new line: SUMMARY: <one sentence>.`;
}

async function callClaude(userPrompt: string): Promise<string> {
  return callClaudeCli({ systemPrompt: SYSTEM_PROMPT, userPrompt, model: MODEL });
}

function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
}

function parseAndValidate(
  raw: string
):
  | { ok: true; data: EditEngineResult }
  | { ok: false; errors: string; rawText: string } {
  // Split on the SUMMARY line — it appears after the closing JSON brace
  const summaryIndex = raw.lastIndexOf("\nSUMMARY:");
  let jsonPart: string;
  let summary: string;

  if (summaryIndex !== -1) {
    jsonPart = raw.slice(0, summaryIndex).trim();
    summary = raw.slice(summaryIndex + "\nSUMMARY:".length).trim();
  } else {
    // No SUMMARY line — treat the whole thing as JSON, use a fallback summary
    jsonPart = raw.trim();
    summary = "Change applied.";
  }

  const cleaned = stripFences(jsonPart);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      ok: false,
      errors: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
      rawText: raw,
    };
  }

  const result = sitePropsSchema.safeParse(parsed);
  if (result.success) {
    return {
      ok: true,
      data: {
        proposedSiteProps: result.data,
        changeSummary: summary || "Change applied.",
      },
    };
  }

  const errors = result.error.issues
    .map((e) => `${String(e.path.join("."))}: ${e.message}`)
    .join("\n");
  return { ok: false, errors, rawText: raw };
}

/* -------------------------------------------------------------- fixture edit */

/**
 * Deterministic in-process edit used when ANTHROPIC_API_KEY is absent.
 * Makes a small, predictable mutation so the pipeline can be tested without
 * real API spend. Summary is prefixed with "[FIXTURE]" to make origin obvious.
 */
export function fixtureEdit(
  site: SiteProps,
  editRequest: string
): EditEngineResult {
  // Deep-clone to avoid mutating the original
  const candidate: SiteProps = JSON.parse(JSON.stringify(site)) as SiteProps;
  let summary = "[FIXTURE] No matching pattern — appended to subheadline.";

  // Phone number pattern: 04XX XXX XXX or 04XXXXXXXX (with optional spaces)
  const phoneMatch = editRequest.match(/0[45]\d[\s-]?\d{3}[\s-]?\d{3}/);
  if (phoneMatch) {
    candidate.business.phone = phoneMatch[0].replace(/[\s-]/g, " ");
    summary = `[FIXTURE] Updated business phone to ${candidate.business.phone}.`;
  } else if (/hours?|trading/i.test(editRequest)) {
    candidate.home.hero.headline =
      candidate.home.hero.headline + " (Hours updated)";
    summary = "[FIXTURE] Appended hours update note to home hero headline.";
  } else {
    const snippet = editRequest.slice(0, 40);
    candidate.home.hero.subheadline =
      (candidate.home.hero.subheadline ?? "") + " " + snippet;
    summary = `[FIXTURE] Appended first 40 chars of request to home hero subheadline.`;
  }

  // Validate — fall back to original on schema breakage
  const check = sitePropsSchema.safeParse(candidate);
  if (check.success) {
    return { proposedSiteProps: check.data, changeSummary: summary };
  }

  console.warn(
    "[edit-engine] fixtureEdit produced invalid SiteProps — returning original."
  );
  return {
    proposedSiteProps: site,
    changeSummary: "[FIXTURE] Validation failed — original site props returned unchanged.",
  };
}
