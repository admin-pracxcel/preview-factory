# Phase 5 setup — beginner walkthrough

You'll do everything in three places:

- **Mac terminal** — just for one `.env.local` edit at the end
- **VPS shell (SSH)** — where most of the work happens
- **n8n web UI** — for importing the new workflow

Time: about 30 minutes if nothing goes sideways.

**Before you start, have these open in tabs:**

- [ ] Your n8n web UI (logged in)
- [ ] Your Supabase project dashboard (for one SQL paste)
- [ ] An SSH terminal into your VPS
- [ ] Your Mac's local repo (`cd ~/Downloads/preview-factory-templates-29-06-26`)

**Two secrets you'll paste multiple times — write them down first:**

- **Google Places API key** — from Google Cloud Console. Should start with `AIza...`
- **Pexels API key** — from pexels.com/api. Empty string is fine if you don't have one; the generator falls back.
- **Supabase URL** — from Supabase dashboard → Settings → API → Project URL. Format: `https://<something>.supabase.co`
- **Supabase service_role key** — from Supabase dashboard → Settings → API → **service_role** (NOT the anon key). It's a long JWT starting with `eyJ...`. **Server-only. Never share.**
- **WORKER_SECRET** — the shared secret between Vercel and n8n. If you set one already in Phase 4, use the same value. Otherwise generate one on your Mac: `openssl rand -base64 32`

---

## Step 1 — Apply the schema addition (Supabase)

**In the Supabase dashboard → SQL Editor:**

Copy the entire contents of `supabase/schema.sql` and hit **Run**. It's safe to re-run — the file uses `CREATE TABLE IF NOT EXISTS` everywhere.

**How you know it worked:**
- Supabase says "Success. No rows returned."
- In Table Editor, a new `worker_health` table appears with one row where `id='worker'`.

---

## Step 2 — Clone the repo on your VPS

**In your VPS SSH terminal:**

```bash
sudo mkdir -p /opt/preview-factory
sudo chown $USER:$USER /opt/preview-factory
git clone https://github.com/admin-pracxcel/preview-factory.git /opt/preview-factory
cd /opt/preview-factory
ls
```

**How you know it worked:** `ls` shows folders like `app`, `n8n`, `generator`, `package.json`, etc.

**⚠️ Ownership matters later.** After Step 3 (docker mount + restart), you'll chown this directory to the n8n container's `node` user so the generator can read/write here without needing root. Just note it now; the chown command is in the "How you know it worked" checkpoint at the end of Step 4.

---

## Step 3 — Mount the repo into your n8n container

**⚠️ This step briefly restarts n8n (10-30 sec outage).** Any workflow execution in progress gets killed. Webhooks fired during the outage return "connection refused". Scheduled triggers resume from their next tick. Pick a quiet time if any of your existing workflows are time-critical.

Everything else in this guide is additive and won't touch your existing workflows — this is the only step with any risk to what you already have running.

**Safety belt — do these three things first:**

```bash
# 1. Back up docker-compose.yml so you can instantly roll back if the edit goes wrong.
cp docker-compose.yml docker-compose.yml.backup

# 2. Confirm your existing n8n data volume is present. Your workflows, credentials,
#    and execution history all live in that volume. As long as the line stays in
#    the volumes block, everything survives the restart.
grep -A 5 "^  n8n:" docker-compose.yml | grep -E "volumes|/home/node/.n8n"
```

You should see a line like `- n8n_data:/home/node/.n8n` (or similar). **Do not remove that line.** If you can't find it, stop and tell me what you see — we'll figure out where your n8n data lives before touching anything.

**If anything goes wrong later in this step**, instant rollback is:

```bash
mv docker-compose.yml.backup docker-compose.yml
docker compose up -d
```

**Find your `docker-compose.yml`:**

```bash
find / -name "docker-compose.yml" 2>/dev/null | grep -i n8n
```

That prints the path — usually something like `/root/docker-compose.yml` or `/home/<you>/n8n/docker-compose.yml`. Open it in your editor of choice:

```bash
nano /path/to/docker-compose.yml
```

**Find the `n8n:` service** and look for a `volumes:` section. Add this ONE new line to that list:

```yaml
      - /opt/preview-factory:/opt/preview-factory
```

Example — before and after:

```yaml
# BEFORE
services:
  n8n:
    image: n8nio/n8n:latest
    volumes:
      - n8n_data:/home/node/.n8n

# AFTER
services:
  n8n:
    image: n8nio/n8n:latest
    volumes:
      - n8n_data:/home/node/.n8n
      - /opt/preview-factory:/opt/preview-factory
```

Save the file.

**Validate the YAML before restarting** (a typo here is the one thing that can break your existing workflows):

```bash
docker compose config >/dev/null && echo "YAML valid ✓"
```

