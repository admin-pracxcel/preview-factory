/**
 * app/status/page.tsx
 * Public operational status page. Reads lib/health directly (no fetch loop)
 * and renders freshness of each subsystem plus tenant lifecycle tallies.
 *
 * Server component. Revalidates every 30 seconds — fine for a status page.
 */

import Link from "next/link";
import { getHealth, type JobHealth, type TenantCounts } from "@/lib/health";

export const runtime = "nodejs";
export const revalidate = 30;

export const metadata = {
  title: "Launcharoo — status",
  robots: { index: false, follow: false },
};

function formatAge(ms: number | null): string {
  if (ms === null || Number.isNaN(ms)) return "?";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${
        ok ? "bg-green-400" : "bg-red-400"
      }`}
    />
  );
}

function JobRow({
  label,
  cadence,
  job,
}: {
  label: string;
  cadence: string;
  job: JobHealth;
}) {
  const ok = !job.stale;
  return (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-white/5">
      <div className="flex items-start gap-3">
        <div className="mt-1.5">
          <StatusDot ok={ok} />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{label}</div>
          <div className="text-xs text-white/40 mt-0.5">{cadence}</div>
          {job.meta && Object.keys(job.meta).length > 0 && (
            <div className="text-xs text-white/50 mt-2 font-mono">
              {Object.entries(job.meta).map(([k, v]) => (
                <div key={k}>
                  {k}: {String(v)}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className={`text-sm font-mono ${ok ? "text-white/70" : "text-red-300"}`}>
          {formatAge(job.ageMs)}
        </div>
        <div className="text-xs text-white/30 mt-0.5">
          {ok ? "healthy" : "stale"}
        </div>
      </div>
    </div>
  );
}

function TenantsCard({ counts }: { counts: TenantCounts | null }) {
  if (!counts) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
          Tenants
        </div>
        <div className="text-white/60 text-sm">tenant tallies unavailable</div>
      </div>
    );
  }
  const buckets: Array<[string, number, string]> = [
    ["Total", counts.total, "text-white"],
    ["Claimed", counts.claimed, "text-green-300"],
    ["Unclaimed", counts.unclaimed, "text-blue-300"],
    ["Past-due", counts.pastDue, "text-yellow-300"],
    ["Cancelled", counts.cancelled, "text-orange-300"],
    ["Expired", counts.expired, "text-white/40"],
  ];
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-4">
        Tenants
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
        {buckets.map(([label, n, colour]) => (
          <div key={label}>
            <div className={`font-[family-name:var(--font-sora)] font-extrabold text-3xl ${colour}`}>
              {n}
            </div>
            <div className="text-xs text-white/40 mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function StatusPage() {
  const health = await getHealth();

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0A0F1E] text-white">
      <header className="px-6 py-5 max-w-3xl mx-auto w-full">
        <Link href="/" aria-label="Launcharoo">
          <img
            src="/images/launcharoo-logo-white.webp"
            alt="Launcharoo"
            className="h-6 w-auto"
          />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-8">
        <div className="w-full max-w-3xl flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl text-white tracking-tight">
                Status
              </h1>
              <p className="text-white/40 text-sm mt-1 font-mono">
                as of {health.now}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusDot ok={health.ok} />
              <span className="text-sm font-semibold">
                {health.ok ? "All systems operational" : "Degraded"}
              </span>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2">
              Background jobs
            </div>
            <JobRow
              label="Worker heartbeat"
              cadence="every 5 minutes"
              job={health.worker}
            />
            <JobRow
              label="Reaper"
              cadence="daily at 03:15 UTC"
              job={health.reaper}
            />
            <JobRow
              label="Housekeeping"
              cadence="Sunday at 04:00 UTC"
              job={health.cleanup}
            />
          </div>

          <TenantsCard counts={health.tenants} />

          <div className="text-white/30 text-xs text-center">
            <Link
              href="/api/health"
              className="hover:text-white/60 transition-colors font-mono"
            >
              raw JSON: /api/health
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
