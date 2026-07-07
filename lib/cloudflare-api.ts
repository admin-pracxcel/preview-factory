/**
 * lib/cloudflare-api.ts
 * Cloudflare API v4 wrapper — pure fetch, no npm package.
 *
 * Scope: everything Phase 10b (BYO customer domains) needs. Zone create,
 * zone status polling, DNS record CRUD, Worker route binding. Nothing
 * more — this is a small surface deliberately.
 *
 * Auth: bearer token from CLOUDFLARE_API_TOKEN. The token must have:
 *   Zone.Zone:Edit          — to create zones and read their status
 *   Zone.DNS:Edit           — to write records into new zones
 *   Account.Workers Routes:Edit — to bind our Worker to the new zone
 *
 * Every method throws a CloudflareApiError on non-2xx so callers get a
 * consistent surface. The message includes the top-level error string
 * from the CF payload for debuggability.
 */

const API_BASE = "https://api.cloudflare.com/client/v4";

/* --------------------------------------------------------------- error */

export class CloudflareApiError extends Error {
  status: number;
  cfErrors: Array<{ code: number; message: string }>;
  constructor(status: number, message: string, cfErrors: Array<{ code: number; message: string }>) {
    super(message);
    this.name = "CloudflareApiError";
    this.status = status;
    this.cfErrors = cfErrors;
  }
}

/* --------------------------------------------------------------- types */

export interface Zone {
  id: string;
  name: string;
  status: "active" | "pending" | "initializing" | "moved" | "deleted" | "deactivated";
  name_servers: string[];
  original_name_servers: string[] | null;
  created_on: string;
  activated_on: string | null;
}

export type DnsRecordType =
  | "A"
  | "AAAA"
  | "CNAME"
  | "MX"
  | "TXT"
  | "SRV"
  | "NS"
  | "CAA";

export interface DnsRecord {
  id?: string;
  type: DnsRecordType;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
}

export interface WorkerRoute {
  id?: string;
  pattern: string;
  script: string;
}

/* -------------------------------------------------------- env accessors */

function requireToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error("CLOUDFLARE_API_TOKEN not configured");
  return token;
}

function requireAccountId(): string {
  const id = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!id) throw new Error("CLOUDFLARE_ACCOUNT_ID not configured");
  return id;
}

/**
 * The Worker's script name in this account. Deployed name is
 * `launcharoo-router` (see worker/wrangler.jsonc). Configurable via env
 * for staging setups where a differently-named script exists.
 */
function workerScriptName(): string {
  return process.env.CLOUDFLARE_WORKER_SCRIPT ?? "launcharoo-router";
}

/* ------------------------------------------------------------ core call */

async function cfFetch<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" },
): Promise<T> {
  const token = requireToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  // Cloudflare's payload shape: { success, result, errors[], messages[] }
  let payload: { success?: boolean; result?: T; errors?: Array<{ code: number; message: string }> };
  try {
    payload = (await res.json()) as typeof payload;
  } catch {
    throw new CloudflareApiError(res.status, `Cloudflare returned non-JSON response (${res.status})`, []);
  }

  if (!res.ok || payload.success === false) {
    const errors = payload.errors ?? [];
    const message = errors.length > 0 ? errors.map((e) => `[${e.code}] ${e.message}`).join("; ") : `HTTP ${res.status}`;
    throw new CloudflareApiError(res.status, message, errors);
  }

  return payload.result as T;
}

/* ------------------------------------------------------------- zones */

/**
 * Create a new zone under our Cloudflare account for a customer domain.
 * type='full' means we take over authoritative DNS — customer needs to
 * change nameservers at their registrar.
 *
 * If the zone already exists in our account, Cloudflare returns 400
 * "already exists" — caller should catch and treat as a no-op (idempotent).
 */
export async function createZone(domain: string): Promise<Zone> {
  return cfFetch<Zone>("/zones", {
    method: "POST",
    body: JSON.stringify({
      name: domain,
      account: { id: requireAccountId() },
      type: "full",
    }),
  });
}

