"use client";
/**
 * shared/ui/edit-preview-banner.tsx
 * Fixed bottom bar shown when previewing a proposed site edit.
 *
 * Lets the owner approve or reject the proposed change without leaving
 * the preview page.
 */

import { useState } from "react";

interface EditPreviewBannerProps {
  editRequestId: string;
  changeSummary: string;
  request: string;
  tenantId: string;
}

export function EditPreviewBanner({
  editRequestId,
  changeSummary,
  tenantId,
}: EditPreviewBannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleApprove() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/edit-request/${editRequestId}/approve`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Approval failed.");
      }
      window.location.href = `/dashboard/${tenantId}`;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setLoading(false);
    }
  }

  async function handleReject() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/edit-request/${editRequestId}/reject`,
        { method: "POST" }
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Rejection failed.");
      }
      window.location.href = `/dashboard/${tenantId}`;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      );
      setLoading(false);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0A0F1E]/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
        {/* Left — label + summary */}
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
            PREVIEW — Proposed change
          </span>
          <p className="truncate text-sm text-white/80">{changeSummary}</p>
          {error && (
            <p className="mt-1 text-xs text-red-400">{error}</p>
          )}
        </div>

        {/* Right — action buttons */}
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleReject}
            disabled={loading}
            className="rounded-lg border border-white/30 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:border-white/60 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Working..." : "Reject"}
          </button>
          <button
            type="button"
            onClick={handleApprove}
            disabled={loading}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "Working..." : "Approve & publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
