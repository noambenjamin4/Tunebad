// Camelot-wheel harmonic mixing helpers. The wheel places the 24 keys on a
// clock (1-12) with an inner ring "A" (minor) and outer ring "B" (major). Two
// tracks mix smoothly when their Camelot codes are the same, one step around
// the wheel, or the relative major/minor (same number, other letter).

export type CamelotCode = string; // e.g. "8B", "11A"

function parse(code: string): { n: number; letter: "A" | "B" } | null {
  const m = /^(1[0-2]|[1-9])([AB])$/.exec(code.trim().toUpperCase());
  if (!m) return null;
  return { n: Number(m[1]), letter: m[2] as "A" | "B" };
}

const wrap = (n: number): number => ((n - 1 + 12) % 12) + 1;

/**
 * The classic compatible-mix set for a Camelot code, in DJ-friendly order:
 * same key, energy up (+1), energy down (-1), and the relative major/minor.
 * Returns [] for an unknown code.
 */
export function camelotNeighbors(code: string): CamelotCode[] {
  const p = parse(code);
  if (!p) return [];
  return [
    `${p.n}${p.letter}`,
    `${wrap(p.n + 1)}${p.letter}`,
    `${wrap(p.n - 1)}${p.letter}`,
    `${p.n}${p.letter === "A" ? "B" : "A"}`,
  ];
}

/**
 * Will these two mix in key? True for the same code, one step either way
 * around the wheel, or the relative major/minor — the four-neighbour set DJs
 * actually use. Unknown or unparseable codes return false rather than a
 * cheerful guess: claiming two songs are in key when nobody knows is worse
 * than saying nothing.
 */
export function keysMix(a: string, b: string): boolean {
  const options = camelotNeighbors(a);
  if (options.length === 0) return false;
  return options.includes(b.trim().toUpperCase());
}

/** Compatible codes excluding the track's own key (for "mix it with" lists). */
export function compatibleCodes(code: string): CamelotCode[] {
  const p = parse(code);
  if (!p) return [];
  return camelotNeighbors(code).filter((c) => c !== `${p.n}${p.letter}`);
}

/** The 24 canonical keys, in Camelot-wheel order (1A..12A, 1B..12B). */
export const ALL_KEYS = [
  "G# Minor", "D# Minor", "A# Minor", "F Minor", "C Minor", "G Minor",
  "D Minor", "A Minor", "E Minor", "B Minor", "F# Minor", "C# Minor",
  "B Major", "F# Major", "C# Major", "G# Major", "D# Major", "A# Major",
  "F Major", "C Major", "G Major", "D Major", "A Major", "E Major",
] as const;

/** "G# Minor" -> "g-sharp-minor" (URL slug for key hub pages). */
export function keyToSlug(key: string): string {
  return key.toLowerCase().replace("#", "-sharp").replace(/\s+/g, "-");
}

/** "g-sharp-minor" -> "G# Minor", or null for anything not a canonical key. */
export function slugToKey(slug: string): string | null {
  const match = ALL_KEYS.find((k) => keyToSlug(k) === slug);
  return match ?? null;
}

// The Camelot wheel IS the circle of fifths, which is what makes transposition
// arithmetic on it trivial: one semitone up = seven fifths up = seven steps
// clockwise. (Check: C Major is 8B, C# Major is 3B; 8 + 7 = 15 wraps to 3.)
const WHEEL_STEPS_PER_SEMITONE = 7;

/** "8B" transposed +1 semitone -> "3B". Unknown codes return null. */
export function transposeCode(code: string, semitones: number): CamelotCode | null {
  const p = parse(code);
  if (!p) return null;
  // Normalise first: -1 % 12 is -1 in JS, wrap() expects small overshoots.
  const steps = ((semitones % 12) + 12) % 12;
  return `${wrap(p.n + steps * WHEEL_STEPS_PER_SEMITONE)}${p.letter}`;
}

const NOTE_ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

/** "A Minor" transposed +3 -> "C Minor". Unknown keys return null. */
export function transposeKey(key: string, semitones: number): string | null {
  const m = /^([A-G]#?) (Major|Minor)$/.exec(key.trim());
  if (!m) return null;
  const idx = NOTE_ORDER.indexOf(m[1]);
  if (idx < 0) return null;
  const next = NOTE_ORDER[(((idx + semitones) % 12) + 12) % 12];
  return `${next} ${m[2]}`;
}

/**
 * The smallest pitch shift, in semitones, that makes `here` mix with `there`
 * on the wheel — 0 when they already mix, positive preferred over negative on
 * a tie (a slight lift reads better than a drop), null when nothing within
 * ±6 fits or a code is unknown. Pure wheel arithmetic: no shift is "found"
 * by trying what a re-analysis would say, so the suggestion can't disagree
 * with the transposition that acts on it.
 */
export function semitonesToFit(here: string, there: string): number | null {
  if (!parse(here) || !parse(there)) return null;
  for (let d = 0; d <= 6; d++) {
    for (const s of d === 0 ? [0] : [d, -d]) {
      const shifted = transposeCode(here, s);
      if (shifted && keysMix(shifted, there)) return s;
    }
  }
  return null;
}

/** Plain-language label for how a neighbor relates to the source key. */
export function relationLabel(fromCode: string, toCode: string): string {
  const a = parse(fromCode);
  const b = parse(toCode);
  if (!a || !b) return "compatible";
  if (a.n === b.n && a.letter === b.letter) return "same key";
  if (a.n === b.n) return a.letter === "A" ? "relative major" : "relative minor";
  if (wrap(a.n + 1) === b.n) return "energy boost";
  if (wrap(a.n - 1) === b.n) return "energy drop";
  return "compatible";
}
