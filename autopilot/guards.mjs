// Safety guards for the autopilot. These are PreToolUse/PostToolUse hooks.
//
// Model: Bash is a strict ALLOWLIST (anything not recognised is denied and the
// agent is told to escalate via a gate). On top of that, a denylist hard-blocks
// anything that spends money, touches secrets, deploys, or is destructive, so
// even an allowed-looking compound command is stopped if any segment is unsafe.
// File writes are blocked in protected zones (.claude, .git, .env, autopilot/
// except autopilot/state, node_modules).
//
// Per the SDK contract, a PreToolUse hook returns:
//   {} -> fall through to normal permission handling
//   { hookSpecificOutput: { hookEventName, permissionDecision: "allow"|"deny", permissionDecisionReason } }
// and a deny from any hook beats every allow.

import { appendFileSync } from "node:fs";
import { resolve } from "node:path";

// ---- Bash: deny if ANY segment is forbidden; deny if ANY segment is not allowed.
const FORBIDDEN = [
  /\.env\b/i, /\bsudo\b/i, /\brm\s+-[rf]/i, /\bmkfs\b/i, /\bdd\b\s+if=/i, /:\(\)\s*\{/,
  />\s*\/dev\/sd/i, /\bshutdown\b/i, /\breboot\b/i,
  /\bcurl\b/i, /\bwget\b/i, /\bssh\b/i, /\bscp\b/i, /\brsync\b/i,
  /\bstripe\b/i, /\bvercel\b/i, /\bgcloud\b/i, /\baws\b/i, /\bheroku\b/i, /\bnetlify\b/i,
  /git\s+push/i, /git\s+reset\s+--hard/i, /git\s+clean/i, /npm\s+publish/i, /npm\s+login/i,
  /(meta|facebook)[^\n]*(ad|campaign)/i, /namecheap|ventraip|godaddy|porkbun/i,
  /supabase\s+db\s+push/i, /prisma\s+migrate\s+deploy/i, /remove\.?bg/i,
  /sed\s+-i/i, /\btee\b/i, /\bprintenv\b/i, /export\s+[A-Z_]*KEY/i, /secret/i, /password/i,
];
const ALLOW = [
  /^cd\s/, /^node(\s|$)/, /^npm\s/, /^npx\s/, /^pnpm\s/, /^yarn\s/,
  /^tsc(\s|$)/, /^next\s/, /^eslint/, /^prettier/, /^vitest/, /^jest/, /^playwright/,
  /^git\s+(add|commit|status|diff|log|show|checkout|switch|stash|branch|init|rev-parse|config)/,
  /^mkdir/, /^cp\s/, /^mv\s/, /^ls(\s|$)/, /^cat\s/, /^echo\s/, /^printf/, /^touch\s/,
  /^find\s/, /^grep/, /^rg(\s|$)/, /^head/, /^tail/, /^wc/, /^pwd/, /^true/, /^test\s/,
  /^sort/, /^uniq/, /^jq\s/, /^chmod\s\+x/,
];

export async function bashGuard(input) {
  if (input.hook_event_name !== "PreToolUse") return {};
  const cmd = String(input.tool_input?.command || "");
  const segments = cmd.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean);
  const deny = (reason) => ({
    systemMessage: `autopilot blocked a command: ${reason}`,
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  });
  for (const seg of segments) {
    if (FORBIDDEN.some((re) => re.test(seg))) {
      return deny(`forbidden command segment: "${seg}". Spending money, touching secrets, deploying, ` +
        `and destructive ops are not allowed. If you truly need this, write a decision gate instead.`);
    }
  }
  for (const seg of segments) {
    if (!ALLOW.some((re) => re.test(seg))) {
      return deny(`command segment not on the autopilot allowlist: "${seg}". ` +
        `Use Read/Write/Edit tools for files, or write a decision gate file under autopilot/state/gates/ to ask the human.`);
    }
  }
  return {
    hookSpecificOutput: {
      hookEventName: input.hook_event_name,
      permissionDecision: "allow",
      permissionDecisionReason: "allowlisted build command",
    },
  };
}

// ---- Writes: block protected zones. Allow autopilot/state (gate + state files).
export function writeGuard(repoRoot) {
  const root = resolve(repoRoot);
  return async function (input) {
    if (input.hook_event_name !== "PreToolUse") return {};
    const fp = String(input.tool_input?.file_path || input.tool_input?.path || "");
    if (!fp) return {};
    const abs = resolve(root, fp);
    const rel = abs.startsWith(root) ? abs.slice(root.length).replace(/^\/+/, "") : null;
    const deny = (reason) => ({
      systemMessage: `autopilot blocked a write: ${reason}`,
      hookSpecificOutput: {
        hookEventName: input.hook_event_name,
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    });
    if (rel === null) return deny(`write outside the repo is not allowed: ${abs}`);
    if (/(^|\/)\.env(\.|$)/.test(rel)) return deny("writing .env is not allowed");
    if (rel.startsWith(".git/")) return deny("writing inside .git is not allowed");
    if (rel.startsWith(".claude/")) return deny("the .claude config (skills, agents, settings) is human-owned; do not modify it");
    if (rel.startsWith("node_modules/")) return deny("do not edit node_modules");
    if (rel.startsWith("autopilot/") && !rel.startsWith("autopilot/state/"))
      return deny("autopilot/ is the control plane; only autopilot/state/ is writable (gate files, state)");
    return {};
  };
}

// ---- Audit every tool call so you can review async without watching it work.
export function auditHook(auditPath) {
  return async function (input) {
    try {
      const t = input.tool_name || "?";
      const detail = input.tool_input?.command || input.tool_input?.file_path || input.tool_input?.path || "";
      const who = input.agent_type ? `[${input.agent_type}]` : "[lead]";
      appendFileSync(auditPath, `${new Date().toISOString()} ${who} ${t} ${String(detail).slice(0, 200)}\n`);
    } catch { /* never let logging stop the agent */ }
    return {};
  };
}

// ---- Forward the agent's own Notification events to your channel too.
export function makeNotifyHook(notify) {
  return async function (input) {
    try { if (input.message) await notify(`agent: ${input.message}`); } catch { /* ignore */ }
    return {};
  };
}
