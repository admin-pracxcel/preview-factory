"use client";
/**
 * app/dashboard/[tenantId]/ui.tsx
 * Client components for the client dashboard.
 *
 * CopyButton     — copies a URL to clipboard
 * BillingButton  — calls /api/billing/portal → redirects to Stripe portal
 * EditRequestForm — submits a plain-English change request
 */

import { useState, useEffect } from "react";
import {
  Copy,
  Check,
  CreditCard,
  Loader2,
  Send,
  CheckCircle2,
  ExternalLink,
  Globe,
  AlertCircle,
  Clock,
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

/* ============================================================ custom domain */

type CustomDomainState = {
  domain?: string;
  status?: "choosing" | "pending_ns" | "pending_ssl" | "active" | "failed" | null;
  nameservers?: string[];
  verifiedAt?: string | null;
};

interface CustomDomainCardProps {
  tenantId: string;
  initialState: CustomDomainState;
}

export function CustomDomainCard({ tenantId, initialState }: CustomDomainCardProps) {
  const [state, setState] = useState<CustomDomainState>(initialState);
  const [domainInput, setDomainInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<{ total: number; byType: Record<string, number>; dkimSelectorsFound: string[] } | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [lastCheckReason, setLastCheckReason] = useState<string | null>(null);

  const status = state.status ?? null;

  async function refreshStatus() {
    try {
      const res = await fetch(`/api/dashboard/custom-domain?tenantId=${encodeURIComponent(tenantId)}`);
      if (!res.ok) return;
      const body = (await res.json()) as CustomDomainState;
      setState(body);
    } catch {
      // ignore
    }
  }

  /**
   * Ask the server to actively reconcile — check Cloudflare, import DNS,
   * bind Worker routes if the zone is ready. Falls back to a plain
   * status re-read so the UI always ends with the freshest state.
   */
  async function checkNow() {
    setChecking(true);
    setLastCheckReason(null);
    try {
      const res = await fetch("/api/dashboard/custom-domain/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        outcome?: { state?: string; reason?: string; changed?: boolean };
        error?: string;
      };
      if (body.outcome) {
        setLastCheckReason(
          body.outcome.changed
            ? `Advanced to ${body.outcome.state}`
            : body.outcome.reason ?? `Still ${body.outcome.state}`,
        );
      } else if (body.error) {
        setLastCheckReason(body.error);
      }
      await refreshStatus();
    } catch {
      setLastCheckReason("Network error. Try again.");
    } finally {
      setChecking(false);
      setLastChecked(new Date());
    }
  }

  useEffect(() => {
    if (status !== "pending_ns" && status !== "pending_ssl") return;
    const id = setInterval(refreshStatus, 30_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, tenantId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domainInput) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/custom-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, domain: domainInput }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        domain?: string;
        status?: CustomDomainState["status"];
        nameservers?: string[];
        scan?: typeof scan;
      };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.");
      } else {
        setState({
          domain: body.domain,
          status: body.status,
          nameservers: body.nameservers ?? [],
        });
        setScan(body.scan ?? null);
        setDomainInput("");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <Globe className="h-5 w-5 text-blue-400" />
        <h3 className="text-base font-bold text-white">Custom domain</h3>
      </div>

      {status === null && (
        <ConnectDomainForm
          onSubmit={handleSubmit}
          domainInput={domainInput}
          setDomainInput={setDomainInput}
          submitting={submitting}
          error={error}
        />
      )}

      {status === "pending_ns" && state.domain && (
        <PendingNsPanel
          domain={state.domain}
          nameservers={state.nameservers ?? []}
          scan={scan}
          onCheck={checkNow}
          checking={checking}
          lastChecked={lastChecked}
          lastCheckReason={lastCheckReason}
        />
      )}

      {status === "pending_ssl" && state.domain && (
        <PendingSslPanel
          domain={state.domain}
          onCheck={checkNow}
          checking={checking}
          lastChecked={lastChecked}
          lastCheckReason={lastCheckReason}
        />
      )}

      {status === "active" && state.domain && (
        <ActivePanel domain={state.domain} verifiedAt={state.verifiedAt ?? null} />
      )}

      {status === "failed" && state.domain && (
        <FailedPanel domain={state.domain} />
      )}
    </div>
  );
}

function ConnectDomainForm(props: {
  onSubmit: (e: React.FormEvent) => void;
  domainInput: string;
  setDomainInput: (v: string) => void;
  submitting: boolean;
  error: string | null;
}) {
  return (
    <form onSubmit={props.onSubmit} className="flex flex-col gap-4">
      <p className="text-sm text-white/60">
        Point your own domain at this site. We handle SSL and setup — you
        just change nameservers at your registrar.
      </p>
      <label className="flex flex-col gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-white/60">
          Your domain
        </span>
        <input
          type="text"
          value={props.domainInput}
          onChange={(e) => props.setDomainInput(e.target.value)}
          placeholder="yourbusiness.com.au"
          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white placeholder:text-white/25 focus:border-blue-500/60 focus:outline-none"
          disabled={props.submitting}
        />
      </label>
      {props.error && (
        <p className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-sm text-red-400">
          {props.error}
        </p>
      )}
      <button
        type="submit"
        disabled={props.submitting || !props.domainInput}
        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900/40"
      >
        {props.submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your DNS + creating zone…
          </>
        ) : (
          <>
            <Globe className="h-4 w-4" />
            Connect domain
          </>
        )}
      </button>
      <p className="text-xs text-white/40">
        We will scan your current DNS records first so your email keeps
        working after the switch.
      </p>
    </form>
  );
}

