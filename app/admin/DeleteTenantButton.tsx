"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteTenantButtonProps {
  tenantId: string;
  tenantName: string;
}

export function DeleteTenantButton({ tenantId, tenantName }: DeleteTenantButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const label = tenantName || "(untitled)";
    const ok = window.confirm(
      `Delete tenant "${label}"?\n\n` +
        "This wipes the tenants row, every edit request, every lead, every " +
        "job, and every uploaded image for this tenant. It cannot be undone.",
    );
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/delete`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(`Delete failed: ${body.error ?? res.statusText}`);
        setBusy(false);
        return;
      }
      router.refresh();
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : "network error"}`);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-200 hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
      aria-label={`Delete ${tenantName || tenantId}`}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {busy ? "Deleting…" : "Delete"}
    </button>
  );
}
