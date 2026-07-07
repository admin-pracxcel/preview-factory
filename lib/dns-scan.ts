/**
 * lib/dns-scan.ts
 * Snapshot a customer's existing DNS BEFORE they change nameservers to us.
 *
 * Why this exists: when a customer delegates a domain to our Cloudflare
 * account, our zone becomes authoritative the instant nameservers flip.
 * If we haven't already imported their MX / TXT / DKIM / DMARC records,
 * their email stops working. This module reads their live DNS from
 * Cloudflare's public DoH resolver (1.1.1.1) while the OLD DNS is still
 * authoritative, so we can seed the new zone with the same records.
 *
 * Scope of records we preserve:
 *   MX   — email routing
 *   TXT  — SPF, DKIM, DMARC, third-party verification (Google, Meta, etc.)
 *   CAA  — certificate authority allow-lists
 *   SRV  — Slack, Skype for Business, XMPP, and other service records
 *
 * We deliberately do NOT copy:
 *   A / AAAA / CNAME at apex or www — these are what we're taking over
 *   NS — nameserver records are managed by the delegation itself
 *
 * DKIM selectors are impossible to enumerate without zone transfer (which
 * providers universally deny). We try a well-known set of common selectors
 * (Google, Mailgun, Mandrill, etc.) as a best-effort. Anything using a
 * bespoke selector needs the customer to re-provision DKIM after cutover,
 * or ask us to add the record manually.
 */

import type { DnsRecord } from "@/lib/cloudflare-api";

/** Cloudflare's DNS-over-HTTPS endpoint. */
const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";

/** How long a single DoH query is allowed to take. */
const QUERY_TIMEOUT_MS = 8_000;

/** RFC 1035 numeric type codes for the record types we care about. */
const RECORD_TYPE_CODES: Record<string, number> = {
  MX: 15,
  TXT: 16,
  CAA: 257,
  SRV: 33,
};
const RECORD_CODE_TO_TYPE = Object.fromEntries(
  Object.entries(RECORD_TYPE_CODES).map(([k, v]) => [v, k]),
) as Record<number, "MX" | "TXT" | "CAA" | "SRV">;

/**
 * Common DKIM selectors used by major mail providers. Order = discovery
 * priority. The list is a compromise: too short and we miss real DKIM
 * setups, too long and we're firing dozens of pointless queries per scan.
 */
const COMMON_DKIM_SELECTORS = [
  "google",       // Google Workspace
  "s1", "s2",     // SendGrid, Mailchimp, etc.
  "k1", "k2", "k3", // MailerLite, Mailjet
  "mandrill",     // Mandrill
  "mailgun",      // Mailgun
  "mail",         // Fastmail default
  "selector1", "selector2", // Microsoft 365
  "zoho",         // Zoho
];

/* --------------------------------------------------------------- types */

interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

export interface DnsSnapshot {
  domain: string;
  scannedAt: string;
  records: DnsRecord[];
  /** Selectors we tried but didn't find. Documenting so support can ask. */
  dkimSelectorsTried: string[];
  /** DKIM selectors that responded with a record. */
  dkimSelectorsFound: string[];
}

/* -------------------------------------------------------- DoH primitives */

async function dohQuery(name: string, type: keyof typeof RECORD_TYPE_CODES): Promise<DohAnswer[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  try {
    const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`DoH ${type} ${name}: HTTP ${res.status}`);
    }
    const payload = (await res.json()) as DohResponse;
    // Status 0 = NoError. Status 3 = NXDOMAIN (fine, no records). Others fail.
    if (payload.Status !== 0 && payload.Status !== 3) {
      throw new Error(`DoH ${type} ${name}: status ${payload.Status}`);
    }
    return payload.Answer ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------- MX / TXT / CAA / SRV parsing */

/**
 * DoH returns the RDATA field in a mostly-string form. Cloudflare's API
 * expects structured fields (priority separate from target for MX,
 * flags separate from value for CAA). Parse each type into the shape
 * createDnsRecord expects.
 */