- If it prints `YAML valid ✓` — safe to proceed.
- If it prints an error — do NOT restart. Fix the YAML (usually indentation) or roll back with `mv docker-compose.yml.backup docker-compose.yml`. Then re-run this check until it says valid.

Now restart. In the same directory as `docker-compose.yml`:

```bash
docker compose down
docker compose up -d
```

The `down` command stops the container; `up -d` starts it fresh with the new mount. **Watch it come back:**

```bash
docker ps | grep n8n
```

Should show `Up X seconds` next to your n8n container. If it's missing or in a restart loop, something's wrong — check `docker compose logs n8n` for the error, or roll back with the backup.

**How you know it worked:**

```bash
docker exec -u root n8n ls /opt/preview-factory
```

Should print the same folders as Step 2 (`app`, `n8n`, `generator`, etc.). If it says "No such file" you've either mounted the wrong path or restarted the wrong container.

---

## Step 4 — Install Node dependencies inside the container

**In your VPS SSH terminal:**

```bash
docker exec -u root -w /opt/preview-factory n8n npm install --include=dev
```

The `--include=dev` flag matters because the n8n container has `NODE_ENV=production` set, which would otherwise skip installing `tsx` (we need it at runtime to run TypeScript directly).

This takes 30-90 seconds and prints a lot of `added ... packages`. Warnings about "deprecated" packages or "allow-scripts" are safe to ignore. **Errors are not** — if it fails, stop and share the last 20 lines.

**How you know it worked — three sanity checks:**

```bash
docker exec -u root -w /opt/preview-factory n8n node --version
docker exec -u root -w /opt/preview-factory n8n npx --no-install tsx --version
docker exec -u root n8n /home/node/.n8n/node_modules/.bin/claude --version
```

All three must print a version number. If `tsx` errors, `npm install --include=dev` didn't finish — re-run it.

**About the claude path**: on Alpine-based n8n images, the bundled `/usr/local/bin/claude` bind mount may be broken (glibc-vs-musl mismatch). But n8n's own npm-installed claude at `/home/node/.n8n/node_modules/.bin/claude` is musl-compatible and works. We reference it by its full path here, and the Phase 5 workflow prepends that directory to its `PATH` so `generator/cli.ts` finds it too.

**Now — chown `/opt/preview-factory` to the container's `node` user** so the workflow (which runs as `node`) can read/write here without needing root. Also fixes any "authentication_failed" issues when running as root — the node user has its own working Claude Code login inside the container:

```bash
NODE_UID=$(docker exec n8n id -u)
NODE_GID=$(docker exec n8n id -g)
sudo chown -R "$NODE_UID:$NODE_GID" /opt/preview-factory
```

You should see `node uid=1000 gid=1000` or similar. If the second command errors with "Operation not permitted", make sure you're running as root/sudo on the host.

**Then — tell git the directory is safe** (both root on the host, and node inside the container). Git 2.35+ blocks operations on a repo owned by a different user; without this you'll get `fatal: detected dubious ownership` when running `git pull` as root, or when the workflow does `git fetch` inside the container:

```bash
git config --global --add safe.directory /opt/preview-factory
docker exec n8n git config --global --add safe.directory /opt/preview-factory
```

The workflow's Execute Command also uses `git -c safe.directory=/opt/preview-factory ...` inline as belt-and-braces, so even if the container's node home resets, git operations still work.

---

## Step 5 — Create the `.env` file inside `/opt/preview-factory`

**In your VPS SSH terminal**, replace the four `<...>` placeholders below with your real values (Supabase URL + service_role key + Google Places key + Pexels key), then paste the whole block:

```bash
cat >/opt/preview-factory/.env <<'EOF'
GOOGLE_PLACES_API_KEY=<paste your Google Places key>
PEXELS_API_KEY=<paste your Pexels key or leave empty>
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<paste your Supabase service_role JWT>
EOF
chmod 600 /opt/preview-factory/.env
```

**How you know it worked:**

```bash
docker exec -u root -w /opt/preview-factory n8n sh -c 'set -a; . ./.env; set +a; echo $SUPABASE_URL'
```

Should echo your Supabase URL. If it prints empty, the file didn't save correctly.

---

## Step 6 — Smoke test the generator (fake mode, no Claude spend)

This runs the generator with a bundled Clearflow Plumbing fixture to prove the plumbing works — no real Claude, no tokens, ~1 second.

**In your VPS SSH terminal** — note **NO `-u root`** below. Runs as the default node user, which has working Claude auth:

```bash
docker exec -w /opt/preview-factory -e USE_FIXTURE=1 n8n \
  sh -c 'export PATH="/home/node/.n8n/node_modules/.bin:$PATH"; set -a; . ./.env; set +a; npm run smoke:generate'
```

**How you know it worked** — the last line prints:

```
[smoke] PASS: {"business":"Clearflow Plumbing","services":6,"locations":8,...}
```

