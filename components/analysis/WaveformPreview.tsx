"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SeekableWaveform } from "@/components/ui/SeekableWaveform";
import { useI18n } from "@/lib/i18n";

export function WaveformPreview({
  bars,
  previewUrl,
  duration,
}: {
  bars: number[];
  previewUrl: string | null;
  duration: number;
}) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(false);
  }, [previewUrl]);

  const getCurrentTime = useCallback(() => audioRef.current?.currentTime ?? 0, []);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !previewUrl) return;
    if (audio.paused) {
      await audio.play();
      setPlaying(true);
    } else {
      audio.pause();
      setPlaying(false);
    }
  };

  return (
    <div className="wave-card" aria-label={t("analysis.audioPreview")}>
      <SeekableWaveform
        bars={bars}
        duration={duration}
        playing={playing}
        getCurrentTime={getCurrentTime}
        onTogglePlay={() => void togglePlayback()}
        onSeek={(seconds) => {
          // SeekableWaveform already applies the CSS var + display time
          // immediately for its own seek sources (pointer drag, keyboard);
          // this just moves the actual audio element's playback position.
          if (audioRef.current) audioRef.current.currentTime = seconds;
        }}
        disabled={!previewUrl}
      />
      <audio
        ref={audioRef}
        src={previewUrl ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