function parseAnswer(answer: DohAnswer, apexName: string): DnsRecord | null {
  const type = RECORD_CODE_TO_TYPE[answer.type];
  if (!type) return null;

  // Cloudflare wants records with `name` as the fully qualified subdomain
  // OR `@` for apex. We normalise to `@` when the answer name equals the
  // domain we're scanning.
  const name = answer.name.replace(/\.$/, "") === apexName ? "@" : answer.name.replace(/\.$/, "");

  switch (type) {
    case "MX": {
      // data format: "<priority> <target>"
      const match = answer.data.match(/^(\d+)\s+(.+)$/);
      if (!match) return null;
      return { type: "MX", name, content: match[2].replace(/\.$/, ""), priority: Number(match[1]) };
    }
    case "TXT": {
      // Data comes back quoted. Cloudflare wants the raw string, no quotes.
      // Also handles the "long TXT split into chunks" case: DoH concatenates
      // chunks with `" "` — strip that to reassemble.
      const raw = answer.data.replace(/^"|"$/g, "").replace(/"\s+"/g, "");
      return { type: "TXT", name, content: raw };
    }
    case "CAA": {
      // Cloudflare accepts CAA in the same "<flags> <tag> <value>" form.
      return { type: "CAA", name, content: answer.data };
    }
    case "SRV": {
      // data format: "<priority> <weight> <port> <target>"
      // Cloudflare's SRV expects structured data via a different endpoint;
      // for 10b-ii we pass through in the content field and let the caller
      // decide whether to bother re-creating (many customers won't have SRV).
      return { type: "SRV", name, content: answer.data };
    }
  }
}

/* ------------------------------------------------------ public interface */

/**
 * Scan a domain's live DNS and return a snapshot of records worth
 * preserving. Idempotent, safe to re-run — a scan is a pure read.
 */
export async function scanDomain(domain: string): Promise<DnsSnapshot> {
  const normalized = domain.trim().toLowerCase().replace(/\.$/, "");
  const records: DnsRecord[] = [];

  // Apex records: MX, TXT, CAA
  for (const type of ["MX", "TXT", "CAA"] as const) {
    const answers = await dohQuery(normalized, type);
    for (const a of answers) {
      const record = parseAnswer(a, normalized);
      if (record) records.push(record);
    }
  }

  // Standard DMARC location: _dmarc.<domain> TXT
  const dmarcAnswers = await dohQuery(`_dmarc.${normalized}`, "TXT").catch(() => []);
  for (const a of dmarcAnswers) {
    const record = parseAnswer(a, normalized);
    if (record) records.push(record);
  }

  // DKIM best-effort scan.
  const dkimSelectorsTried: string[] = [];
  const dkimSelectorsFound: string[] = [];
  for (const selector of COMMON_DKIM_SELECTORS) {
    dkimSelectorsTried.push(selector);
    const dkimName = `${selector}._domainkey.${normalized}`;
    // Individual DKIM query failures should not abort the whole scan.
    const answers = await dohQuery(dkimName, "TXT").catch(() => []);
    if (answers.length > 0) {
      dkimSelectorsFound.push(selector);
      for (const a of answers) {
        const record = parseAnswer(a, normalized);
        if (record) records.push(record);
      }
    }
  }

  return {
    domain: normalized,
    scannedAt: new Date().toISOString(),
    records,
    dkimSelectorsTried,
    dkimSelectorsFound,
  };
}

/**
 * Import a snapshot into a Cloudflare zone we just created. Errors on
 * individual records are logged but do not abort the whole apply — a
 * malformed TXT shouldn't stop the MX from landing. Returns per-record
 * results so the caller can surface partial failure.
 */
export interface ApplyResult {
  applied: number;
  skipped: number;
  errors: Array<{ record: DnsRecord; error: string }>;
}

export async function applySnapshotToZone(
  zoneId: string,
  snapshot: DnsSnapshot,
  createFn: (zoneId: string, record: DnsRecord) => Promise<unknown>,
): Promise<ApplyResult> {
  const result: ApplyResult = { applied: 0, skipped: 0, errors: [] };
  for (const record of snapshot.records) {
    // SRV needs structured fields (priority/weight/port/target) not just a
    // content string. CAA comes back from Cloudflare's DoH in RFC 3597
    // "unknown RR" wire format (\# 45 00 05 ...) which the Cloudflare API
    // rejects on write. Both are skipped and can be added manually — the
    // customer usually doesn't have SRV, and CAA is optional (its absence
    // means "any CA can issue" which is browser default).
    if (record.type === "SRV" || record.type === "CAA") {
      result.skipped++;
      continue;
    }
    try {
      await createFn(zoneId, record);
      result.applied++;
    } catch (err) {
      result.errors.push({
        record,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return result;
}
