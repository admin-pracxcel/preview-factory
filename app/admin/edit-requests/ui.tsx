"use client";
/**
 * app/admin/edit-requests/ui.tsx
 * Client bits for the concierge queue: "mark applied" form with optional note.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

export function ApplyForm({
  requestId,
  tenantName,
}: {
  requestId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function handleApply() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch(`/api/admin/edit-requests/${requestId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Apply failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
        Note to owner (optional)
      </label>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={`e.g. "Phone updated on all pages. Let us know if the new number looks right."`}
        className="resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        type="button"
        onClick={handleApply}
        disabled={status === "loading"}
        className="flex items-center justify-center gap-2 self-start rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Notifying {tenantName}…
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Mark applied &amp; email owner
          </>
        )}
      </button>
    </div>
  );
}
