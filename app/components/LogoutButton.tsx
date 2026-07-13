/**
 * app/components/LogoutButton.tsx
 * Small server-component-safe logout form. Renders a real form so it works
 * without JS — the button posts to /api/auth/logout, which clears the
 * pf_session cookie and 303-redirects to /login.
 */

import { LogOut } from "lucide-react";

export function LogoutButton({
  variant = "icon",
}: {
  /** icon: compact, header-friendly. text: full "Log out" label. */
  variant?: "icon" | "text";
}) {
  return (
    <form action="/api/auth/logout" method="post">
      <button
        type="submit"
        title="Log out"
        aria-label="Log out"
        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors"
      >
        <LogOut className="h-4 w-4" />
        {variant === "text" && <span>Log out</span>}
      </button>
    </form>
  );
}
