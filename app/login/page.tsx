"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginShell() {
  return <div className="min-h-screen bg-[#0A0F1E]" />;
}

function LoginForm() {
  const params = useSearchParams();
  const errorFromUrl = params.get("error");

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (errorFromUrl) setError(errorFromUrl);
  }, [errorFromUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.");
      } else {
        setSent(true);
      }
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-screen bg-[#0A0F1E] text-white">
      <header className="px-6 py-5 max-w-2xl mx-auto w-full">
        <Link
          href="/"
          className="text-xl font-[family-name:var(--font-sora)] font-extrabold text-white"
        >
          Preview Factory
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 py-12">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="text-center flex flex-col gap-2">
            <div className="w-14 h-14 rounded-full bg-blue-900/40 border border-blue-500/30 flex items-center justify-center mx-auto mb-2">
              {sent ? (
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              ) : (
                <Mail className="w-7 h-7 text-blue-400" />
              )}
            </div>
            <h1 className="font-[family-name:var(--font-sora)] font-extrabold text-3xl text-white tracking-tight">
              {sent ? "Check your email" : "Sign in"}
            </h1>
            <p className="text-white/55 text-sm mt-1">
              {sent
                ? `If ${email} is registered, we've sent a sign-in link. It expires in 15 minutes.`
                : "We will email you a one-time sign-in link. No password."}
            </p>
          </div>

          {!sent && (
            <form
              onSubmit={handleSubmit}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-4"
            >
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                  Email
                </span>
                <input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@yourbusiness.com.au"
                  className="bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/25 focus:outline-none focus:border-blue-500/60"
                />
              </label>

              {error && (
                <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/40 disabled:cursor-not-allowed text-white font-bold text-sm transition-colors"
              >
                {sending ? "Sending..." : "Email me a sign-in link"}
              </button>
            </form>
          )}

          {sent && (
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setEmail("");
                setError(null);
              }}
              className="text-white/50 hover:text-white/80 text-sm underline underline-offset-4"
            >
              Use a different email
            </button>
          )}

          <div className="text-center text-white/30 text-xs">
            <Link href="/" className="hover:text-white/60 transition-colors">
              Back to Preview Factory
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
