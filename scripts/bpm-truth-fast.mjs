// Ground-truth tempos, WEIGHTED TOWARD THE FAST BAND.
//
// WHY THIS FILE EXISTS. Every attempt to fix the octave decision has died on
// sample size: of 47 scorable songs in bpm-truth.mjs, only FIVE land in the
// class that matters (tracks Percival reports at half speed). You cannot learn
// a rule from five examples — any threshold that fits them is memorisation.
//
// The synthetic map (scripts/octave-map.mjs) proved the mechanism: Percival has
// a hard ceiling near 134 and reports HALF for every tempo at or above ~136,
// identically across four drum patterns. So EVERY genuinely-fast song is a
// member of the DOUBLE class. That makes the class easy to enumerate — it is
// simply "real music at 136-180 BPM" — and this file does exactly that.
//
// SOURCING RULE, unchanged and strict: only songs whose tempo is unambiguous
// and widely agreed (Beatport / MusicBrainz / DJ chart consensus converge). No
// rubato, no gradual tempo drift, no live versions, no songs with a famous
// half-time section that would make "the" tempo a matter of opinion. A wrong
// entry here does not just add noise — it actively teaches the wrong rule, and
// would make a WORSE estimator look BETTER. When in doubt, it is left out.
//
// Genres are spread on purpose. Percival's ceiling is a property of the
// ALGORITHM, so if a correction only works on four-on-the-floor house it is
// overfitting to production style rather than fixing the estimator.

