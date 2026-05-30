import fs from "node:fs";
import path from "node:path";
import Script from "next/script";

export const dynamic = "force-dynamic";
const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA";

function getTunerMarkup() {
  const html = fs.readFileSync(path.join(process.cwd(), "index.html"), "utf8");
  const bodyMatch = html.match(/<body>([\s\S]*?)(?:<script src="lame\.min\.js"><\/script>\s*)?<script src="script\.js"><\/script>\s*<\/body>/);
  return (bodyMatch?.[1] ?? "").replace(
    /data-turnstile-site-key="[^"]*"/,
    `data-turnstile-site-key="${turnstileSiteKey}"`,
  );
}

export default function Home() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: getTunerMarkup() }} />
      <Script src="/script.js" strategy="afterInteractive" />
    </>
  );
}
