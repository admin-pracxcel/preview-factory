// Preview Factory autopilot supervisor.
//
// Runs the build itself, unattended. You launch this once. It drives a single
// resumable Claude Agent SDK "lead" session that works through MISSION.md and
// state.md, spawns specialist subagents, runs the grader, commits each
// increment, and stops to ask you ONLY when it reaches a decision gate
// (a human-judgment call: visual quality sign-off, niche selection, anything
// that spends money or touches a credential).
//
// You answer gates by tapping a link on your phone. No terminal, no Cowork,
// no copy-paste. See RUNBOOK.md.
//
// Requires: Node 18+, and `npm i @anthropic-ai/claude-agent-sdk`.
// Auth: ANTHROPIC_API_KEY (an API key, not a claude.ai login). The SDK will
// not accept subscription login for unattended agents.

import { query } from "@anthropic-ai/claude-agent-sdk";
import { createServer } from "node:http";
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync, appendFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { bashGuard, writeGuard, auditHook, makeNotifyHook } from "./guards.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");           // repo root (autopilot/ lives at root)
const STATE = join(HERE, "state");
const GATES = join(STATE, "gates");
const AGENTS_DIR = join(HERE, "agents");

const PORT = Number(process.env.AUTOPILOT_PORT || 7878);
const HOST = process.env.AUTOPILOT_HOST || "0.0.0.0";
const PUBLIC_URL = process.env.AUTOPILOT_PUBLIC_URL || `http://localhost:${PORT}`;
const NOTIFY_URL = process.env.AUTOPILOT_NOTIFY_URL || "";   // Slack/Telegram/generic webhook
const MODEL = process.env.AUTOPILOT_MODEL || "claude-opus-4-8";
const MAX_INCREMENTS = Number(process.env.AUTOPILOT_MAX_INCREMENTS || 200); // hard ceiling, safety net

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: set ANTHROPIC_API_KEY (an API key, not a claude.ai login).");
  process.exit(1);
}
mkdirSync(GATES, { recursive: true });

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
      // {text} fits Slack incoming webhooks; generic receivers can read it too.
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    log(`notify failed: ${e.message}`);
  }
}

// Load specialist subagents from autopilot/agents/*.md into the SDK `agents` map.
// Frontmatter: description, tools (comma list). Body: the agent's system prompt.
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

// ------------------------------------------------------------- the gate server
// One tappable page per open gate. Approve / Reject / Redirect writes a reply
// file the supervisor is polling for. This is how you answer from your phone.
function startGateServer() {
  const server = createServer((req, res) => {
    const url = new URL(req.url, PUBLIC_URL);
    const send = (code, body, type = "text/html") => {
      res.writeHead(code, { "Content-Type": type }); res.end(body);
    };
    try {
      if (url.pathname === "/" ) {
        const open = readdirSync(GATES).filter((n) => n.endsWith(".json") && !n.endsWith(".reply.json"));
        const stateTail = existsSync(join(REPO, "strategy/_master/state.md"))
          ? readFileSync(join(REPO, "strategy/_master/state.md"), "utf8").split("\n").slice(0, 6).join("<br>")
          : "(no state.md found)";
        return send(200, `<h2>Preview Factory autopilot</h2>
          <p><b>Open decisions:</b> ${open.length}</p>
          <ul>${open.map((n) => `<li><a href="/gate/${n.replace(/\.json$/, "")}">${n}</a></li>`).join("")}</ul>
          <hr><p style="color:#666">${stateTail}</p>`);
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
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          const p = new URLSearchParams(body);
          const reply = { decision: p.get("decision") || "approve", note: p.get("note") || "", at: new Date().toISOString() };
          writeFileSync(join(GATES, `${id}.reply.json`), JSON.stringify(reply, null, 2));
          log(`gate ${id} answered: ${reply.decision} ${reply.note ? "(" + reply.note + ")" : ""}`);
          send(200, `<p>Sent: <b>${reply.decision}</b>. You can close this. The agent will continue.</p>`);
        });
        return;
      }
      send(404, "not found");
    } catch (e) { send(500, "error: " + e.message); }
  });
  server.listen(PORT, HOST, () => log(`gate server on ${PUBLIC_URL}`));
  return server;
}

// Block until the agent writes a gate file, then notify and wait for the reply.
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
    const r = join(GATES, `${id}.reply.json`);
    if (existsSync(r)) return JSON.parse(readFileSync(r, "utf8"));
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
  // Free file editing; Bash and everything else still pass through the guards.
  permissionMode: "acceptEdits",
  // Include Agent so the lead can spawn subagents without a prompt.
  allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Agent", "WebSearch", "WebFetch"],
  // Load .claude/ (skills, settings, CLAUDE.md) from the repo.
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

(async () => {
  await notify(`Autopilot started. Status + decisions: ${PUBLIC_URL}`);
  for (let i = 0; i < MAX_INCREMENTS; i++) {
    if (existsSync(join(STATE, "DONE"))) {
      await notify("Autopilot finished the build queue. Read autopilot handoff and review when you like.");
      log("DONE sentinel present. Stopping.");
      break;
    }
    log(`--- increment ${i + 1} ---`);
    try {
      await runIncrement(i === 0 ? KICKOFF : "Continue per MISSION.md and state.md. " + KICKOFF);
    } catch (e) {
      log(`increment error: ${e.message}`);
      await notify(`Autopilot hit an error and paused: ${e.message}. Check the box.`);
      break;
    }
    const gateId = findOpenGate();
    if (gateId) {
      const reply = await waitForReply(gateId);
      // Feed the decision back into the same session and keep going.
      await runIncrement(
        `Human answered gate "${gateId}": decision=${reply.decision}. ` +
        `${reply.note ? "Instructions: " + reply.note + ". " : ""}` +
        `Act on it, mark the gate resolved (move it to answered), then continue. ` + KICKOFF
      );
    }
  }
  log("supervisor loop ended.");
})();
