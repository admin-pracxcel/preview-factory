"use client";
/**
 * shared/ui/lead-capture.tsx
 * Client components for lead capture.
 *
 * LeadCaptureForm  — enquiry form that POSTs to /api/leads
 * TrackedPhoneLink — tel: link that fires a sendBeacon to /api/leads on click
 *
 * Both are used inside ContactSection (sections.tsx) which is already "use client".
 * They are also safe to import standalone in any page.
 */

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

/* ================================================================== form == */

interface LeadCaptureFormProps {
  /** Tenant ID to tag the lead with; undefined for static demo previews. */
  tenantId?: string;
}

export function LeadCaptureForm({ tenantId }: LeadCaptureFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setErrorMsg("Name and phone number are required.");
      return;
    }
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          message: message.trim() || undefined,
          source: "contact-form",
          page: typeof window !== "undefined" ? window.location.pathname : undefined,
        }),
      });
      if (!res.ok) throw new Error("Server error");
      setStatus("success");
      setName(""); setPhone(""); setEmail(""); setMessage("");
    } catch {
      setStatus("error");
      setErrorMsg("Something went wrong. Please call us directly.");
    }
  }

  if (status === "success") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-green-500/15">
          <CheckCircle2 className="h-7 w-7 text-green-400" />
        </div>
        <h3 className="text-xl font-bold text-white">We&apos;ll be in touch</h3>
        <p className="text-sm text-white/60">
          Thanks for your enquiry — we aim to respond within 2 business hours.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4"
      noValidate
    >
      <h3 className="text-lg font-bold text-white">Send an enquiry</h3>

      {/* Name + Phone */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lf-name"
            className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
          >
            Name <span className="text-[var(--accent)]">*</span>
          </label>
          <input
            id="lf-name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="lf-phone"
            className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
          >
            Phone <span className="text-[var(--accent)]">*</span>
          </label>
          <input
            id="lf-phone"
            type="tel"
            autoComplete="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="04xx xxx xxx"
            className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </div>
      </div>

      {/* Email */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="lf-email"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
        >
          Email <span className="text-white/25">(optional)</span>
        </label>
        <input
          id="lf-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {/* Message */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="lf-message"
          className="text-[11px] font-semibold uppercase tracking-wider text-white/50"
        >
          Message <span className="text-white/25">(optional)</span>
        </label>
        <textarea
          id="lf-message"
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what you need…"
          className="resize-none rounded-xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
        />
      </div>

      {errorMsg && (
        <p className="text-sm text-red-400">{errorMsg}</p>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] shadow transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          "Send enquiry"
        )}
      </button>
    </form>
  );
}

/* ============================================================= phone link == */

/**
 * Wraps a tel: anchor and fires a sendBeacon to /api/leads on click.
 * The navigation proceeds normally — the beacon is sent even as the page unloads.
 */
export function TrackedPhoneLink({
  href,
  tenantId,
  phone,
  className,
  children,
}: {
  href: string;
  tenantId?: string;
  phone?: string;
  className?: string;
  children: React.ReactNode;
}) {
  function handleClick() {
    try {
      const blob = new Blob(
        [
          JSON.stringify({
            tenantId,
            phone,
            source: "call-click",
            page:
              typeof window !== "undefined" ? window.location.pathname : undefined,
          }),
        ],
        { type: "application/json" }
      );
      navigator.sendBeacon("/api/leads", blob);
    } catch {
      // sendBeacon not available (SSR or old browser) — ignore silently
    }
  }

  return (
    <a href={href} onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
