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
  Palette,
  PenLine,
  ChevronDown,
  Unplug,
  Phone,
  Mail,
  X,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        <h3 className="font-semibold text-white">Request received</h3>
        <p className="text-sm text-white/50">
          We&apos;ll email you when it&apos;s done — usually within 2 business hours.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
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
            "• Change my email to hello@mybusiness.com.au\n" +
            "• Update my address to 12 Main Street, Chatswood NSW 2067\n" +
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

/* =================================================================== leads */

export interface LeadForDashboard {
  id: string;
  name?: string;
  phone?: string;
  email?: string;
  message?: string;
  source: "contact-form" | "call-click" | "email-click";
  page?: string;
  createdAt: string;
}

function sourceLabel(source: LeadForDashboard["source"]): string {
  if (source === "call-click") return "Phone tap";
  if (source === "email-click") return "Email click";
  return "Enquiry form";
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * LeadsList — table of captured enquiries with per-row click-to-expand.
 * The row summary stays lean (name / contact / type / date) so the table
 * doesn't wrap ugly on mobile; the modal exposes the full record including
 * the message body and the page the visitor was on when they submitted.
 */
export function LeadsList({ leads }: { leads: LeadForDashboard[] }) {
  const [selected, setSelected] = useState<LeadForDashboard | null>(null);

  if (leads.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-white/40">
        No enquiries yet. They&apos;ll appear here as soon as someone contacts you.
      </p>
    );
  }

  return (
    <>
      {/*
       * Cap the list at ~5 rows and scroll internally past that. Keeps the
       * enquiries card from towering over the change-request card in the
       * 50/50 grid on tenants with a busy inbox, and stops the whole page
       * from getting unusably tall on mobile.
       */}
      <ul className="flex max-h-[19rem] flex-col gap-2 overflow-y-auto pr-1">
        {leads.map((lead) => (
          <li key={lead.id}>
            <button
              type="button"
              onClick={() => setSelected(lead)}
              className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-white/5 bg-black/20 px-3 py-2.5 text-left transition-colors hover:border-white/15 hover:bg-black/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {lead.name ?? "Anonymous"}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/50">
                    {sourceLabel(lead.source)}
                  </span>
                </div>
                {lead.message ? (
                  <p className="mt-0.5 truncate text-xs text-white/45">
                    {lead.message}
                  </p>
                ) : (
                  <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-white/40">
                    {lead.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-white/30" />
                        {lead.phone}
                      </span>
                    )}
                    {lead.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 text-white/30" />
                        {lead.email}
                      </span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="hidden text-[11px] text-white/40 sm:inline whitespace-nowrap">
                  {formatDateShort(lead.createdAt)}
                </span>
                <ExternalLink className="h-3.5 w-3.5 text-white/30" />
              </div>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <LeadModal lead={selected} onClose={() => setSelected(null)} />
      )}
    </>
  );
}

function LeadModal({
  lead,
  onClose,
}: {
  lead: LeadForDashboard;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Enquiry details"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {sourceLabel(lead.source)}
              </span>
            </div>
            <h3 className="mt-1 truncate text-lg font-bold text-white">
              {lead.name ?? "Anonymous enquiry"}
            </h3>
            <p className="mt-0.5 text-xs text-white/40">
              {formatDateLong(lead.createdAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg border border-white/10 p-1.5 text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          {(lead.phone || lead.email) && (
            <div className="grid gap-2 sm:grid-cols-2">
              {lead.phone && (
                <a
                  href={`tel:${lead.phone}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/15">
                    <Phone className="h-4 w-4 text-blue-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-white/40">
                      Call
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {lead.phone}
                    </p>
                  </div>
                </a>
              )}
              {lead.email && (
                <a
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:border-purple-500/40 hover:bg-purple-500/10"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-purple-500/15">
                    <Mail className="h-4 w-4 text-purple-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-white/40">
                      Email
                    </p>
                    <p className="truncate text-sm font-semibold text-white">
                      {lead.email}
                    </p>
                  </div>
                </a>
              )}
            </div>
          )}

          {lead.message && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                Message
              </span>
              <div className="whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white/85">
                {lead.message}
              </div>
            </div>
          )}

          {lead.page && (
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="uppercase tracking-wider text-white/40">
                Captured on
              </span>
              <span className="truncate font-mono text-white/60">
                {lead.page}
              </span>
            </div>
          )}

          {!lead.phone && !lead.email && !lead.message && (
            <p className="text-sm text-white/50">
              Only a {sourceLabel(lead.source).toLowerCase()} was recorded — no
              extra details were captured.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================================================== edit your site */

/**
 * Prominent "make changes to your site" entry point. Two paths:
 *   - Change design → the customise page (/preview/[id]) — colors, gallery,
 *     images. That page detects the paid status and swaps its checkout
 *     junk for a "back to dashboard" link.
 *   - Request a change → smooth-scrolls to the plain-English form below.
 */
export function EditSiteCard({ tenantId }: { tenantId: string }) {
  function scrollToEditForm() {
    const el = document.getElementById("edit-request-form");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="mb-4 flex items-center gap-3">
        <PenLine className="h-5 w-5 text-purple-400" />
        <h3 className="text-base font-bold text-white">Edit your site</h3>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href={`/preview/${tenantId}`}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/25 hover:bg-black/30"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-900/40">
            <Palette className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <div className="font-semibold text-white">Edit content &amp; design</div>
            <div className="mt-0.5 text-xs text-white/50">
              Phone, email, address, colours, logo, images
            </div>
          </div>
        </Link>
        <button
          type="button"
          onClick={scrollToEditForm}
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-4 text-left transition-colors hover:border-white/25 hover:bg-black/30"
        >
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-900/40">
            <PenLine className="h-4 w-4 text-purple-400" />
          </div>
          <div>
            <div className="font-semibold text-white">Request a change</div>
            <div className="mt-0.5 text-xs text-white/50">
              Plain-English: &ldquo;add another service&rdquo;, &ldquo;change hours&rdquo;
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

/* ============================================================ custom domain */

type SnapshotSummary = {
  total: number;
  byType: Record<string, number>;
  dkimSelectorsFound: string[];
  notImported: Array<{ type: string; count: number; reason: string }>;
  scannedAt: string | null;
};

type CustomDomainState = {
  domain?: string;
  status?: "choosing" | "pending_ns" | "pending_ssl" | "active" | "failed" | null;
  nameservers?: string[];
  verifiedAt?: string | null;
  snapshot?: SnapshotSummary | null;
};

interface CustomDomainCardProps {
  tenantId: string;
  initialState: CustomDomainState;
}

export function CustomDomainCard({ tenantId, initialState }: CustomDomainCardProps) {
  const router = useRouter();
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
      const prevStatus = state.status ?? null;
      setState(body);
      // When the domain has just flipped to active, re-run the server
      // component so it picks up `customDomainVerifiedAt` and mounts the
      // addon walkthrough. Without this the customer would need to
      // manually refresh to see the popup fire.
      if (body.status === "active" && prevStatus !== "active") {
        router.refresh();
      }
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
        <ActivePanel
          domain={state.domain}
          verifiedAt={state.verifiedAt ?? null}
          tenantId={tenantId}
          onDisconnected={() => setState({ status: null })}
        />
      )}

      {status === "failed" && state.domain && (
        <FailedPanel
          domain={state.domain}
          tenantId={tenantId}
          onDisconnected={() => setState({ status: null })}
        />
      )}

      {(status === "pending_ns" || status === "pending_ssl" || status === "active") &&
        state.snapshot && <PreservedRecordsPanel snapshot={state.snapshot} />}

      <ConciergeHelp tenantId={tenantId} />
    </div>
  );
}

/**
 * Small footer inside the Custom Domain card offering hands-on help. Non-technical
 * owners often stall at "log in to your registrar and change nameservers" — this
 * pops a lightweight form modal so they don't have to leave the dashboard to ask.
 */
function ConciergeHelp({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mt-5 flex flex-col gap-1 rounded-xl border border-white/5 bg-black/20 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="text-xs text-white/60">
          Stuck on nameservers or not sure where to start? We&rsquo;ll set the
          domain up for you.
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 cursor-pointer rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-center text-xs font-semibold text-blue-300 transition-colors hover:border-blue-400/60 hover:text-blue-200"
        >
          Get help setting this up
        </button>
      </div>
      {open && (
        <DomainHelpModal tenantId={tenantId} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

function DomainHelpModal({
  tenantId,
  onClose,
}: {
  tenantId: string;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/domain-help`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong. Try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Get domain setup help"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-pointer bg-black/70 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0A0F1E] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 px-6 py-4">
          <div>
            <h3 className="text-lg font-bold text-white">Get help setting up your domain</h3>
            <p className="mt-0.5 text-xs text-white/50">
              Send us the details — we&rsquo;ll take it from here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 cursor-pointer rounded-lg border border-white/10 p-1.5 text-white/50 transition-colors hover:border-white/25 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {status === "sent" ? (
          <div className="flex flex-col items-center gap-3 px-6 py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-green-500/15">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
            </div>
            <h4 className="text-base font-semibold text-white">Request sent</h4>
            <p className="text-sm text-white/60">
              We&rsquo;ll get back to you by email — usually within a few hours.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 cursor-pointer rounded-xl bg-white/10 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
                What&rsquo;s stopping you? (optional)
              </span>
              <textarea
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  "e.g. I bought my domain at GoDaddy and I don't know where to change the nameservers. Can you do it for me?"
                }
                maxLength={2000}
                className="resize-none rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder-white/25 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-[11px] text-white/30">
                Leave it blank if you just want us to reach out — we&rsquo;ll
                have your business and domain details already.
              </span>
            </label>

            {error && (
              <p className="rounded-lg border border-red-500/20 bg-red-900/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "sending"}
              className="flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send request
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * "Records we preserved" — reassurance panel so a customer with email on
 * the domain can see, at a glance, that the migration didn't wipe their
 * MX/DKIM. Collapsed by default so the card stays clean.
 */
function PreservedRecordsPanel({ snapshot }: { snapshot: SnapshotSummary }) {
  const [open, setOpen] = useState(false);
  const preserved = snapshot.total - snapshot.notImported.reduce((a, b) => a + b.count, 0);
  return (
    <div className="mt-4 rounded-xl border border-white/5 bg-black/20 p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between text-left"
      >
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-green-400" />
          <span className="font-semibold text-white/80">
            {preserved} DNS record{preserved === 1 ? "" : "s"} preserved
          </span>
          {snapshot.dkimSelectorsFound.length > 0 && (
            <span className="text-xs text-white/40">
              (incl. DKIM: {snapshot.dkimSelectorsFound.join(", ")})
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="mt-3 space-y-3 text-xs">
          <p className="text-white/50">
            We scanned your live DNS before taking over so your email and
            other services keep working.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-white/70">
            {Object.entries(snapshot.byType).map(([type, count]) => (
              <span key={type}>
                {type}: {count}
              </span>
            ))}
          </div>
          {snapshot.notImported.length > 0 && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-900/10 p-3">
              <div className="font-semibold text-yellow-200">Not imported</div>
              <ul className="mt-1 space-y-1 text-yellow-100/70">
                {snapshot.notImported.map((n) => (
                  <li key={n.type}>
                    <span className="font-mono">{n.type}</span> × {n.count} — {n.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {snapshot.scannedAt && (
            <div className="text-white/30">
              Snapshot taken {new Date(snapshot.scannedAt).toLocaleString()}
            </div>
          )}
        </div>
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

function ActivePanel({
  domain,
  verifiedAt,
  tenantId,
  onDisconnected,
}: {
  domain: string;
  verifiedAt: string | null;
  tenantId: string;
  onDisconnected: () => void;
}) {
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
      <DisconnectButton domain={domain} tenantId={tenantId} onDisconnected={onDisconnected} />
    </div>
  );
}

function FailedPanel({
  domain,
  tenantId,
  onDisconnected,
}: {
  domain: string;
  tenantId: string;
  onDisconnected: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-900/10 p-4">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
        <div className="text-sm">
          <div className="font-semibold text-red-200">
            Setup didn&apos;t complete for {domain}
          </div>
          <div className="mt-1 text-red-100/70">
            Contact support and we&apos;ll look into it. Your Launcharoo
            subdomain still works.
          </div>
        </div>
      </div>
      <DisconnectButton domain={domain} tenantId={tenantId} onDisconnected={onDisconnected} />
    </div>
  );
}

/**
 * Two-click disconnect: first click surfaces a confirm state with a
 * plain-language warning; second click ("Yes, disconnect") fires the
 * request. Prevents accidental clicks in either panel.
 */
function DisconnectButton({
  domain,
  tenantId,
  onDisconnected,
}: {
  domain: string;
  tenantId: string;
  onDisconnected: () => void;
}) {
  const [state, setState] = useState<"idle" | "confirming" | "working" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleConfirm() {
    setState("working");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/dashboard/custom-domain/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMessage(body.error ?? "Disconnect failed. Try again.");
        setState("error");
        return;
      }
      onDisconnected();
    } catch {
      setErrorMessage("Network error. Try again.");
      setState("error");
    }
  }

  if (state === "confirming" || state === "working") {
    return (
      <div className="rounded-xl border border-yellow-500/20 bg-yellow-900/10 p-4 text-sm">
        <div className="font-semibold text-yellow-100">
          Disconnect {domain} from your site?
        </div>
        <ul className="mt-2 list-disc pl-5 text-xs text-yellow-100/70">
          <li>Your site stays reachable on your launcharoo subdomain.</li>
          <li>
            Your DNS records at Cloudflare (email, DKIM, etc.) stay in
            place — we just stop routing web traffic through them.
          </li>
          <li>
            To move the domain elsewhere, change nameservers at your
            registrar after disconnecting.
          </li>
        </ul>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={state === "working"}
            className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:opacity-60"
          >
            {state === "working" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Disconnecting…
              </>
            ) : (
              <>
                <Unplug className="h-3.5 w-3.5" />
                Yes, disconnect
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setState("idle")}
            disabled={state === "working"}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/70 hover:border-white/20 hover:text-white disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setState("confirming")}
        className="flex items-center justify-center gap-2 self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/50 transition-colors hover:border-red-500/30 hover:text-red-300"
      >
        <Unplug className="h-3.5 w-3.5" />
        Disconnect domain
      </button>
      {state === "error" && errorMessage && (
        <p className="text-xs text-red-400">{errorMessage}</p>
      )}
    </div>
  );
}