/** @type {{ q: string, title: string, artist: string, bpm: number, band: "slow"|"mid"|"fast" }[]} */
export const TRUTH_FAST = [
  // --- drum & bass / jungle: 170-176, the classic halving victims ---
  { q: "Original Nuttah UK Apache Shy FX", title: "Original Nuttah", artist: "UK Apache & Shy FX", bpm: 170, band: "fast" },
  { q: "Inner City Life Goldie", title: "Inner City Life", artist: "Goldie", bpm: 172, band: "fast" },
  { q: "Circles Adam F", title: "Circles", artist: "Adam F", bpm: 174, band: "fast" },
  { q: "Brown Paper Bag Roni Size", title: "Brown Paper Bag", artist: "Roni Size", bpm: 172, band: "fast" },

  // --- hardcore / gabber / trance: 140-175 ---
  { q: "Anasthasia T99", title: "Anasthasia", artist: "T99", bpm: 140, band: "fast" },
  { q: "Dominator Human Resource", title: "Dominator", artist: "Human Resource", bpm: 150, band: "fast" },
  { q: "Age of Love", title: "The Age of Love", artist: "Age of Love", bpm: 140, band: "fast" },
  { q: "Adagio for Strings Tiesto", title: "Adagio for Strings", artist: "Tiësto", bpm: 140, band: "fast" },
  { q: "For An Angel Paul van Dyk", title: "For an Angel", artist: "Paul van Dyk", bpm: 136, band: "fast" },
  { q: "Sadeness Enigma", title: "Sadeness", artist: "Enigma", bpm: 100, band: "slow" },

  // --- punk / hardcore / metal: fast rock, no four-on-the-floor ---
  { q: "Blitzkrieg Bop Ramones", title: "Blitzkrieg Bop", artist: "Ramones", bpm: 177, band: "fast" },
  { q: "Holiday in Cambodia Dead Kennedys", title: "Holiday in Cambodia", artist: "Dead Kennedys", bpm: 148, band: "fast" },
  // Above the [60,180) ceiling: exercises the fold-DOWN path, not the halving
  // class. Kept deliberately — the fix must not break these either.
  { q: "Master of Puppets Metallica", title: "Master of Puppets", artist: "Metallica", bpm: 212, band: "fast" },
  { q: "Ace of Spades Motorhead", title: "Ace of Spades", artist: "Motörhead", bpm: 143, band: "fast" },
  { q: "Basket Case Green Day", title: "Basket Case", artist: "Green Day", bpm: 169, band: "fast" },
  { q: "American Idiot Green Day", title: "American Idiot", artist: "Green Day", bpm: 186, band: "fast" },
  { q: "Should I Stay or Should I Go Clash", title: "Should I Stay or Should I Go", artist: "The Clash", bpm: 113, band: "mid" },
  { q: "Highway to Hell AC/DC", title: "Highway to Hell", artist: "AC/DC", bpm: 116, band: "mid" },

  // --- disco / funk / soul at genuinely fast tempos ---
  { q: "Stayin Alive Bee Gees", title: "Stayin' Alive", artist: "Bee Gees", bpm: 104, band: "slow" },
  { q: "I Feel Love Donna Summer", title: "I Feel Love", artist: "Donna Summer", bpm: 124, band: "mid" },
  { q: "Le Freak Chic", title: "Le Freak", artist: "Chic", bpm: 121, band: "mid" },
  { q: "September Earth Wind Fire", title: "September", artist: "Earth, Wind & Fire", bpm: 126, band: "mid" },
  { q: "Papa's Got A Brand New Bag James Brown", title: "Papa's Got a Brand New Bag", artist: "James Brown", bpm: 131, band: "mid" },

  // --- pop / rock at 140-180 ---
  { q: "Mr. Brightside The Killers", title: "Mr. Brightside", artist: "The Killers", bpm: 148, band: "fast" },
  { q: "I Bet You Look Good on the Dancefloor Arctic Monkeys", title: "I Bet You Look Good on the Dancefloor", artist: "Arctic Monkeys", bpm: 103, band: "slow" },
  { q: "Dancing Queen ABBA", title: "Dancing Queen", artist: "ABBA", bpm: 101, band: "slow" },
  { q: "Africa Toto", title: "Africa", artist: "Toto", bpm: 93, band: "slow" },
  { q: "Sweet Dreams Eurythmics", title: "Sweet Dreams (Are Made of This)", artist: "Eurythmics", bpm: 126, band: "mid" },
  { q: "Enter Sandman Metallica", title: "Enter Sandman", artist: "Metallica", bpm: 123, band: "mid" },
  { q: "Livin on a Prayer Bon Jovi", title: "Livin' on a Prayer", artist: "Bon Jovi", bpm: 123, band: "mid" },
  { q: "Jump Van Halen", title: "Jump", artist: "Van Halen", bpm: 130, band: "mid" },
  { q: "You Shook Me All Night Long AC/DC", title: "You Shook Me All Night Long", artist: "AC/DC", bpm: 127, band: "mid" },

  // --- house / techno at 128-140 (just over Percival's ceiling) ---
  { q: "Da Funk Daft Punk", title: "Da Funk", artist: "Daft Punk", bpm: 110, band: "mid" },
  { q: "Windowlicker Aphex Twin", title: "Windowlicker", artist: "Aphex Twin", bpm: 100, band: "slow" },
  { q: "Blue Monday New Order", title: "Blue Monday", artist: "New Order", bpm: 130, band: "mid" },
  { q: "Right Here Right Now Fatboy Slim", title: "Right Here, Right Now", artist: "Fatboy Slim", bpm: 130, band: "mid" },
  { q: "Praise You Fatboy Slim", title: "Praise You", artist: "Fatboy Slim", bpm: 122, band: "mid" },
  { q: "Block Rockin Beats Chemical Brothers", title: "Block Rockin' Beats", artist: "The Chemical Brothers", bpm: 128, band: "mid" },
  { q: "Setting Sun Chemical Brothers", title: "Setting Sun", artist: "The Chemical Brothers", bpm: 130, band: "mid" },
  { q: "Galvanize Chemical Brothers", title: "Galvanize", artist: "The Chemical Brothers", bpm: 105, band: "mid" },
  { q: "Satisfaction Benny Benassi", title: "Satisfaction", artist: "Benny Benassi", bpm: 130, band: "mid" },
  { q: "Levels Avicii", title: "Levels", artist: "Avicii", bpm: 126, band: "mid" },

  // --- more genuinely-slow anchors, so a fast-biased fix cannot hide ---
  { q: "Gangsta's Paradise Coolio", title: "Gangsta's Paradise", artist: "Coolio", bpm: 80, band: "slow" },
  { q: "Nuthin but a G Thang Dr Dre", title: "Nuthin' but a 'G' Thang", artist: "Dr. Dre", bpm: 97, band: "slow" },
  { q: "California Love 2Pac", title: "California Love", artist: "2Pac", bpm: 92, band: "slow" },
  { q: "Juicy Notorious BIG", title: "Juicy", artist: "The Notorious B.I.G.", bpm: 94, band: "slow" },
  { q: "N.Y. State of Mind Nas", title: "N.Y. State of Mind", artist: "Nas", bpm: 87, band: "slow" },
  { q: "Ms. Jackson Outkast", title: "Ms. Jackson", artist: "OutKast", bpm: 95, band: "slow" },
  { q: "Hey Ya Outkast", title: "Hey Ya!", artist: "OutKast", bpm: 79, band: "slow" },
  { q: "Crazy Gnarls Barkley", title: "Crazy", artist: "Gnarls Barkley", bpm: 112, band: "mid" },
  { q: "Seven Nation Army White Stripes", title: "Seven Nation Army", artist: "The White Stripes", bpm: 124, band: "mid" },
  { q: "Feel Good Inc Gorillaz", title: "Feel Good Inc.", artist: "Gorillaz", bpm: 138, band: "fast" },
  { q: "Clint Eastwood Gorillaz", title: "Clint Eastwood", artist: "Gorillaz", bpm: 82, band: "slow" },
];
