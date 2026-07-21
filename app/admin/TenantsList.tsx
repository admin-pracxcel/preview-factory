"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export interface AdminTenant {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  owner_email: string | null;
}

interface TenantsListProps {
  tenants: AdminTenant[];
}

export function TenantsList({ tenants }: TenantsListProps) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const allSelected = tenants.length > 0 && selected.size === tenants.length;
  const someSelected = selected.size > 0 && !allSelected;

  const selectedList = useMemo(
    () => tenants.filter((t) => selected.has(t.id)),
    [tenants, selected],
  );

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(tenants.map((t) => t.id)));
    else setSelected(new Set());
  }

  async function deleteTenants(ids: string[], labelForConfirm: string) {
    if (ids.length === 0) return;
    const ok = window.confirm(
      `${labelForConfirm}\n\n` +
        "This wipes every edit request, lead, job, and uploaded image for " +
        "each tenant, then the tenant row itself. It cannot be undone.",
    );
    if (!ok) return;

    setBusy(true);
    const results = await Promise.allSettled(
      ids.map((id) =>
        fetch(`/api/admin/tenants/${id}/delete`, { method: "POST" }).then(
          async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(body.error ?? res.statusText);
            }
            return id;
          },
        ),
      ),
    );

    const failed = results.filter((r) => r.status === "rejected");
    const succeeded = results.length - failed.length;

    if (failed.length > 0) {
      const messages = failed
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? "unknown")
        .slice(0, 3)
        .join(", ");
      alert(
        `${succeeded} of ${results.length} deleted. ${failed.length} failed: ${messages}`,
      );
    }

    setSelected(new Set());
    setBusy(false);
    router.refresh();
  }

  async function handleBulkDelete() {
    const label =
      selectedList.length === 1
        ? `Delete tenant "${selectedList[0].name || "(untitled)"}"?`
        : `Delete ${selectedList.length} selected tenants?`;
    await deleteTenants(
      selectedList.map((t) => t.id),
      label,
    );
  }

  async function handleSingleDelete(t: AdminTenant) {
    await deleteTenants(
      [t.id],
      `Delete tenant "${t.name || "(untitled)"}"?`,
    );
  }

  if (tenants.length === 0) {
    return <p className="text-sm text-white/40">No tenants yet.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Header row: select-all + bulk action */}
      <div className="flex items-center justify-between gap-3 px-4">
        <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(el) => {
              if (el) el.indeterminate = someSelected;
            }}
            onChange={(e) => toggleAll(e.target.checked)}
            className="h-4 w-4 accent-red-500 cursor-pointer"
          />
          {selected.size > 0
            ? `${selected.size} selected`
            : `Select all (${tenants.length})`}
        </label>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-100 hover:border-red-400/70 hover:bg-red-500/25 transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {busy ? "Deleting…" : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {tenants.map((t) => {
          const publicHost = t.slug ? `${t.slug}.launcharoo.online` : null;
          const isChecked = selected.has(t.id);
          return (
            <li
              key={t.id}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                isChecked
                  ? "border-red-500/30 bg-red-500/[0.04]"
                  : "border-white/10 bg-white/[0.02]"
              }`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={(e) => toggleOne(t.id, e.target.checked)}
                aria-label={`Select ${t.name || t.id}`}
                className="h-4 w-4 shrink-0 accent-red-500 cursor-pointer"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {t.name || "(untitled)"}
                </p>
                <p className="mt-0.5 truncate text-xs text-white/40">
                  {t.owner_email ?? "(no owner)"}
                  {publicHost && <> &middot; {publicHost}</>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white/60">
                  {t.status}
                </span>
                <Link
                  href={`/admin/tenants/${t.id}`}
                  className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-semibold text-white/80 hover:border-white/30 hover:bg-white/5 hover:text-white transition-colors"
                >
                  View
                </Link>
                <Link
                  href={`/dashboard/${t.id}`}
                  className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200 hover:border-blue-400/60 hover:bg-blue-500/20 hover:text-blue-100 transition-colors"
                >
                  Dashboard
                </Link>
                <button
                  type="button"
                  onClick={() => handleSingleDelete(t)}
                  disabled={busy}
                  aria-label={`Delete ${t.name || t.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-200 hover:border-red-400/60 hover:bg-red-500/20 hover:text-red-100 transition-colors disabled:opacity-50 disabled:cursor-wait"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
