// Homepage-only SEO + positioning section. Renders below the tool (below the
// fold) so it never clutters the tool-first UI, but gives Google indexable,
// keyword-rich content, the free/no-ads/no-sign-up wedge, and an FAQ that is
// eligible for rich results (matching FAQPage JSON-LD below, content visible).

const VALUES: { title: string; body: string }[] = [
  { title: "100% free", body: "Every tool, forever. No trials, no paywalls, no premium tier." },
  { title: "No ads, no sign-up", body: "No account, no pop-ups, no clutter — just the tools." },
  { title: "Private by default", body: "Audio analysis runs entirely in your browser. Your files never leave your device." },
  { title: "All in one place", body: "Key & BPM, converter, loudness, slowed + reverb, pitch, and delay — one clean toolkit." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "How do I find the key and BPM of a song?",
    a: "Open the Key & BPM Finder and upload an audio file. TuneBad detects the musical key, tempo (BPM), Camelot code, energy, and loudness in a few seconds — no account needed.",
  },
  {
    q: "Is TuneBad free?",
    a: "Yes. Every tool is completely free to use, with no ads and no sign-up. There is no premium tier or hidden paywall.",
  },
  {
    q: "Can I convert a YouTube or Spotify link to MP3?",
    a: "Yes. Paste a YouTube, Spotify, or SoundCloud link into the Converter and download it as MP3, WAV, or MP4. It is intended for personal use only.",
  },
  {
    q: "Is my audio uploaded to a server?",
    a: "No. Audio analysis (key, BPM, loudness) runs entirely in your browser, so your files never leave your device.",
  },
  {
    q: "How accurate is the BPM and key detection?",
    a: "TuneBad uses the same professional music-analysis engine (essentia) as leading tools. Because half-time and double-time tempos are genuinely ambiguous, both are shown together so you always see the right one.",
  },
  {
    q: "What is slowed + reverb?",
    a: "Slowed + reverb is a popular remix style that slows a track down and adds reverb for a dreamy, spacious sound. You can make one for free in the Slowed + Reverb studio, then export it.",
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function LandingSeo() {
  return (
    <section className="seo-landing" aria-label="About TuneBad">
      <div className="seo-inner">
        <h2 className="seo-heading">A free, all-in-one music toolkit</h2>
        <p className="seo-lede">
          TuneBad helps producers, DJs, and anyone who works with audio find the key, BPM, and loudness of any song,
          convert YouTube, Spotify, and SoundCloud links to MP3, WAV, or MP4, make slowed + reverb edits, shift pitch,
          and calculate delay times — free, with no ads and no sign-up, right in your browser.
        </p>

        <ul className="seo-values">
          {VALUES.map((v) => (
            <li key={v.title} className="seo-value">
              <h3>{v.title}</h3>
              <p>{v.body}</p>
            </li>
          ))}
        </ul>

        <h2 className="seo-heading seo-heading-faq">Frequently asked questions</h2>
        <div className="seo-faq">
          {FAQS.map((f) => (
            <details key={f.q} className="seo-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }} />
    </section>
  );
}
