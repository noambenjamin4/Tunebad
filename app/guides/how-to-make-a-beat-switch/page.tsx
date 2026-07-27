import type { Metadata } from "next";
import Link from "next/link";
import { GuideShell } from "@/components/guides/GuideShell";

const TITLE = "How to Make a Beat Switch (Free, in Your Browser)";
const DESCRIPTION =
  "What a beat switch actually is, where to put it, how to line two songs up when their tempos disagree, and how to build one for free without installing a DAW.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/guides/how-to-make-a-beat-switch" },
  openGraph: { images: [{ url: "/og/guide-beat-switch.png", width: 1200, height: 630 }] },
};

export default function Page() {
  return (
    <GuideShell
      title={TITLE}
      description={DESCRIPTION}
      path="/guides/how-to-make-a-beat-switch"
      datePublished="2026-07-27"
    >
      <h1 className="legal-title">{TITLE}</h1>
      <p className="legal-updated">Updated 2026-07-27</p>

      <p>
        A beat switch is the moment one song hands over to another without the music stopping. The first track
        keeps running underneath while the second one arrives, they share a few bars, and then the first one is
        gone. That overlap is the entire effect. Cut cleanly from one file to the next and you get a jump cut, not
        a switch.
      </p>

      <h2>You need three things</h2>
      <ul>
        <li>
          <strong>Two songs on one timeline.</strong> Not two files exported separately and stuck together
          afterwards — both have to be able to sound at the same time.
        </li>
        <li>
          <strong>Visible waveforms.</strong> You are aiming at a downbeat. Doing that by typing timestamps is
          guesswork; doing it by dragging a waveform takes seconds.
        </li>
        <li>
          <strong>A way to hear it before you commit.</strong> A switch that looks right on screen is often half a
          beat off, and half a beat is the difference between a transition and a stumble.
        </li>
      </ul>

      <h2>Where to put it</h2>
      <p>
        The reliable place is a boundary the listener already expects: the end of a chorus, the last bar before a
        drop, the two bars after a verse ends and before the next one starts. Songs are built in fours, so land
        the switch on a downbeat at the top of a 4-bar or 8-bar phrase and it will feel intentional even if the two
        tracks have nothing else in common.
      </p>
      <p>
        Two to four bars of overlap is the usual range. Shorter reads as an edit; longer and the two songs start
        arguing with each other, especially if both have vocals.
      </p>

      <h2>When the tempos disagree</h2>
      <p>
        Two songs at 128 and 140 BPM will not sit together no matter where you drag them. You have to stretch one
        onto the other&apos;s tempo first. Speeding a track up or slowing it down by 5-10% is generally
        unnoticeable; past about 15% it starts to sound like an edit, which may or may not be what you want.
      </p>
      <p>
        Watch out for the octave problem: tempo detectors regularly report a 140 BPM song as 70, because both are
        defensible readings of the same drum pattern. If a match looks like it needs a 2x or 0.5x stretch,
        it usually just needs the number doubling or halving first. You can check any track&apos;s tempo with the{" "}
        <Link href="/key-bpm-finder">Key &amp; BPM Finder</Link>.
      </p>

      <h2>Build one</h2>
      <p>
        Open the free <Link href="/daw">TuneBad DAW</Link> and drop both songs in. They land end to end, each with
        its own waveform. Then:
      </p>
      <ol>
        <li>Drag the second song left until it sits over the tail of the first. Both play through the overlap.</li>
        <li>
          Press Crossfade to fade one out as the other comes in, or type your own fade lengths if you want the
          first track to stay loud right up to the handover.
        </li>
        <li>
          If the tempos disagree, the inspector says so — the project grid comes from the first clip, and Match
          stretches the second one onto it and slides it onto the beat.
        </li>
        <li>Play it. Move it. Play it again. This is the part that actually decides whether it works.</li>
        <li>Export as MP3 or WAV.</li>
      </ol>
      <p>
        Everything runs in the browser, so no files are uploaded and there is nothing to install. If you want the
        transition to drop into a filter or a slowdown, the speed, reverb and phone-effect controls can be moved
        while the timeline plays and the export reproduces the moves rather than a static setting.
      </p>

      <h2>Two mistakes worth avoiding</h2>
      <p>
        First, do not crossfade a beat switch by default. A long equal-power fade is right when you want the two
        songs to blend, and wrong when you want the new one to hit — for that, keep the outgoing track full volume
        until its last beat and let the incoming drum do the work.
      </p>
      <p>
        Second, mind the key. Two tracks a semitone apart will clash through the whole overlap however well they
        are aligned rhythmically. The <Link href="/camelot-wheel">Camelot wheel</Link> shows which keys sit
        together, and the analyzer gives you the Camelot code for any file.
      </p>

      <h2>Which tool for which job</h2>
      <p>
        If the songs simply follow one another with no overlap, the{" "}
        <Link href="/audio-joiner">Audio Joiner</Link> is quicker. If you only need one region of one file, use the{" "}
        <Link href="/mp3-cutter">MP3 Cutter</Link>. If a whole track gets the same slowed or nightcore treatment,
        the <Link href="/slowed-reverb">Slowed + Reverb studio</Link> is the direct route. The DAW is for when the
        songs have to sound at the same time.
      </p>

      <p>
        Related: <Link href="/guides/how-to-make-slowed-and-reverb">How to make a slowed + reverb edit</Link> ·{" "}
        <Link href="/guides/camelot-wheel-harmonic-mixing">The Camelot wheel, explained</Link> ·{" "}
        <Link href="/guides/find-key-and-bpm-of-any-song">How to find the key and BPM of any song</Link>
      </p>
    </GuideShell>
  );
}