**Why the `export PATH=...` prefix**: the smoke test runs `generator/cli.ts`, which calls `claude --version` at startup to check the CLI is present. That needs `claude` to be findable on `PATH` — prepending n8n's own npm bin directory does exactly that. The Phase 5 workflow bakes the same prefix into its Execute Command node.

**Why not `-u root`**: root's Claude auth (via the `/root/.claude` bind mount) is often stale or for a different account; the workflow runs as `node` anyway, and node's login inside the container is the one you want to use for both testing and production. If you accidentally run this with `-u root` and get `Failed to authenticate. API Error: 401`, that's what happened — drop the flag and it'll work.

**If it fails**, stop here and share the last 20 lines. Everything after this depends on this working.

---

## Step 7 — Import the workflow (n8n UI)

**Copy `n8n/generate-real-with-secrets.json` from your Mac to the VPS**, or just open the file on your Mac and copy the raw JSON. Either way you'll paste it into n8n's import screen.

**In n8n UI:**

1. Top-right corner → the ⋯ (three dots) → **Import from File** (or **Import from URL / clipboard**).
2. Select `n8n/generate-real-with-secrets.json` (or paste the JSON).
3. n8n creates a workflow called **Generate Real**.
4. Open it. You'll see 21 nodes. Several will be marked **red** because their Supabase credential reference doesn't match. That's expected.

**Re-attach the Supabase credential to each red node:**

For every node with a red border (there are eight of them — all the HTTP Request nodes), click it, scroll down to **Credential to connect with**, and pick your existing `Supabase Service Role - admin@pracxcel.com.au - Preview Factory` credential from the dropdown. Save the node.

**How you know it worked:** no more red borders anywhere. Save the workflow (Ctrl/Cmd + S).

**Leave it INACTIVE for now** (top-right toggle stays off).

---

## Step 8 — Update Vercel to point at the new workflow

**On your Mac**, open `.env.local` and change the `N8N_WEBHOOK_URL` line:

```
N8N_WEBHOOK_URL=https://<your n8n domain>/webhook/pf-generate-real
```

The path changed from `pf-generate-stub` to `pf-generate-real`.

To find the exact URL: in the n8n UI, click the **Webhook** node in Generate Real, look at **Production URL** — that's the value.

Save `.env.local`. If you're running `npm run dev` on the Mac, restart it so the new env is loaded.

---

## Step 9 — Cutover: Real on, Stub off

**In n8n UI:**

1. Open **Generate Stub** → top-right toggle **OFF** (deactivate).
2. Open **Generate Real** → top-right toggle **ON** (activate).

Both toggles below the workflow name. Only ONE of these two should be active at a time.

---

## Step 10 — Submit a real intake and watch it run

**On your Mac** (in a browser):

1. Visit `http://localhost:3000` (or your dev URL).
2. Enter a real Australian business — a plumber, hairdresser, whatever — and submit.
3. `/building` page shows "Building your preview…".

**In n8n UI**, open **Generate Real** → **Executions** tab (top-right of the workflow view). Refresh every ~30 seconds. You should see:

- A new execution appears within a few seconds
- It stays in **"Running"** for about 1-3 minutes (this is real Claude generating the site)
- Then goes green ✓

**Back on your Mac browser**, the `/building` page redirects to `/preview/<id>`. The preview shows the **real business you submitted**, not Clearflow Plumbing.

That's Phase 5 complete.

---

## If something goes wrong

**The `/building` page spins forever:**

1. In n8n → Generate Real → Executions. Find the latest one. Click it.
2. Look for a red node. Click that node → **Error** tab → read the message.
3. Common culprits:
   - **"Run generator" red** — CLI failed. Check the node's Output tab for `stderr`. Usually: missing env vars in `/opt/preview-factory/.env`, or `claude` not logged in.
   - **"Parse envelope" red** — CLI didn't emit a valid envelope. Something else in the container printed to stdout. Rare.
   - **"Finish tenant" red** — Supabase rejected the payload. Look at the response body.

**Generation completes but the wrong business shows:**

- You're probably still hitting the stub webhook. Check `N8N_WEBHOOK_URL` in `.env.local` ends with `pf-generate-real`, not `pf-generate-stub`.

**Nothing happens at all in n8n:**

- The webhook fire from Vercel is silently failing. Check both are active. Also: some n8n versions require the workflow to be Active AND saved before the webhook URL works.

**Rollback:** flip both toggles the opposite way — Stub back on, Real off. You're back to Phase 4.

---

## Appendix — what you don't need to worry about yet

- **Heartbeat workflow (`n8n/heartbeat.json`)** — import it, but leave it inactive. You'll turn it on in Phase 7 when Vercel is live.
- **Concurrency, retry policy, token logging** — all set in the workflow settings; nothing for you to configure right now.
- **Log noise from Cron (30s)** — same as Phase 4. Empty polls succeed silently. Ignore.
