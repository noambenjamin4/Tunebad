// Client-side video compression on ffmpeg.wasm (single-threaded core — no
// SharedArrayBuffer, so no COOP/COEP headers needed). The core is the
// unmodified official GPL build from https://github.com/ffmpegwasm/ffmpeg.wasm,
// self-hosted under /public/vendor/ffmpeg because the CSP's connect-src only
// allows same-origin fetches. Videos never leave the visitor's device.

export const VIDEO_MAX_BYTES = 500 * 1024 * 1024;
export const VIDEO_IOS_WARN_BYTES = 300 * 1024 * 1024;

export class VideoTooLargeError extends Error {}
export class VideoDurationError extends Error {}
export class VideoMemoryError extends Error {}

type FFmpegLike = {
  load(options: { coreURL: string; wasmURL: string }): Promise<boolean>;
  mount(fsType: unknown, options: { files: File[] }, mountPoint: string): Promise<boolean>;
  unmount(mountPoint: string): Promise<boolean>;
  createDir(path: string): Promise<boolean>;
  exec(args: string[]): Promise<number>;
  readFile(path: string): Promise<Uint8Array | string>;
  deleteFile(path: string): Promise<boolean>;
  terminate(): void;
  on(event: "progress", cb: (ev: { progress: number; time: number }) => void): void;
  off(event: "progress", cb: (ev: { progress: number; time: number }) => void): void;
};

let ffmpegPromise: Promise<{ ffmpeg: FFmpegLike; FFFSType: { WORKERFS: unknown } }> | null = null;

/**
 * Cached loader (same pattern as loadSoundTouch). Plain same-origin URLs —
 * @ffmpeg/util's toBlobURL would mint blob: script URLs the CSP blocks.
 */
export function loadFFmpeg(): Promise<{ ffmpeg: FFmpegLike; FFFSType: { WORKERFS: unknown } }> {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const mod = await import("@ffmpeg/ffmpeg");
      const ffmpeg = new mod.FFmpeg() as unknown as FFmpegLike;
      await ffmpeg.load({
        coreURL: "/vendor/ffmpeg/ffmpeg-core.js",
        wasmURL: "/vendor/ffmpeg/ffmpeg-core.wasm",
      });
      // The enum's runtime value is the string "WORKERFS"; fall back to the
      // literal so a packaging quirk can't hand mount() an undefined type.
      const fsTypes = (mod as { FFFSType?: { WORKERFS?: unknown } }).FFFSType;
      return { ffmpeg, FFFSType: { WORKERFS: fsTypes?.WORKERFS ?? "WORKERFS" } };
    })().catch((error) => {
      // Failed loads must not poison the cache; allow a retry.
      ffmpegPromise = null;
      throw error;
    });
  }
  return ffmpegPromise;
}

/** Drop the cached instance (after a crash/OOM the worker is unusable). */
export function resetFFmpeg(): void {
  if (ffmpegPromise) {
    void ffmpegPromise.then(({ ffmpeg }) => {
      try {
        ffmpeg.terminate();
      } catch {
        // already dead
      }
    }).catch(() => {});
  }
  ffmpegPromise = null;
}

/** Duration in seconds via a metadata-only <video> decode (no ffmpeg needed). */
export function probeDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      if (Number.isFinite(video.duration) && video.duration > 0) resolve(video.duration);
      else reject(new VideoDurationError());
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new VideoDurationError());
    };
    video.src = url;
  });
}

export type CompressProgress = { ratio: number };

/**
 * Compress `file` to at most `targetMB`, reporting progress. Single pass with
 * one corrective retry: video bitrate from the size budget minus 96kbps audio
 * and 7% mux headroom; 720p cap for small targets, 1080p for roomier ones.
 */
export async function compressToTargetSize(
  file: File,
  targetMB: number,
  durationSec: number,
  onProgress: (p: CompressProgress) => void,
): Promise<Blob> {
  if (file.size > VIDEO_MAX_BYTES) throw new VideoTooLargeError();
  const { ffmpeg, FFFSType } = await loadFFmpeg();

  const heightCap = targetMB >= 25 ? 1080 : 720;
  let videoKbps = Math.max(100, Math.round((targetMB * 8192 * 0.93) / durationSec - 96));

  const progressHandler = (ev: { progress: number }) => {
    // ffmpeg reports 0..1 (occasionally >1 on the tail); clamp for the UI.
    onProgress({ ratio: Math.max(0, Math.min(1, ev.progress)) });
  };
  ffmpeg.on("progress", progressHandler);

  try {
    await ffmpeg.createDir("/work");
    await ffmpeg.mount(FFFSType.WORKERFS, { files: [file] }, "/work");

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const args = [
        "-i", `/work/${file.name}`,
        "-c:v", "libx264",
        "-b:v", `${videoKbps}k`,
        "-maxrate", `${Math.round(videoKbps * 1.5)}k`,
        "-bufsize", `${videoKbps * 2}k`,
        "-preset", "veryfast",
        "-vf", `scale=-2:'min(${heightCap},ih)'`,
        "-r", "30",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "96k",
        "-movflags", "+faststart",
        "-y", "/out.mp4",
      ];
      const code = await ffmpeg.exec(args);
      if (code !== 0) throw new VideoMemoryError();

      const data = (await ffmpeg.readFile("/out.mp4")) as Uint8Array;
      await ffmpeg.deleteFile("/out.mp4");
      if (data.byteLength <= targetMB * 1024 * 1024 || attempt === 1) {
        // Copy out of the wasm heap before unmount/cleanup.
        return new Blob([new Uint8Array(data)], { type: "video/mp4" });
      }
      // Rare with the 7% headroom: tighten the bitrate once and re-encode.
      videoKbps = Math.max(100, Math.round((videoKbps * (targetMB * 1024 * 1024)) / data.byteLength * 0.95));
    }
    throw new VideoMemoryError();
  } finally {
    ffmpeg.off("progress", progressHandler);
    try {
      await ffmpeg.unmount("/work");
    } catch {
      // mount may not exist after a crash
    }
  }
}

export function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function compressedName(name: string, targetMB: number): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base}-${targetMB}mb.mp4`;
}
