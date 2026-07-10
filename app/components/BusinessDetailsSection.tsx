"use client";

/**
 * BusinessDetailsSection — rail-shaped editor for phone / email / address.
 *
 * Sits at the top of the preview editor's customise rail so contact edits
 * live alongside design edits (one place for "what's on my site"). Uses
 * the same PATCH /api/tenants/[id]/contact endpoint as the old dashboard
 * card, and asks the parent to reload the preview iframe on save so the
 * change is visible without a full page reload.
 */

import { useState } from "react";
import { Loader2, Check, Phone, Mail, MapPin, Send } from "lucide-react";

export interface BusinessDetailsInitial {
  phone: string;
  email: string;
  address: string;
}

interface Props {
  tenantId: string;
  initial: BusinessDetailsInitial;
  onSaved: (values: BusinessDetailsInitial) => void;
}

export default function BusinessDetailsSection({
  tenantId,
  initial,
  onSaved,
}: Props) {
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [address, setAddress] = useState(initial.address);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const dirty =
    phone !== initial.phone ||
    email !== initial.email ||
    address !== initial.address;

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || status === "saving") return;
    setStatus("saving");
    setError(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/contact`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          email: email.trim(),
          address: address.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        phone?: string;
        email?: string;
        address?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? `Save failed (${res.status})`);
        setStatus("error");
        return;
      }
      const next: BusinessDetailsInitial = {
        phone: data.phone ?? "",
        email: data.email ?? "",
        address: data.address ?? "",
      };
      setPhone(next.phone);
      setEmail(next.email);
      setAddress(next.address);
      setStatus("saved");
      onSaved(next);
      setTimeout(
        () => setStatus((s) => (s === "saved" ? "idle" : s)),
        2500,
      );
    } catch {
      setError("Network error. Try again.");
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
        Business details
      </h3>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Phone
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
          <Phone className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="04xx xxx xxx"
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            maxLength={40}
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Email
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
          <Mail className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourbusiness.com.au"
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            maxLength={200}
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Address
        </span>
        <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2">
          <MapPin className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            type="text"
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="12 Main Street, Chatswood NSW"
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
            maxLength={200}
          />
        </div>
      </label>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!dirty || status === "saving"}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
      >
        {status === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : status === "saved" ? (
          <>
            <Check className="h-4 w-4" />
            Saved
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            {dirty ? "Save changes" : "Up to date"}
          </>
        )}
      </button>
    </form>
  );
}
