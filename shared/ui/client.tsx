"use client";

/** Client-only interactive primitives: scroll reveal, star rating, countdown. */

import { motion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";
import { Star, Sparkles } from "lucide-react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/** One-shot fade-up that triggers when scrolled into view. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay }}
    >
      {children}
    </motion.div>
  );
}

/** Row of 1–5 rating stars. */
export function Stars({ rating }: { rating: number }) {
  const r = Math.round(rating);
  return (
    <div className="flex gap-0.5" aria-label={`${r} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            "h-4 w-4 " +
            (i < r ? "fill-[var(--accent)] text-[var(--accent)]" : "text-zinc-300")
          }
        />
      ))}
    </div>
  );
}

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

function getTimeLeft(target: string): TimeLeft | null {
  const end = new Date(target).getTime();
  if (Number.isNaN(end)) return null;
  const diff = end - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff / 3_600_000) % 24),
    minutes: Math.floor((diff / 60_000) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

/** Thin promo countdown bar shown at the very top during the preview window. */
export function CountdownBanner({ label, target }: { label?: string; target?: string }) {
  // Always start null on both server and client so SSR HTML and hydrated HTML
  // match exactly. The real value is computed once the component mounts, then
  // updated every second. This avoids hydration mismatches from Date.now()
  // returning different values during SSR vs client-side hydration.
  const [left, setLeft] = useState<TimeLeft | null>(null);

  useEffect(() => {
    if (!target) return;
    setLeft(getTimeLeft(target)); // immediate first tick on mount
    const id = setInterval(() => setLeft(getTimeLeft(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  const unit = (n: number, suffix: string) => `${n}${suffix}`;

  return (
    <div className="bg-[var(--accent)] text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-2 text-center text-xs font-semibold tracking-wide sm:text-sm">
        <Sparkles className="h-4 w-4 shrink-0" />
        <span>{label ?? "Limited-time offer"}</span>
        {left && (
          <span className="tabular-nums">
            {unit(left.days, "d")} {unit(left.hours, "h")} {unit(left.minutes, "m")}{" "}
            {unit(left.seconds, "s")}
          </span>
        )}
      </div>
    </div>
  );
}
