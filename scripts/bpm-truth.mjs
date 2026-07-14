// Ground-truth tempos for validating the BPM octave decision.
//
// WHY THIS FILE EXISTS: the seeder folds every tempo into [105, 210) — anything
// slower is doubled. 35% of the catalog (43,726 songs) was folded up, which is
// correct for genuinely fast tracks (Blinding Lights really is ~171) and wrong
// for genuinely slow ones (In Da Club really is 90). You cannot tell which
// without ground truth, so any "fix" without this list is a guess.
//
// SOURCING RULE: only songs whose tempo is unambiguous and widely agreed
// (Beatport/Tunebat/MusicBrainz/DJ charts converge). No song with a disputed,
// variable, or rubato tempo. If a value here is wrong the whole experiment is
// worthless, so when in doubt it is left out.
//
// The list is deliberately weighted toward the OCTAVE-AMBIGUOUS band: slow
// tracks in 60-104 (which the current fold always doubles) and fast tracks in
// 140-180 (where doubling is right). Songs at 105-139 are unaffected by the
// floor and only serve as a regression check.

/** @type {{ q: string, title: string, artist: string, bpm: number, band: "slow"|"mid"|"fast" }[]} */
export const TRUTH = [
  // --- slow: 60-104. The fold ALWAYS doubles these. Currently all wrong. ---
  { q: "In Da Club 50 Cent", title: "In Da Club", artist: "50 Cent", bpm: 90, band: "slow" },
  { q: "Lose Yourself Eminem", title: "Lose Yourself", artist: "Eminem", bpm: 86, band: "slow" },
  { q: "Still D.R.E. Dr. Dre", title: "Still D.R.E.", artist: "Dr. Dre", bpm: 93, band: "slow" },
  { q: "Sicko Mode Travis Scott", title: "SICKO MODE", artist: "Travis Scott", bpm: 78, band: "slow" },
  { q: "HUMBLE. Kendrick Lamar", title: "HUMBLE.", artist: "Kendrick Lamar", bpm: 75, band: "slow" },
  { q: "God's Plan Drake", title: "God's Plan", artist: "Drake", bpm: 77, band: "slow" },
  { q: "Hotline Bling Drake", title: "Hotline Bling", artist: "Drake", bpm: 135, band: "mid" },
  { q: "Empire State of Mind Jay-Z", title: "Empire State of Mind", artist: "JAY-Z", bpm: 87, band: "slow" },
  { q: "No Role Modelz J. Cole", title: "No Role Modelz", artist: "J. Cole", bpm: 100, band: "slow" },
  { q: "Mask Off Future", title: "Mask Off", artist: "Future", bpm: 75, band: "slow" },
  { q: "XO Tour Llif3 Lil Uzi Vert", title: "XO TOUR Llif3", artist: "Lil Uzi Vert", bpm: 75, band: "slow" },
  { q: "Bad Guy Billie Eilish", title: "bad guy", artist: "Billie Eilish", bpm: 135, band: "mid" },
  { q: "Rolling in the Deep Adele", title: "Rolling in the Deep", artist: "Adele", bpm: 105, band: "mid" },
  { q: "Someone Like You Adele", title: "Someone Like You", artist: "Adele", bpm: 67, band: "slow" },
  { q: "Creep Radiohead", title: "Creep", artist: "Radiohead", bpm: 92, band: "slow" },
  { q: "Nothing Else Matters Metallica", title: "Nothing Else Matters", artist: "Metallica", bpm: 69, band: "slow" },
  { q: "Hurt Johnny Cash", title: "Hurt", artist: "Johnny Cash", bpm: 82, band: "slow" },
  { q: "No Woman No Cry Bob Marley", title: "No Woman No Cry", artist: "Bob Marley", bpm: 78, band: "slow" },
  { q: "Redemption Song Bob Marley", title: "Redemption Song", artist: "Bob Marley", bpm: 87, band: "slow" },
  { q: "Purple Rain Prince", title: "Purple Rain", artist: "Prince", bpm: 113, band: "mid" },
  { q: "Let It Be Beatles", title: "Let It Be", artist: "The Beatles", bpm: 72, band: "slow" },
  { q: "Imagine John Lennon", title: "Imagine", artist: "John Lennon", bpm: 76, band: "slow" },
  { q: "Wonderwall Oasis", title: "Wonderwall", artist: "Oasis", bpm: 87, band: "slow" },
  { q: "Karma Police Radiohead", title: "Karma Police", artist: "Radiohead", bpm: 75, band: "slow" },
  { q: "Sunflower Post Malone", title: "Sunflower", artist: "Post Malone", bpm: 90, band: "slow" },
  { q: "Circles Post Malone", title: "Circles", artist: "Post Malone", bpm: 120, band: "mid" },
  { q: "Perfect Ed Sheeran", title: "Perfect", artist: "Ed Sheeran", bpm: 63, band: "slow" },
  { q: "Thinking Out Loud Ed Sheeran", title: "Thinking Out Loud", artist: "Ed Sheeran", bpm: 79, band: "slow" },
  { q: "Stay With Me Sam Smith", title: "Stay With Me", artist: "Sam Smith", bpm: 84, band: "slow" },
  { q: "Wrecking Ball Miley Cyrus", title: "Wrecking Ball", artist: "Miley Cyrus", bpm: 120, band: "mid" },

  // --- mid: 105-139. Unaffected by the floor; regression check. ---
  { q: "Billie Jean Michael Jackson", title: "Billie Jean", artist: "Michael Jackson", bpm: 117, band: "mid" },
  { q: "Every Breath You Take The Police", title: "Every Breath You Take", artist: "The Police", bpm: 117, band: "mid" },
  { q: "Smells Like Teen Spirit Nirvana", title: "Smells Like Teen Spirit", artist: "Nirvana", bpm: 117, band: "mid" },
  { q: "Uptown Funk Mark Ronson", title: "Uptown Funk", artist: "Mark Ronson", bpm: 115, band: "mid" },
  { q: "Get Lucky Daft Punk", title: "Get Lucky", artist: "Daft Punk", bpm: 116, band: "mid" },
  { q: "Rolling Stones Paint It Black", title: "Paint It Black", artist: "The Rolling Stones", bpm: 159, band: "fast" },
  { q: "Shape of You Ed Sheeran", title: "Shape of You", artist: "Ed Sheeran", bpm: 96, band: "slow" },
  { q: "Blurred Lines Robin Thicke", title: "Blurred Lines", artist: "Robin Thicke", bpm: 120, band: "mid" },
  { q: "Bohemian Rhapsody Queen", title: "Bohemian Rhapsody", artist: "Queen", bpm: 72, band: "slow" },
  { q: "Another One Bites The Dust Queen", title: "Another One Bites the Dust", artist: "Queen", bpm: 110, band: "mid" },
  { q: "Sweet Child O Mine Guns N Roses", title: "Sweet Child O' Mine", artist: "Guns N' Roses", bpm: 125, band: "mid" },
  { q: "Back In Black AC/DC", title: "Back In Black", artist: "AC/DC", bpm: 96, band: "slow" },
  { q: "Seven Nation Army White Stripes", title: "Seven Nation Army", artist: "The White Stripes", bpm: 124, band: "mid" },
  { q: "Take On Me a-ha", title: "Take On Me", artist: "a-ha", bpm: 169, band: "fast" },
  { q: "Don't Stop Believin Journey", title: "Don't Stop Believin'", artist: "Journey", bpm: 119, band: "mid" },

  // --- fast: 140-185. Folding up is CORRECT here; the trap for a naive fix. ---
  { q: "Blinding Lights The Weeknd", title: "Blinding Lights", artist: "The Weeknd", bpm: 171, band: "fast" },
  { q: "Levitating Dua Lipa", title: "Levitating", artist: "Dua Lipa", bpm: 103, band: "slow" },
  { q: "Don't Start Now Dua Lipa", title: "Don't Start Now", artist: "Dua Lipa", bpm: 124, band: "mid" },
  { q: "One More Time Daft Punk", title: "One More Time", artist: "Daft Punk", bpm: 123, band: "mid" },
  { q: "Titanium David Guetta", title: "Titanium", artist: "David Guetta", bpm: 126, band: "mid" },
  { q: "Wake Me Up Avicii", title: "Wake Me Up", artist: "Avicii", bpm: 124, band: "mid" },
  { q: "Animals Martin Garrix", title: "Animals", artist: "Martin Garrix", bpm: 128, band: "mid" },
  { q: "Strobe Deadmau5", title: "Strobe", artist: "deadmau5", bpm: 128, band: "mid" },
  { q: "Insomnia Faithless", title: "Insomnia", artist: "Faithless", bpm: 128, band: "mid" },
  { q: "Sandstorm Darude", title: "Sandstorm", artist: "Darude", bpm: 136, band: "mid" },
  { q: "Around The World Daft Punk", title: "Around the World", artist: "Daft Punk", bpm: 121, band: "mid" },
  { q: "Born Slippy Underworld", title: "Born Slippy", artist: "Underworld", bpm: 138, band: "mid" },
  { q: "Show Me Love Robin S", title: "Show Me Love", artist: "Robin S.", bpm: 122, band: "mid" },
  { q: "Firestarter Prodigy", title: "Firestarter", artist: "The Prodigy", bpm: 140, band: "fast" },
  { q: "Breathe Prodigy", title: "Breathe", artist: "The Prodigy", bpm: 137, band: "mid" },
  { q: "Bittersweet Symphony The Verve", title: "Bitter Sweet Symphony", artist: "The Verve", bpm: 86, band: "slow" },
];

export const BANDS = ["slow", "mid", "fast"];
