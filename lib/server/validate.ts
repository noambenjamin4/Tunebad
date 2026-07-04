import { z } from "zod";

export { validateMediaUrl } from "@/lib/media-url";

const AUDIO_QUALITIES = ["320", "256", "192", "128"] as const;
const VIDEO_QUALITIES = ["1080", "720", "480"] as const;

export const startJobSchema = z
  .object({
    url: z.string().max(2048),
    quality: z.enum(["320", "256", "192", "128", "1080", "720", "480"]),
    format: z.enum(["mp3", "wav", "mp4"]).default("mp3"),
    trimSilence: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
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
