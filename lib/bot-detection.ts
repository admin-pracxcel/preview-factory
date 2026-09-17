/**
 * lib/bot-detection.ts
 *
 * Cheap User-Agent classifier used to decide whether an incoming preview
 * request should count as a "real human first view" — the trigger that
 * starts the 5-day click-to-start expiry clock on campaign tenants.
 *
 * Not a security boundary. Sophisticated scanners that pose as real
 * browsers will slip through — that's an accepted trade-off documented in
 * Phase 12a. Real-world catch rate on generic email-security link
 * scanners is ~90%, which is enough that most recipients open a preview
 * with the full 5-day window intact.
 */

/** Substring/regex fragments that mark a request as a bot / scanner /
 *  link-preview fetcher. Case-insensitive match on the User-Agent. */
const BOT_UA_RE =
  /bot|crawler|spider|scanner|preview|Mimecast|Barracuda|Proofpoint|Symantec|Sophos|linkcheck|curl|wget|python-requests|Go-http-client|node-fetch|axios|facebookexternalhit|Slackbot|Twitterbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|SkypeUriPreview|Applebot/i;

/**
 * Returns true when the User-Agent looks like a non-human fetcher.
 * Empty/missing UA also counts as bot — real browsers always send one,
 * and stray curl-style requests without a UA shouldn't burn the clock.
 */
export function isLikelyBot(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  return BOT_UA_RE.test(userAgent);
}
