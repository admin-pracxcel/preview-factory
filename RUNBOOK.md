# Preview Factory autopilot: runbook

This is the machine that builds the product while you only make decisions. You
launch it once. After that you do nothing except tap a link when it asks you a
real decision (visual sign-off, niche choice, anything touching money). No
Cowork, no copy-paste, no chatting with Claude Code.

## What it does and does not do
- DOES, by itself: build the remaining categories, build the generator, prove
  generation against the grader, build the funnel, write the n8n/Supabase specs,
  commit each step, and self-verify against `scripts/grade.mjs`.
- DOES NOT, ever: deploy, register domains, spend ad budget, call Stripe, run DB
  migrations, or touch secrets. Those are blocked at the tool layer and come back
  to you as the human handoff (Phase G) or as decision gates.
- ASKS YOU only at decision gates: things a machine cannot judge. You get a link,
  you tap Approve or type a redirect, it continues.

## One-time setup (about 15 minutes)
1. Drop these files into your existing `preview-factory` repo root, keeping paths:
   `CLAUDE.md`, `autopilot/`, `scripts/grade.mjs`, `.claude/`, `package.autopilot.json`.
   Merge `package.autopilot.json` into your `package.json` (the one devDependency
   and the two scripts).
2. Install the SDK: `npm install`. The TypeScript SDK bundles its own Claude Code
   binary, so nothing else to install.
3. Set three environment variables:
   - `ANTHROPIC_API_KEY` = an API key from console (NOT your claude.ai login; the
     SDK will not run unattended on a subscription login). Per-token billing.
   - `AUTOPILOT_NOTIFY_URL` = a Slack incoming webhook (or any URL that accepts a
     JSON `{text}` POST: Telegram bridge, n8n webhook, your phone via ntfy.sh).
     This is how gate alerts reach your phone. Optional but strongly recommended.
   - `AUTOPILOT_PUBLIC_URL` = the address you will tap from your phone, e.g.
     `http://your-hetzner-ip:7878`. Defaults to localhost if unset.
4. Run it on your linux box (Hetzner), not the Mac. The Mac `next build` currently
   bus-errors on Tailwind v4 / lightningcss; the grader's build check needs a
   clean linux build, and running on Hetzner also means it is not tied to your
   laptop being open.

## Launch
```
npm run autopilot
```
That is the last command you run. It starts the gate server, loads the five
subagents, and begins working through MISSION.md / state.md one increment at a
time.

## When it needs a decision
You get a notification with a link like `…:7878/gate/<id>`. Open it on your phone:
- Approve and continue, or
- Reject and stop that path, or
- Redirect: type instructions and send.
It resumes immediately. Until you answer, it waits (it does not guess on
judgment calls).

## Watching or stopping (optional)
- Status page: open `AUTOPILOT_PUBLIC_URL/` for current state and open decisions.
- Everything it does is logged to `autopilot/state/audit.log` and committed to git,
  so you can review diffs whenever you want, async.
- Stop anytime with Ctrl-C. Re-run `npm run autopilot` to resume where it left off
  (it reads state.md and the saved session).

## The first decision you will see
The trades category is built and waiting on your visual sign-off (`/preview/trades`).
That is gate one. After you approve, it builds the generator and proves real GBP
data to a graded site before touching the other categories, then continues to the
funnel and the backend specs, and finally writes `what-human-must-do.md` for the
parts only you can do (accounts, keys, deploy, ads).

## Safety summary
- Bash is a strict allowlist (build/test/git only). Unknown commands are denied.
- Money, secrets, deploys, registrars, migrations, and destructive commands are
  hard-blocked, for the lead and every subagent.
- The agent cannot modify its own guards, skills, or the `.claude` config.
- If it thinks it needs a blocked action, it must raise a gate to you instead.

## Tuning later
- Quality bar: `scripts/grade.mjs` (thresholds at the top).
- Skills: `.claude/skills/*/SKILL.md`.
- Subagents: `autopilot/agents/*.md`.
- What counts as a decision gate: `autopilot/plan.json` and the gate protocol in
  `CLAUDE.md`.
- Cost: the lead runs on the model in `AUTOPILOT_MODEL` (default claude-opus-4-8).
  Drop to a cheaper model for routine increments if you want; keep Opus for the
  hard builds.
