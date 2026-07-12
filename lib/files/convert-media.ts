// Client-side any-to-any media conversion on the same ffmpeg.wasm instance
// the video compressor uses (see lib/files/video.ts for the CSP notes: plain
// same-origin core URLs, WORKERFS input mounts). Files never leave the
// visitor's device.

import { loadFFmpeg } from "./video";

export const CONVERT_AUDIO_MAX_BYTES = 200 * 1024 * 1024;

export class ConvertError extends Error {}

export type VideoFormat = "mp4" | "webm" | "mkv" | "mov" | "avi" | "flv" | "wmv";
export type AudioFormat = "mp3" | "wav" | "flac" | "ogg" | "m4a";
export type MediaFormat = VideoFormat | AudioFormat;

// libx264 with yuv420p (and the legacy mpeg4/flv/wmv2 encoders) reject odd
// frame sizes, and screen or camera captures can be any size — force even.
const EVEN_SCALE = "scale=trunc(iw/2)*2:trunc(ih/2)*2";

// Every entry here has been E2E-verified against the vendored @ffmpeg/core
// build (a format button never ships without a successful conversion).
// WebM is VP8 on purpose: single-threaded VP9 is unusably slow in wasm.
const VIDEO_TABLE: Record<VideoFormat, { mime: string; args: string[] }> = {
  mp4: {
    mime: "video/mp4",
    args: [
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-vf", EVEN_SCALE,
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
    ],
  },
  webm: {
    mime: "video/webm",
    args: [
      "-c:v", "libvpx", "-b:v", "1M", "-deadline", "realtime", "-cpu-used", "5",
      "-vf", EVEN_SCALE, "-c:a", "libvorbis",
    ],
  },
  mkv: {
    mime: "video/x-matroska",
    args: [
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-vf", EVEN_SCALE,
      "-c:a", "aac", "-b:a", "128k",
    ],
  },
  mov: {
    mime: "video/quicktime",
    args: [
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
      "-pix_fmt", "yuv420p", "-vf", EVEN_SCALE,
      "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", "-f", "mov",
    ],
  },
  avi: {
    mime: "video/x-msvideo",
    args: [
      "-c:v", "mpeg4", "-qscale:v", "5", "-vf", EVEN_SCALE,
      "-c:a", "libmp3lame", "-b:a", "128k",
    ],
  },
  flv: {
    mime: "video/x-flv",
    // FLV audio only allows 44100/22050/11025 Hz — force 44100.
    args: [
      "-c:v", "flv", "-qscale:v", "5", "-vf", EVEN_SCALE,
      "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
    ],
  },
  wmv: {
    mime: "video/x-ms-wmv",
    args: [
      "-c:v", "wmv2", "-qscale:v", "5", "-vf", EVEN_SCALE,
      "-c:a", "wmav2",
    ],
  },
};

// `-vn` strips embedded cover art (an MP3/FLAC picture is a video stream to
// ffmpeg and would otherwise derail a pure-audio mux).
function audioArgs(format: AudioFormat, mp3Kbps: number): string[] {
  switch (format) {
    case "mp3": return ["-vn", "-c:a", "libmp3lame", "-b:a", `${mp3Kbps}k`];
    case "wav": return ["-vn", "-c:a", "pcm_s16le"];
    case "flac": return ["-vn", "-c:a", "flac"];
    case "ogg": return ["-vn", "-c:a", "libvorbis", "-q:a", "5"];
    case "m4a": return ["-vn", "-c:a", "aac", "-b:a", "192k", "-f", "ipod"];
  }
}

const AUDIO_MIME: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
};

export type ConvertProgress = { ratio: number };

export function convertedName(name: string, format: MediaFormat): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}.${format}`;
}

/** Convert `file` to `format`, reporting encode progress (0..1). */
export async function convertMedia(
  file: File,
  format: MediaFormat,
  options: { mp3Kbps?: number; onProgress?: (p: ConvertProgress) => void } = {},
): Promise<Blob> {
  const { ffmpeg, FFFSType } = await loadFFmpeg();
  const video = format in VIDEO_TABLE;
  const args = video
    ? VIDEO_TABLE[format as VideoFormat].args
    : audioArgs(format as AudioFormat, options.mp3Kbps ?? 320);
  const mime = video ? VIDEO_TABLE[format as VideoFormat].mime : AUDIO_MIME[format as AudioFormat];

  const progressHandler = (ev: { progress: number }) => {
    // ffmpeg reports 0..1 (occasionally outside that range on streams with no
    // duration header, e.g. MediaRecorder webm); clamp for the UI.
    options.onProgress?.({ ratio: Math.max(0, Math.min(1, ev.progress)) });
  };
  ffmpeg.on("progress", progressHandler);

  const out = `/out.${format}`;
  try {
    // The mount dir can survive a previous conversion (unmount does not rmdir).
    try {
      await ffmpeg.createDir("/work");
    } catch {
      // already exists
    }
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, "/work");
    const code = await ffmpeg.exec(["-i", `/work/${file.name}`, ...args, "-y", out]);
    if (code !== 0) throw new ConvertError();
    const data = (await ffmpeg.readFile(out)) as Uint8Array;
    await ffmpeg.deleteFile(out);
    if (data.byteLength < 1024) throw new ConvertError();
    // Copy out of the wasm heap before unmount/cleanup.
    return new Blob([new Uint8Array(data)], { type: mime });
  } finally {
    ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.unmount("/work");
    } catch {
      // mount may not exist after a crash
    }
  }
}
