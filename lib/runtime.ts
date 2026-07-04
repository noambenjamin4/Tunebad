// Feature flags for the link downloader, which shells out to yt-dlp/ffmpeg
// and can't run in a serverless deployment (e.g. Vercel). Both must be
// explicitly enabled to expose the downloader; by default it's off so a
// production deploy is safe with zero configuration.

// Server-side: gates the /api/youtube/* route handlers.
export const isDownloaderEnabled = process.env.ENABLE_LINK_DOWNLOADER === "1";

// Client-side: gates whether the UI even offers the link-download card.
// Must be NEXT_PUBLIC_ to be readable in the browser bundle.
export const downloaderVisible = process.env.NEXT_PUBLIC_DOWNLOADER === "1";
