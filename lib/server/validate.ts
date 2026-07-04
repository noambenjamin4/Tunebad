import { z } from "zod";

export { validateMediaUrl } from "@/lib/media-url";

export const startJobSchema = z.object({
  url: z.string().max(2048),
  quality: z.enum(["320", "256", "192", "128"]),
  format: z.enum(["mp3", "wav"]).default("mp3"),
  trimSilence: z.boolean().default(true),
});

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
