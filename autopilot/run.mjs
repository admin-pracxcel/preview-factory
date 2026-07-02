// Preview Factory autopilot supervisor.
//
// Runs the build itself, unattended. You launch this once. It drives a single
// resumable Claude Agent SDK "lead" session that works through MISSION.md and
// state.md, spawns specialist subagents, runs the grader, commits each
// increment, and stops to ask you ONLY when it reaches a decision gate.
//
// Two ways to steer it from your phone or browser at http://localhost:7878 :
//   - At a gate: Approve / Reject / Redirect (with notes).
//   - Any time: the "Message the agent" box. Your note is handed to the agent
//     before its next step. For an instant hard stop, Ctrl+C the terminal.
//
// Requires: Node 18+, and `npm i @anthropic-ai/claude-agent-sdk`.
// Auth: ANTHROPIC_API_KEY (an API key, not a claude.ai login).

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createServer } from "node:http";
import {
  readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, appendFileSync, renameSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { bashGuard, writeGuard, auditHook, makeNotifyHook } from "./guards.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");
const STATE = join(HERE, "state");
const GATES = join(STATE, "gates");
const INBOX = join(STATE, "inbox");
const AGENTS_DIR = join(HERE, "agents");

const PORT = Number(process.env.AUTOPILOT_PORT || 7878);
const HOST = process.env.AUTOPILOT_HOST || "0.0.0.0";
const PUBLIC_URL = process.env.AUTOPILOT_PUBLIC_URL || `http://localhost:${PORT}`;
const NOTIFY_URL = process.env.AUTOPILOT_NOTIFY_URL || "";
const MODEL = process.env.AUTOPILOT_MODEL || "claude-opus-4-8";
const MAX_INCREMENTS = Number(process.env.AUTOPILOT_MAX_INCREMENTS || 200);

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: set ANTHROPIC_API_KEY (an API key, not a claude.ai login).");
  process.exit(1);
}
mkdirSync(GATES, { recursive: true });
mkdirSync(join(INBOX, "read"), { recursive: true });

