import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { assertCronRequest, CronAuthError } from "./admin-cron-auth";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/x", { headers });
}

describe("assertCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = "test-secret-123";
  });
  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("passes when header matches", () => {
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "test-secret-123" })),
    ).not.toThrow();
  });

  it("throws CronAuthError when header missing", () => {
    expect(() => assertCronRequest(req({}))).toThrow(CronAuthError);
  });

  it("throws CronAuthError when header mismatches", () => {
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "wrong" })),
    ).toThrow(CronAuthError);
  });

  it("throws when CRON_SECRET env var is unset", () => {
    delete process.env.CRON_SECRET;
    expect(() =>
      assertCronRequest(req({ "x-cron-secret": "anything" })),
    ).toThrow(CronAuthError);
  });
});
