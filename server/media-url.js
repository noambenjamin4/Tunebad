"use strict";

// JS port of ../lib/media-url.ts — mirrors it faithfully so the remote
// downloader server enforces the exact same canonical-URL rebuild and host
// allowlist as the local Next.js route. Keep in sync with lib/media-url.ts;
// any change there (new host, new path pattern) must be mirrored here.

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "on.soundcloud.com", "m.soundcloud.com"]);
const VIMEO_HOSTS = new Set(["vimeo.com", "www.vimeo.com", "player.vimeo.com"]);
const MIXCLOUD_HOSTS = new Set(["mixcloud.com", "www.mixcloud.com"]);
const AUDIOMACK_HOSTS = new Set(["audiomack.com", "www.audiomack.com"]);

// Extracts and validates the 11-char video ID, then rebuilds a canonical URL so
// raw user input never reaches the yt-dlp child process.
function canonicalYouTubeUrl(input) {
  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null;

  let videoId = null;
  if (parsed.hostname.toLowerCase() === "youtu.be") {
    videoId = parsed.pathname.split("/")[1] || null;
  } else if (parsed.pathname === "/watch") {
    videoId = parsed.searchParams.get("v");
  } else {
    const pathMatch = parsed.pathname.match(/^\/(shorts|live|embed)\/([^/]+)/);
    if (pathMatch) videoId = pathMatch[2];
  }

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return null;
  return { url: `https://www.youtube.com/watch?v=${videoId}`, videoId };
}

// Validates and canonicalizes a URL across all supported platforms. Raw user
// input never reaches the yt-dlp child process — only the rebuilt, sanitized
// URL returned here does.
function validateMediaUrl(input) {
  let parsed;
  try {
    parsed = new URL(input.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const canonical = canonicalYouTubeUrl(input);
    if (!canonical) return null;
    return { url: canonical.url, platform: "YouTube" };
  }

  let platform = null;
  if (SOUNDCLOUD_HOSTS.has(host)) platform = "SoundCloud";
  else if (host.endsWith(".bandcamp.com")) platform = "Bandcamp";
  else if (VIMEO_HOSTS.has(host)) platform = "Vimeo";
  else if (MIXCLOUD_HOSTS.has(host)) platform = "Mixcloud";
  else if (AUDIOMACK_HOSTS.has(host)) platform = "Audiomack";

  if (!platform) return null;
  if (parsed.pathname.length <= 1) return null; // reject bare homepages

  const sanitized = `https://${parsed.hostname}${parsed.pathname}${parsed.search}`;
  return { url: sanitized, platform };
}

module.exports = { validateMediaUrl, canonicalYouTubeUrl };