// ----------------------------------------------------------------- utilities
const log = (m) => {
  const line = `${new Date().toISOString()}  ${m}`;
  console.log(line);
  appendFileSync(join(STATE, "supervisor.log"), line + "\n");
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function notify(text) {
  log(`NOTIFY: ${text.replace(/\n/g, " ")}`);
  if (!NOTIFY_URL) return;
  try {
    await fetch(NOTIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    log(`notify failed: ${e.message}`);
  }
}

function loadAgents() {
  const agents = {};
  if (!existsSync(AGENTS_DIR)) return agents;
  for (const f of readdirSync(AGENTS_DIR).filter((n) => n.endsWith(".md"))) {
    const raw = readFileSync(join(AGENTS_DIR, f), "utf8");
    const m = raw.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/);
    const fm = {}, body = m ? m[2].trim() : raw.trim();
    if (m) for (const line of m[1].split("\n")) {
      const i = line.indexOf(":"); if (i === -1) continue;
      fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const name = f.replace(/\.md$/, "");
    agents[name] = {
      description: fm.description || name,
      prompt: body,
      tools: (fm.tools ? fm.tools.split(",").map((s) => s.trim()).filter(Boolean) : undefined),
    };
  }
  return agents;
}

// Read any messages you typed in the web box, mark them read, return the text.
function drainInbox() {
  const msgs = readdirSync(INBOX).filter((n) => n.endsWith(".txt")).sort();
  if (!msgs.length) return "";
  const out = [];
  for (const m of msgs) {
    out.push(readFileSync(join(INBOX, m), "utf8").trim());
    renameSync(join(INBOX, m), join(INBOX, "read", m));
  }
  return out.join("\n");
}

const tail = (file, n) => {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").trim().split("\n").slice(-n).join("\n");
};

// ------------------------------------------------------------- the web server
function startGateServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, PUBLIC_URL);
    const send = (code, body, type = "text/html") => {
      res.writeHead(code, { "Content-Type": type }); res.end(body);
    };
    const readBody = (cb) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => cb(b)); };
    try {
      if (url.pathname === "/") {
        const open = readdirSync(GATES).filter((n) => n.endsWith(".json") && !n.endsWith(".reply.json"));
        const stateTail = existsSync(join(REPO, "strategy/_master/state.md"))
          ? readFileSync(join(REPO, "strategy/_master/state.md"), "utf8").split("\n").slice(0, 6).join("<br>")
          : "(no state.md)";
        const activity = (tail(join(STATE, "audit.log"), 10) || "(nothing yet)")
          .split("\n").reverse().join("<br>");
        return send(200, `<h2>Preview Factory autopilot</h2>
          <p><b>Open decisions:</b> ${open.length}</p>
          <ul>${open.map((n) => `<li><a href="/gate/${n.replace(/\.json$/, "")}">${n}</a></li>`).join("")}</ul>

          <h3>Message the agent</h3>
          <p style="color:#666">Type anything here any time to steer or push back. It is handed to the agent before its next step. For an instant stop, Ctrl+C the terminal.</p>
          <form method="POST" action="/say">
            <textarea name="msg" rows="3" cols="60" placeholder="e.g. stop on the gallery section, make the hero full-width, focus on plumber not electrician"></textarea><br>
            <button type="submit">Send to the agent</button>
          </form>

          <hr><h3>Recent activity</h3><pre style="white-space:pre-wrap;background:#f4f4f4;padding:8px">${activity}</pre>
          <hr><p style="color:#666">${stateTail}</p>`);
      }

      if (url.pathname === "/say" && req.method === "POST") {
        return readBody((body) => {
          const msg = (new URLSearchParams(body).get("msg") || "").trim();
          if (msg) {
            writeFileSync(join(INBOX, `${Date.now()}.txt`), msg);
            log(`inbox message from human: ${msg.slice(0, 160)}`);
          }
          send(200, `<p>Sent. The agent will pick it up before its next step. <a href="/">back</a></p>`);
        });
      }

      const gm = url.pathname.match(/^\/gate\/(.+)$/);
      if (gm) {
        const id = gm[1];
        const file = join(GATES, `${id}.json`);
        if (!existsSync(file)) return send(404, "gate not found");
        const g = JSON.parse(readFileSync(file, "utf8"));
        return send(200, `<h3>${g.title || id}</h3>
          <p>${(g.question || "").replace(/\n/g, "<br>")}</p>
          ${g.context ? `<pre style="white-space:pre-wrap;background:#f4f4f4;padding:8px">${g.context}</pre>` : ""}
          <form method="POST" action="/reply/${id}">
            <p><label><input type="radio" name="decision" value="approve" checked> Approve / continue</label></p>
            <p><label><input type="radio" name="decision" value="reject"> Reject / stop this path</label></p>
            <p><label><input type="radio" name="decision" value="redirect"> Redirect with instructions:</label></p>
            <textarea name="note" rows="4" cols="50" placeholder="Optional notes, or your redirect instructions"></textarea><br>
            <button type="submit">Send to the agent</button>
          </form>`);
      }

      const rm = url.pathname.match(/^\/reply\/(.+)$/);
      if (rm && req.method === "POST") {
        const id = rm[1];
        return readBody((body) => {
          const p = new URLSearchParams(body);
          const reply = { decision: p.get("decision") || "approve", note: p.get("note") || "", at: new Date().toISOString() };
          writeFileSync(join(GATES, `${id}.reply.json`), JSON.stringify(reply, null, 2));
          log(`gate ${id} answered: ${reply.decision} ${reply.note ? "(" + reply.note + ")" : ""}`);
          send(200, `<p>Sent: <b>${reply.decision}</b>. You can close this. The agent will continue. <a href="/">back</a></p>`);
        });
      }
      send(404, "not found");
    } catch (e) { send(500, "error: " + e.message); }
  });
  server.listen(PORT, HOST, () => log(`gate server on ${PUBLIC_URL}`));
  return server;
}

function findOpenGate() {
  return readdirSync(GATES)
    .filter((n) => n.endsWith(".json") && !n.endsWith(".reply.json"))
    .map((n) => n.replace(/\.json$/, ""))
    .find((id) => !existsSync(join(GATES, `${id}.reply.json`)));
}

async function waitForReply(id) {
  const g = JSON.parse(readFileSync(join(GATES, `${id}.json`), "utf8"));
  await notify(`DECISION NEEDED: ${g.title || id}\n${g.question || ""}\nAnswer: ${PUBLIC_URL}/gate/${id}`);
  log(`waiting for human on gate ${id} ...`);
  for (;;) {
    if (existsSync(join(GATES, `${id}.reply.json`))) return JSON.parse(readFileSync(join(GATES, `${id}.reply.json`), "utf8"));
    await sleep(5000);
  }
}

// ----------------------------------------------------------------- the loop
const agents = loadAgents();
log(`loaded ${Object.keys(agents).length} subagents: ${Object.keys(agents).join(", ")}`);
startGateServer();

const baseOptions = {
  cwd: REPO,
  model: MODEL,
  permissionMode: "acceptEdits",
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
  settingSources: ["project"],
  agents,
  hooks: {
    PreToolUse: [
      { matcher: "Bash", hooks: [bashGuard] },
      { matcher: "Write|Edit", hooks: [writeGuard(REPO)] },
    ],
    PostToolUse: [{ hooks: [auditHook(join(STATE, "audit.log"))] }],
    Notification: [{ hooks: [makeNotifyHook(notify)] }],
  },
};