export async function getZone(zoneId: string): Promise<Zone> {
  return cfFetch<Zone>(`/zones/${zoneId}`, { method: "GET" });
}

/**
 * Look up a zone by exact domain name. Returns null if not found in our
 * account. Useful for the createZone-already-exists path.
 */
export async function findZoneByName(domain: string): Promise<Zone | null> {
  const zones = await cfFetch<Zone[]>(
    `/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(requireAccountId())}`,
    { method: "GET" },
  );
  return zones[0] ?? null;
}

/* ----------------------------------------------------------- DNS records */

export async function listDnsRecords(zoneId: string): Promise<DnsRecord[]> {
  return cfFetch<DnsRecord[]>(`/zones/${zoneId}/dns_records?per_page=1000`, { method: "GET" });
}

export async function createDnsRecord(zoneId: string, record: DnsRecord): Promise<DnsRecord> {
  return cfFetch<DnsRecord>(`/zones/${zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({
      type: record.type,
      name: record.name,
      content: record.content,
      ttl: record.ttl ?? 1, // 1 = "auto" in the Cloudflare UI
      ...(record.priority !== undefined ? { priority: record.priority } : {}),
      ...(record.proxied !== undefined ? { proxied: record.proxied } : {}),
    }),
  });
}

/* --------------------------------------------------------- worker routes */

/**
 * Bind our Worker script to a route on this zone. For a customer domain,
 * we typically bind two patterns:
 *   <domain>/*         — apex
 *   *.<domain>/*       — subdomains (www + any others)
 */
export async function addWorkerRoute(zoneId: string, pattern: string): Promise<WorkerRoute> {
  return cfFetch<WorkerRoute>(`/zones/${zoneId}/workers/routes`, {
    method: "POST",
    body: JSON.stringify({ pattern, script: workerScriptName() }),
  });
}

/** List every Worker route bound on this zone. */
export async function listWorkerRoutes(zoneId: string): Promise<WorkerRoute[]> {
  return cfFetch<WorkerRoute[]>(`/zones/${zoneId}/workers/routes`, { method: "GET" });
}

/** Remove a specific Worker route. Used when disconnecting a custom domain. */
export async function deleteWorkerRoute(zoneId: string, routeId: string): Promise<void> {
  await cfFetch<{ id: string }>(`/zones/${zoneId}/workers/routes/${routeId}`, {
    method: "DELETE",
  });
}

/**
 * Convenience: unbind every route that points at our Worker script on a
 * given zone. Used by the disconnect flow so a disconnected zone stops
 * routing through us. Idempotent — silently no-ops on already-empty.
 */
export async function unbindWorkerFromZone(zoneId: string): Promise<number> {
  const routes = await listWorkerRoutes(zoneId);
  const ours = routes.filter((r) => r.script === workerScriptName() && r.id);
  for (const route of ours) {
    if (!route.id) continue;
    try {
      await deleteWorkerRoute(zoneId, route.id);
    } catch (err) {
      console.warn(`[cf] deleteWorkerRoute(${zoneId}, ${route.id}) failed:`, err);
    }
  }
  return ours.length;
}

/**
 * Convenience: apex + wildcard routes for a customer domain, both bound
 * to our Worker script. Idempotent — if a route already exists CF returns
 * an error which we swallow and treat as success.
 */
export async function bindWorkerToCustomerDomain(zoneId: string, domain: string): Promise<void> {
  const patterns = [`${domain}/*`, `*.${domain}/*`];
  for (const pattern of patterns) {
    try {
      await addWorkerRoute(zoneId, pattern);
    } catch (err) {
      if (err instanceof CloudflareApiError && err.cfErrors.some((e) => e.code === 10020)) {
        // 10020: route already exists — treat as OK.
        continue;
      }
      throw err;
    }
  }
}
