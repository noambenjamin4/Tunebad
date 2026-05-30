import { NextResponse } from "next/server";

const siteverifyUrl = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const devSecret = "1x0000000000000000000000000000000AA";

export async function POST(request: Request) {
  const { token, action } = await request.json();

  if (!token || typeof token !== "string") {
    return NextResponse.json({ success: false, reason: "Missing Cloudflare Turnstile token." }, { status: 400 });
  }

  const secret =
    process.env.TURNSTILE_SECRET_KEY || (process.env.NODE_ENV === "production" ? undefined : devSecret);

  if (!secret) {
    return NextResponse.json({ success: false, reason: "Cloudflare Turnstile secret is not configured." }, { status: 500 });
  }

  if (secret === devSecret && token.includes("DUMMY.TOKEN")) {
    return NextResponse.json({ success: true });
  }

  const formData = new FormData();
  formData.append("secret", secret);
  formData.append("response", token);

  const validation = await fetch(siteverifyUrl, {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  const result = await validation.json();
  const actionMatches = !action || !result.action || result.action === action;

  if (!result.success || !actionMatches) {
    return NextResponse.json(
      {
        success: false,
        reason: result["error-codes"]?.join(", ") || "Cloudflare Turnstile validation failed.",
      },
      { status: 403 },
    );
  }

  return NextResponse.json({ success: true });
}
