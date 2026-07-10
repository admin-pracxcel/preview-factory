"use client";
/**
 * app/admin/edit-requests/[id]/ui.tsx
 *
 * Client-side Approve + Reject controls for the review page. Preserves
 * the ?token= param from the concierge email URL when POSTing to the
 * approve / reject endpoints so someone acting from a fresh browser
 * (no admin session cookie) can still complete the action.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Loader2, ChevronLeft } from "lucide-react";

interface Props {
  editRequestId: string;
  /** ?token=<...> query param captured from the URL, if any. */
  token: string | null;
}

type Mode = "idle" | "rejecting" | "approving" | "submittingApprove" | "submittingReject";

export function ActionPanel({ editRequestId, token }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [adminNote, setAdminNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submitting =
    mode === "submittingApprove" || mode === "submittingReject";

  function urlFor(action: "approve" | "reject"): string {
    const base = `/api/admin/edit-requests/${editRequestId}/${action}`;
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }

  async function handleApprove() {
    setMode("submittingApprove");
    setError(null);
    try {
      const res = await fetch(urlFor("approve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        webhook?: string;
        webhookReason?: string;
      };
      if (!res.ok) {
        throw new Error(body.error ?? `Approve failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMode("idle");
    }
  }

  async function handleReject() {
    const reason = rejectReason.trim();
    if (reason.length < 3) {
      setError("Give the owner a short reason (at least 3 characters).");
      return;
    }
    setMode("submittingReject");
    setError(null);
    try {
      const res = await fetch(urlFor("reject"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error ?? `Reject failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMode("rejecting");
    }
  }

  /* --------------------------------------------------- reject sub-form */

  if (mode === "rejecting" || mode === "submittingReject") {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Reject with reason
          </p>
          <p className="mt-1 text-xs text-white/50">
            The owner will get this exact text in a friendly email.
          </p>
        </div>
        <textarea
          autoFocus
          rows={4}
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          disabled={submitting}
          maxLength={1000}
          placeholder={`e.g. "That change would break the booking form. Reply with a bit more detail and we'll take another look."`}
          className="resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-red-500 focus:outline-none disabled:opacity-60"
        />
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleReject}
            disabled={submitting || rejectReason.trim().length < 3}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {mode === "submittingReject" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4" />
                Send rejection
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("idle");
              setError(null);
            }}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-sm text-white/70 hover:border-white/30 hover:text-white transition-colors disabled:opacity-60"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
        </div>
      </section>
    );
  }

  /* ------------------------------------------------- approve default */

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
          Admin note (optional)
        </p>
        <p className="mt-1 text-xs text-white/50">
          Extra context the LLM sees when it makes the edit — clarifications,
          things to double-check, links to reference material.
        </p>
      </div>
      <textarea
        rows={3}
        value={adminNote}
        onChange={(e) => setAdminNote(e.target.value)}
        disabled={submitting}
        maxLength={2000}
        placeholder={`e.g. "Owner meant Tuesday, not Thursday" or "Apply this on the /about page too."`}
        className="resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/25 focus:border-blue-500 focus:outline-none disabled:opacity-60"
      />
      {error && <p className="text-xs text-red-300">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleApprove}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {mode === "submittingApprove" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Approving…
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Approve &amp; run workflow
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("rejecting");
            setError(null);
          }}
          disabled={submitting}
          className="flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/80 hover:border-white/30 hover:text-white transition-colors disabled:opacity-60"
        >
          <XCircle className="h-4 w-4" />
          Reject
        </button>
      </div>
    </section>
  );
}
