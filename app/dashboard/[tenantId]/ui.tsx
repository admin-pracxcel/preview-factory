"use client";
/**
 * app/dashboard/[tenantId]/ui.tsx
 * Client components for the client dashboard.
 *
 * CopyButton     — copies a URL to clipboard
 * BillingButton  — calls /api/billing/portal → redirects to Stripe portal
 * EditRequestForm — submits a plain-English change request
 */

import { useState } from "react";
import {
  Copy,
  Check,
  CreditCard,
  Loader2,
  Send,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

/* ================================================================ copy btn == */

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: nothing visible, just ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/60 transition-colors hover:border-white/40 hover:text-white"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}

/* ============================================================ billing btn == */

export function BillingButton({ tenantId }: { tenantId: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  async function handleClick() {
    setLoading(true);
    setMsg("");
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const data = (await res.json()) as {
        url?: string | null;
        mock?: boolean;
        reason?: string;
        error?: string;
      };

      if (data.url) {
        window.location.href = data.url;
      } else if (data.mock) {
        setMsg(
          data.reason ??
            "Billing portal requires Stripe to be configured. See deployment-checklist.md."
        );
      } else {
        setMsg(data.error ?? "Could not open billing portal.");
      }
    } catch {
      setMsg("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/15 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="h-4 w-4" />
        )}
        {loading ? "Opening portal…" : "Manage billing"}
        {!loading && <ExternalLink className="h-3.5 w-3.5 ml-auto opacity-50" />}
      </button>
      {msg && <p className="text-xs text-amber-400">{msg}</p>}
    </div>
  );
}

/* ========================================================== edit req form == */

export function EditRequestForm({ tenantId }: { tenantId: string }) {
  const [request, setRequest] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!request.trim()) {
      setErrorMsg("Please describe the change you want.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/edit-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, request: request.trim() }),
      });
      if (!res.ok) throw new Error("Server error");
      const data = (await res.json()) as { id?: string; status?: string; previewUrl?: string };
      setPreviewUrl(data.previewUrl ?? "");
      setStatus("success");
      setRequest("");
    } catch {
      setStatus("error");
      setErrorMsg("Failed to submit. Please try again.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        </div>
        <h3 className="font-semibold text-white">Change request received</h3>
        {previewUrl ? (
          <>
            <p className="text-sm text-white/50">
              Your proposed change is ready to review. Check the preview before it goes live.
            </p>
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              Review proposed change
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </>
        ) : (
          <p className="text-sm text-white/50">
            Request received but processing failed. Please try again.
          </p>
        )}
        <button
          type="button"
          onClick={() => { setStatus("idle"); setPreviewUrl(""); }}
          className="mt-2 text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="er-request"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
        >
          Describe your change in plain English
        </label>
        <textarea
          id="er-request"
          rows={4}
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder={
            "Examples:\n" +
            "• Update my phone number to 0412 345 678\n" +
            "• Add carpet cleaning to my services\n" +
            "• Change my trading hours to Mon–Fri 7am–5pm"
          }
          className="resize-none rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/25 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Submit change request
          </>
        )}
      </button>
    </form>
  );
}
