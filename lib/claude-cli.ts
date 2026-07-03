/**
 * lib/claude-cli.ts
 *
 * Shell out to the local `claude` CLI (Claude Code) for single-shot LLM calls.
 * Uses the user's Claude Code subscription — no Anthropic API key required.
 *
 * Why this and not @anthropic-ai/claude-agent-sdk?
 *   The Agent SDK uses a streaming JSON protocol over stdin/stdout that
 *   deadlocks for one-shot non-agent calls. The plain CLI in --print mode is
 *   reliable: one HTTPS call, exit on completion.
 *
 * Auth: relies on the user being logged in via `claude` (OAuth keychain).
 * Isolation: child cwd is set to os.tmpdir() so the project's CLAUDE.md and
 * settings don't leak into the prompt context.
 */

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export interface CallClaudeCliArgs {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  /** Hard kill after this many ms. Default: 5 minutes. */
  timeoutMs?: number;
  /** Optional JSON Schema. When provided, the API enforces structured output —
   * guarantees the response parses as JSON and matches the shape. */
  jsonSchema?: object;
}

const DEFAULT_MODEL = "claude-haiku-4-5";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

export async function callClaudeCli(args: CallClaudeCliArgs): Promise<string> {
  const model = args.model ?? DEFAULT_MODEL;
  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return new Promise<string>((resolve, reject) => {
    // stream-json output: emits one JSON line per assistant text delta + a final
    // result line. Concatenating the text deltas avoids stdout buffering and
    // gives us visible progress.
    const cliArgs = [
      "--print",
      "--verbose",
      "--output-format", "stream-json",
      "--model", model,
      "--system-prompt", args.systemPrompt,
      "--tools", "",
      "--setting-sources", "",
      "--no-session-persistence",
      "--include-partial-messages",
    ];

    // Structured output — guarantees parseable JSON matching the schema.
    if (args.jsonSchema) {
      cliArgs.push("--json-schema", JSON.stringify(args.jsonSchema));
    }

    // Strip ANTHROPIC_API_KEY from the child env so the CLI authenticates via
    // the user's Claude Code OAuth login (subscription billing) instead of
    // per-token API billing. If the env var is present, the CLI silently
    // prefers it — and a depleted/missing key surfaces as a hang rather than a
    // clear auth error.
    const childEnv: NodeJS.ProcessEnv = { ...process.env };
    delete childEnv.ANTHROPIC_API_KEY;
    delete childEnv.ANTHROPIC_AUTH_TOKEN;

    const child = spawn("claude", cliArgs, {
      cwd: tmpdir(),
      stdio: ["pipe", "pipe", "pipe"],
      env: childEnv,
    });

    let stderr = "";
    let buffer = "";
    let collectedText = "";
    /** Accumulated text from streaming text_delta events, for progress visibility. */
    let streamingText = "";
    /** Accumulated thinking tokens — separate so we can show thinking-vs-text in heartbeats. */
    let streamingThinking = "";
    let lastProgressLog = Date.now();
    let lastStreamedChars = 0;

    const timer = setTimeout(() => {
      // Don't salvage partial output. When we SIGKILL the child mid-generation,
      // the JSON is always structurally incomplete (mid-string, unbalanced
      // braces) and can never parse. Surfacing the timeout clearly lets the
      // caller decide whether to retry or fail.
      child.kill("SIGKILL");
      reject(
        new Error(
          `claude CLI timed out after ${Math.round(timeoutMs / 1000)}s. ` +
            `Text: ${streamingText.length} chars. Thinking: ${streamingThinking.length} chars. ` +
            `Last stderr: ${stderr.slice(0, 300)}`
        )
      );
    }, timeoutMs);

    function handleLine(line: string): void {
      const trimmed = line.trim();
      if (!trimmed) return;
      let msg: unknown;
      try {
        msg = JSON.parse(trimmed);
      } catch {
        return; // skip non-JSON lines silently
      }
      if (typeof msg !== "object" || msg === null) return;
      const m = msg as Record<string, unknown>;

      // Result message is the canonical final output — emitted at end of stream.
      if (m.type === "result") {
        if (m.is_error === true) {
          // api_error_status is a number in newer CLI versions (2.1.x), was a
          // string in older ones. Accept either.
          const status =
            typeof m.api_error_status === "string" || typeof m.api_error_status === "number"
              ? String(m.api_error_status)
              : "unknown";
          const subtype = typeof m.subtype === "string" ? m.subtype : "error";
          // If the CLI put the human-readable failure in `result`, surface it —
          // "Failed to authenticate. API Error: 401 ..." is far more useful than
          // "error result (success): 401".
          const detail = typeof m.result === "string" && m.result.trim() ? `: ${m.result.trim()}` : "";
          clearTimeout(timer);
          reject(new Error(`claude CLI returned error result (${subtype}, http=${status})${detail}`));
          return;
        }
        if (typeof m.result === "string") {
          collectedText = m.result;
        }
      }

      // Surface rate-limit / out-of-credits clearly rather than failing silently.
      if (m.type === "rate_limit_event") {
        const info = (m.rate_limit_info ?? {}) as Record<string, unknown>;
        if (info.status === "denied") {
          const reason = (info.overageDisabledReason as string | undefined) ?? "rate limit reached";
          clearTimeout(timer);
          reject(new Error(`Claude Code subscription rate-limited: ${reason}`));
          return;
        }
      }

      // Accumulate text + thinking deltas separately so heartbeats show what
      // phase the model is in.
      if (m.type === "stream_event" && typeof m.event === "object" && m.event !== null) {
        const event = m.event as Record<string, unknown>;
        if (event.type === "content_block_delta" && typeof event.delta === "object" && event.delta !== null) {
          const delta = event.delta as Record<string, unknown>;
          if (delta.type === "text_delta" && typeof delta.text === "string") {
            streamingText += delta.text;
          } else if (delta.type === "thinking_delta" && typeof delta.thinking === "string") {
            streamingThinking += delta.thinking;
          }
        }
      }

      // Heartbeat: log when total content grows by 500+ chars OR every 10s.
      if (m.type === "stream_event") {
        const totalChars = streamingText.length + streamingThinking.length;
        const grew = totalChars - lastStreamedChars >= 500;
        const elapsed = Date.now() - lastProgressLog > 10000;
        if (grew || elapsed) {
          lastProgressLog = Date.now();
          lastStreamedChars = totalChars;
          console.log(
            `[claude-cli] streaming... text:${streamingText.length} thinking:${streamingThinking.length}`
          );
        }
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        handleLine(line);
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(
        new Error(
          `Failed to spawn claude CLI: ${err.message}. Is the 'claude' command installed and in PATH?`
        )
      );
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      // Flush any remaining buffer
      if (buffer.trim()) handleLine(buffer);

      if (code !== 0) {
        reject(
          new Error(
            `claude CLI exited with code ${code}. stderr: ${stderr.slice(0, 500) || "(empty)"}`
          )
        );
        return;
      }
      if (!collectedText.trim()) {
        reject(
          new Error(
            `claude CLI returned no text content. stderr: ${stderr.slice(0, 300) || "(empty)"}`
          )
        );
        return;
      }
      resolve(collectedText);
    });

    child.stdin.write(args.userPrompt);
    child.stdin.end();
  });
}