function PendingNsPanel(props: {
  domain: string;
  nameservers: string[];
  scan: { total: number; byType: Record<string, number>; dkimSelectorsFound: string[] } | null;
  onCheck: () => void;
  checking: boolean;
  lastChecked: Date | null;
  lastCheckReason: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-4">
        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
        <div className="text-sm">
          <div className="font-semibold text-yellow-200">
            Change your nameservers to finish setup
          </div>
          <div className="mt-1 text-yellow-100/70">
            Log in to your domain registrar (where you bought {props.domain})
            and replace the current nameservers with the two below. Setup
            usually completes 15 minutes to 24 hours after you change them.
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-white/40">
          Nameservers
        </div>
        <div className="flex flex-col gap-2">
          {props.nameservers.map((ns) => (
            <div
              key={ns}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-4 py-3"
            >
              <span className="flex-1 font-mono text-sm text-blue-300 break-all">
                {ns}
              </span>
              <CopyButton text={ns} />
            </div>
          ))}
        </div>
      </div>

      {props.scan && (
        <div className="rounded-xl border border-white/5 bg-black/20 p-4 text-xs text-white/60">
          <div className="mb-2 font-semibold text-white/70">
            DNS snapshot taken ({props.scan.total} records)
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono">
            {Object.entries(props.scan.byType).map(([type, count]) => (
              <span key={type}>
                {type}: {count}
              </span>
            ))}
          </div>
          {props.scan.dkimSelectorsFound.length > 0 && (
            <div className="mt-2">
              DKIM selectors: {props.scan.dkimSelectorsFound.join(", ")}
            </div>
          )}
        </div>
      )}

      <CheckNowRow
        onCheck={props.onCheck}
        checking={props.checking}
        lastChecked={props.lastChecked}
        lastCheckReason={props.lastCheckReason}
      />
    </div>
  );
}

function PendingSslPanel({
  domain,
  onCheck,
  checking,
  lastChecked,
  lastCheckReason,
}: {
  domain: string;
  onCheck: () => void;
  checking: boolean;
  lastChecked: Date | null;
  lastCheckReason: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-900/10 p-4">
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-blue-400" />
        <div className="text-sm">
          <div className="font-semibold text-blue-200">Issuing SSL certificate</div>
          <div className="mt-1 text-blue-100/70">
            Nameservers are pointed at us. We're issuing an SSL certificate
            for <span className="font-mono">{domain}</span>. This usually
            takes 5-15 minutes.
          </div>
        </div>
      </div>
      <CheckNowRow
        onCheck={onCheck}
        checking={checking}
        lastChecked={lastChecked}
        lastCheckReason={lastCheckReason}
      />
    </div>
  );
}

function CheckNowRow({
  onCheck,
  checking,
  lastChecked,
  lastCheckReason,
}: {
  onCheck: () => void;
  checking: boolean;
  lastChecked: Date | null;
  lastCheckReason: string | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onCheck}
        disabled={checking}
        className="flex items-center gap-2 self-start rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:border-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {checking ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Checking…
          </>
        ) : (
          <>
            <Clock className="h-3.5 w-3.5" />
            Check now
          </>
        )}
      </button>
      {lastChecked && (
        <p className="text-[11px] text-white/40">
          Last checked {lastChecked.toLocaleTimeString()}
          {lastCheckReason ? ` — ${lastCheckReason}` : ""}
        </p>
      )}
    </div>
  );
}

function ActivePanel({ domain, verifiedAt }: { domain: string; verifiedAt: string | null }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-green-500/20 bg-green-900/10 p-4">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
        <div className="text-sm">
          <div className="font-semibold text-green-200">
            Live at{" "}
            <a
              href={`https://${domain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-green-500/30 underline-offset-4 hover:decoration-green-300"
            >
              {domain}
            </a>
          </div>
          {verifiedAt && (
            <div className="mt-1 text-xs text-green-100/50">
              Since {new Date(verifiedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
      <a
        href={`https://${domain}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 rounded-xl bg-white/5 border border-white/10 py-3 text-sm font-semibold text-white transition-colors hover:border-white/20"
      >
        <ExternalLink className="h-4 w-4" />
        Visit your site
      </a>
    </div>
  );
}

function FailedPanel({ domain }: { domain: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-900/10 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      <div className="text-sm">
        <div className="font-semibold text-red-200">
          Setup didn't complete for {domain}
        </div>
        <div className="mt-1 text-red-100/70">
          Contact support and we'll look into it. Your Preview Factory
          subdomain still works.
        </div>
      </div>
    </div>
  );
}
