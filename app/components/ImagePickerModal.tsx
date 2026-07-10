"use client";

/**
 * ImagePickerModal
 *
 * Triggered by a `edit-image` postMessage from the tenant iframe. Lets the
 * owner pick a new image via Pexels search or an upload. On selection the
 * modal fires an `onSelect` back to the preview page which PATCHes the
 * chosen URL into siteProps at the requested path and reloads the iframe.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Upload, Loader2, X, ImageIcon } from "lucide-react";

interface Props {
  tenantId: string;
  /** Non-null path → modal open, editing that slot. */
  path: string | null;
  defaultQuery?: string;
  onClose: () => void;
  onSelect: (url: string) => void;
}

type Tab = "stock" | "upload";

export default function ImagePickerModal({
  tenantId,
  path,
  defaultQuery = "",
  onClose,
  onSelect,
}: Props) {
  const [tab, setTab] = useState<Tab>("stock");
  const [query, setQuery] = useState(defaultQuery);
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/pexels-search?q=${encodeURIComponent(trimmed)}&count=18`,
      );
      const data = (await res.json()) as { urls?: string[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Search failed (${res.status})`);
        return;
      }
      setResults(data.urls ?? []);
    } catch {
      setError("Network error searching stock photos.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-run search on open with the default query so the grid isn't empty.
  useEffect(() => {
    if (!path) return;
    setTab("stock");
    setQuery(defaultQuery);
    if (defaultQuery.trim()) {
      runSearch(defaultQuery);
    } else {
      setResults([]);
    }
    setError(null);
  }, [path, defaultQuery, runSearch]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("tenantId", tenantId);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? `Upload failed (${res.status})`);
        return;
      }
      onSelect(data.url);
    } catch {
      setError("Network error uploading image.");
    } finally {
      setUploading(false);
    }
  }

  if (!path) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Replace image</h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              {path}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 shrink-0">
          <button
            type="button"
            onClick={() => setTab("stock")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "stock"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            Stock photos
          </button>
          <button
            type="button"
            onClick={() => setTab("upload")}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "upload"
                ? "bg-slate-800 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4">
          {tab === "stock" ? (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runSearch(query);
                }}
                className="flex items-center gap-2 mb-4"
              >
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800">
                  <Search className="w-4 h-4 text-slate-500 shrink-0" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. plumber, beauty salon, gym"
                    className="flex-1 bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-sm font-semibold transition-colors"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </button>
              </form>

              {error && (
                <p className="mb-3 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              {loading && results.length === 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div
                      key={i}
                      className="aspect-[4/3] rounded-lg bg-slate-900 animate-pulse"
                    />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-3 gap-3">
                  {results.map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => onSelect(url)}
                      className="group relative aspect-[4/3] rounded-lg overflow-hidden bg-slate-900 border border-slate-800 hover:border-blue-500 transition-colors"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={url}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-blue-600/0 group-hover:bg-blue-600/30 transition-colors" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 text-center py-12">
                  Search for a photo above to see options.
                </p>
              )}
            </>
          ) : (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 py-16 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 bg-slate-900/40 hover:bg-slate-900/80 cursor-pointer transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
                ) : (
                  <Upload className="w-6 h-6 text-slate-400" />
                )}
                <p className="text-sm text-slate-300 font-medium">
                  {uploading ? "Uploading…" : "Drop an image or click to browse"}
                </p>
                <p className="text-xs text-slate-500">
                  PNG, JPG or WebP — up to 5 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>
              {error && (
                <p className="mt-3 rounded-lg border border-red-500/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
