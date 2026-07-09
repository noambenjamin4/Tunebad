import { z } from "zod";

export { validateMediaUrl } from "@/lib/media-url";

const AUDIO_QUALITIES = ["320", "256", "192", "128"] as const;
const VIDEO_QUALITIES = ["1080", "720", "480"] as const;

// Printable-only, single-line: this string becomes a single argv element
// passed to yt-dlp as `ytsearch1:<query>` (shell:false, after `--`), never
// interpolated into a shell string — but it's still worth rejecting control
// characters so it can't corrupt progress-line parsing or log output.
const PRINTABLE_QUERY_PATTERN = /^[^\x00-\x1f\x7f]+$/;

export const startJobSchema = z
  .object({
    url: z.string().max(2048).optional(),
    query: z.string().min(1).max(300).regex(PRINTABLE_QUERY_PATTERN, "query must not contain control characters").optional(),
    quality: z.enum(["320", "256", "192", "128", "1080", "720", "480"]),
    format: z.enum(["mp3", "wav", "m4a", "opus", "mp4"]).default("mp3"),
    trimSilence: z.boolean().default(true),
  })
  .refine((data) => Boolean(data.url) !== Boolean(data.query), {
    message: "Provide exactly one of url or query.",
    path: ["url"],
  })
  .superRefine((data, ctx) => {
    // Search-query jobs (Spotify-matched tracks) are audio only — mp4 doesn't
    // make sense for a text search against YouTube in this flow.
    if (data.query && data.format === "mp4") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["format"],
        message: "format must be an audio format when using a search query",
      });
      return;
    }
    const validQualities: readonly string[] = data.format === "mp4" ? VIDEO_QUALITIES : AUDIO_QUALITIES;
    if (!validQualities.includes(data.quality)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quality"],
        message:
          data.format === "mp4"
            ? `quality must be one of ${VIDEO_QUALITIES.join(", ")} when format is mp4`
            : `quality must be one of ${AUDIO_QUALITIES.join(", ")} when format is ${data.format}`,
      });
    }
  });

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
