import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json({
      saved: false,
      reason: "Supabase environment variables are not configured yet.",
    });
  }

  const body = await request.json();
  const { error } = await supabase.from("analysis_results").insert({
    file_name: body.name,
    duration_seconds: body.duration,
    bpm: body.bpm,
    musical_key: body.key,
    scale: body.scale,
    confidence: body.confidence,
    sample_rate: body.sampleRate,
    channels: body.channels,
  });

  if (error) {
    return NextResponse.json({ saved: false, reason: error.message }, { status: 500 });
  }

  return NextResponse.json({ saved: true });
}
