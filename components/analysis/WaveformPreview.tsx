"use client";

import { useEffect, useRef, useState } from "react";
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
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
  }, [previewUrl]);

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
        currentTime={currentTime}
        duration={duration}
        playing={playing}
        onTogglePlay={() => void togglePlayback()}
        onSeek={(seconds) => {
          if (audioRef.current) audioRef.current.currentTime = seconds;
          setCurrentTime(seconds);
        }}
        disabled={!previewUrl}
      />
      <audio
        ref={audioRef}
        src={previewUrl ?? undefined}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onEnded={() => setPlaying(false)}
      />
    </div>
  );
}
