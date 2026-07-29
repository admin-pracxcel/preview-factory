import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCronRequest, CronAuthError } from "@/lib/admin-cron-auth";
import { logFailed } from "@/lib/seo-publish-log-store";

const bodySchema = z.object({
  tenantId: z.string().uuid(),
  kind: z.enum(["blog", "gbp"]),
  reason: z.string().min(1).max(500),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    assertCronRequest(req);
  } catch (err) {
    if (err instanceof CronAuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    throw err;
  }

  const rawBody = await req.json().catch(() => null);
  const parse = bodySchema.safeParse(rawBody);
  if (!parse.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parse.error.flatten() },
      { status: 400 },
    );
  }

  await logFailed(parse.data);
  return NextResponse.json({ ok: true });
}
