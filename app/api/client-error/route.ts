import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { allowErrorReport } from "@/lib/server/rate-limit";

// Receives client-side error reports (window.onerror, unhandledrejection,
// the root error boundary) and writes them to the client_errors table so
// in-the-wild failures are visible at all. Insert-only, tightly rate-limited,
// hard caps on every field; the strict CSP allows no third-party beacon, so
// this same-origin route + Supabase is the whole pipeline.
export const maxDuration = 10;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

const reportSchema = z.object({
  message: z.string().trim().min(1).max(500),
  source: z.enum(["onerror", "unhandledrejection", "boundary"]),
  url: z.string().max(300).optional(),
  stack: z.string().max(4000).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allowErrorReport(ip)) {
    return NextResponse.json({ error: "rateLimited" }, { status: 429 });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  let parsed: z.infer<typeof reportSchema>;
  try {
    parsed = reportSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/client_errors`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: parsed.message,
        source: parsed.source,
        url: parsed.url ?? null,
        stack: parsed.stack ?? null,
        user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
      }),
      signal: AbortSignal.timeout(6000),
    });
    return NextResponse.json({ ok: res.ok }, { status: 200 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