const KICKOFF =
  "Resume autonomous operation per MISSION.md and state.md, following the contract in CLAUDE.md. " +
  "Do ONE increment: pick the next unblocked step, use the right subagent and skill, run `node scripts/grade.mjs` " +
  "and only mark a unit done when it passes, then commit and update state.md. " +
  "If the next step is a decision gate, write the gate file and stop. " +
  "If MISSION.md has no unblocked steps left, create autopilot/state/DONE and stop.";

let sessionId;

// Errors we should wait out and retry, not die on. Credit top-ups, rate limits,
// overloads, and transient network blips all recover by themselves.
const RECOVERABLE = /credit balance is too low|rate.?limit|overloaded|too many requests|\b429\b|\b529\b|ECONNRESET|ETIMEDOUT|timeout|temporarily|service unavailable|\b503\b/i;

async function runIncrement(promptText) {
  const opts = sessionId ? { ...baseOptions, resume: sessionId } : baseOptions;
  for await (const msg of query({ prompt: promptText, options: opts })) {
    if (msg.type === "system" && msg.subtype === "init" && msg.session_id) sessionId = msg.session_id;
    if (msg.type === "assistant") {
      const text = (msg.message?.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ");
      if (text.trim()) log(`lead: ${text.trim().slice(0, 280)}`);
    }
    if (msg.type === "result") log(`increment result: ${msg.subtype || "ok"}`);
  }
}

// Self-healing wrapper: on a recoverable error, notify, wait, and retry the same
// step (no relaunch needed). On a real error (e.g. invalid key), bubble up.
async function runIncrementWithRetry(promptText) {
  for (let attempt = 1; ; attempt++) {
    try {
      await runIncrement(promptText);
      return;
    } catch (e) {
      if (!RECOVERABLE.test(e.message)) throw e;
      const wait = Math.min(60, 15 * attempt);
      log(`recoverable error: ${e.message} — auto-retrying in ${wait}s (attempt ${attempt})`);
      await notify(`Paused: ${e.message}. Auto-retrying in ${wait}s. If it is credit, top up and it will continue on its own. No relaunch needed.`);
      await sleep(wait * 1000);
      const extra = drainInbox();
      if (extra) promptText += `\n\nHuman message received while paused: "${extra}"\n`;
    }
  }
}

(async () => {
  await notify(`Autopilot started. Status, messages, decisions: ${PUBLIC_URL}`);
  for (let i = 0; i < MAX_INCREMENTS; i++) {
    if (existsSync(join(STATE, "DONE"))) {
      await notify("Autopilot finished the build queue. Review when you like.");
      log("DONE sentinel present. Stopping.");
      break;
    }

    // ALWAYS resolve an open decision FIRST, before any generic continue.
    // A gate written at the end of the previous step is caught here and waited
    // on, so a fresh gate can never be bypassed and a plain "continue" can never
    // be mistaken for your approval.
    const openGate = findOpenGate();
    if (openGate) {
      const reply = await waitForReply(openGate);
      const note = drainInbox();
      try {
        await runIncrementWithRetry(
          `Human answered gate "${openGate}": decision=${reply.decision}. ` +
          `${reply.note ? "Redirect instructions: " + reply.note + ". " : ""}` +
          `${note ? "Additional human message: \"" + note + "\". " : ""}` +
          `Act on it FULLY before anything else. Mark the gate resolved (move it to answered/), then continue. ` +
          `Only an explicit "Human answered gate" message is approval; never treat a generic continue as approval ` +
          `of a pending gate. ` + KICKOFF
        );
      } catch (e) {
        log(`increment error (non-recoverable): ${e.message}`);
        await notify(`Autopilot stopped on a non-recoverable error: ${e.message}. Fix it and relaunch.`);
        break;
      }
      continue; // re-check for any newly written gate at the top
    }

    // No open decision: do the next build increment.
    const pending = drainInbox();
    const steer = pending
      ? `\n\nThe human sent you a message, treat it as priority guidance and act on it now: "${pending}"\n\n`
      : "";
    log(`--- increment ${i + 1} ---${pending ? " (with human message)" : ""}`);
    try {
      await runIncrementWithRetry((i === 0 ? KICKOFF : "Continue per MISSION.md and state.md. " + KICKOFF) + steer);
    } catch (e) {
      log(`increment error (non-recoverable): ${e.message}`);
      await notify(`Autopilot stopped on a non-recoverable error: ${e.message}. This one needs you (likely the API key). Fix it and relaunch.`);
      break;
    }
  }
  log("supervisor loop ended.");
})();
