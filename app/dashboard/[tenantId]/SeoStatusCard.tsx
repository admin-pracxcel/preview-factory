import { Sparkles, FileText, Calendar } from "lucide-react";
import Link from "next/link";
import { listPostsByTenant } from "@/lib/blog-posts-store";
import { publishScheduleForTier, type SeoTier } from "@/lib/seo-cadence";
import { parseAddonPlanKey } from "@/lib/addon-plans";
import type { AddonSubscription } from "@/lib/addon-store";

export async function SeoStatusCard({
  tenantId,
  subscription,
}: {
  tenantId: string;
  subscription: AddonSubscription;
}) {
  const parsed = parseAddonPlanKey(subscription.planKey);
  if (!parsed || parsed.addonKey !== "seo") return null;
  const tier = parsed.tier as SeoTier;

  const posts = await listPostsByTenant(tenantId, { limit: 3 });
  const nextPublish = computeNextPublishDate(
    new Date(subscription.subscribedAt),
    tier,
  );

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-emerald-300" />
          <h2 className="text-base font-bold text-white">
            SEO — {capitalise(tier)}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/60">
          <Calendar className="h-3.5 w-3.5" />
          Next post: {formatDateAu(nextPublish)}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
          Latest posts
        </p>
        {posts.length === 0 ? (
          <p className="text-sm text-white/50">
            No posts yet. Your first post publishes on{" "}
            {formatDateAu(nextPublish)}.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((p) => (
              <li key={p.id} className="flex items-start gap-2 text-sm">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/40" />
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/preview/site/${tenantId}/blog/${p.slug}`}
                    className="text-white/90 hover:text-white truncate block"
                  >
                    {p.title}
                  </Link>
                  <p className="text-xs text-white/40">
                    {formatDateAu(new Date(p.publishedAt))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function computeNextPublishDate(subscribedAt: Date, tier: SeoTier): Date {
  const schedule = publishScheduleForTier(tier);
  const now = new Date();
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const daysSinceSubscribe = Math.floor(
    (now.getTime() - subscribedAt.getTime()) / MS_PER_DAY,
  );
  const cycleStart = subscribedAt.getTime() + Math.floor(daysSinceSubscribe / 30) * 30 * MS_PER_DAY;
  const dayOfCycle = daysSinceSubscribe % 30;
  const next = schedule.find((d) => d > dayOfCycle);
  if (next !== undefined) return new Date(cycleStart + next * MS_PER_DAY);
  // Passed all posts this cycle — first post of next cycle
  return new Date(cycleStart + 30 * MS_PER_DAY);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDateAu(d: Date): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
