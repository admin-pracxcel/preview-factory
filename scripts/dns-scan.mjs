#!/usr/bin/env node
/**
 * scripts/dns-scan.mjs
 * Smoke-test the DNS scanner against a real domain, no persistence.
 *
 * Usage:
 *   node scripts/dns-scan.mjs example.com
 *   node scripts/dns-scan.mjs example.com --json    # print raw snapshot
 *
 * Good sanity check before Phase 10b-iii wires this into the dashboard.
 * Prints the records we'd copy into a new Cloudflare zone.
 */

const DOH_ENDPOINT = "https://cloudflare-dns.com/dns-query";
const QUERY_TIMEOUT_MS = 8_000;
const RECORD_TYPE_CODES = { MX: 15, TXT: 16, CAA: 257, SRV: 33 };
const COMMON_DKIM_SELECTORS = [
  "google", "s1", "s2", "k1", "k2", "k3", "mandrill", "mailgun",
  "mail", "selector1", "selector2", "zoho",
];

async function dohQuery(name, type) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUERY_TIMEOUT_MS);
  try {
    const url = `${DOH_ENDPOINT}?name=${encodeURIComponent(name)}&type=${type}`;
    const res = await fetch(url, {
      headers: { accept: "application/dns-json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    if (payload.Status !== 0 && payload.Status !== 3) {
      throw new Error(`status ${payload.Status}`);
    }
    return payload.Answer ?? [];
  } finally {
    clearTimeout(timer);
  }
}

const domain = process.argv[2];
if (!domain) {
  console.error("usage: node scripts/dns-scan.mjs <domain> [--json]");
  process.exit(1);
}
const jsonMode = process.argv.includes("--json");
const normalized = domain.trim().toLowerCase().replace(/\.$/, "");

const snapshot = { domain: normalized, records: [], dkimSelectorsFound: [] };

for (const type of ["MX", "TXT", "CAA"]) {
  const answers = await dohQuery(normalized, type);
  for (const a of answers) snapshot.records.push({ type, name: "@", data: a.data });
}

const dmarc = await dohQuery(`_dmarc.${normalized}`, "TXT").catch(() => []);
for (const a of dmarc) snapshot.records.push({ type: "TXT", name: "_dmarc", data: a.data });

for (const sel of COMMON_DKIM_SELECTORS) {
  const answers = await dohQuery(`${sel}._domainkey.${normalized}`, "TXT").catch(() => []);
  if (answers.length > 0) {
    snapshot.dkimSelectorsFound.push(sel);
    for (const a of answers) {
      snapshot.records.push({ type: "TXT", name: `${sel}._domainkey`, data: a.data });
    }
  }
}

if (jsonMode) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(0);
}

console.log(`\n=== DNS snapshot for ${snapshot.domain} ===\n`);
if (snapshot.records.length === 0) {
  console.log("(no MX, TXT, CAA, or DKIM records found)");
} else {
  for (const r of snapshot.records) {
    const label = `${r.type.padEnd(4)} ${r.name.padEnd(30)}`;
    console.log(`  ${label} ${r.data}`);
  }
}
console.log(`\nDKIM selectors tried: ${COMMON_DKIM_SELECTORS.length}`);
console.log(`DKIM selectors found: ${snapshot.dkimSelectorsFound.length > 0 ? snapshot.dkimSelectorsFound.join(", ") : "(none)"}`);
console.log(`Total records to preserve: ${snapshot.records.length}\n`);
