// Ground-truth KEYS for validating the key detector.
//
// SOURCING RULE, and it is stricter than the BPM list: key is more disputed
// than tempo, and the classic failure is naming the RELATIVE major/minor (C
// Major vs A Minor share all seven notes — a detector picking the wrong one
// isn't hearing wrong, it's resolving the tonic wrong). So only songs whose
// tonic is unambiguous and widely agreed are here. Anything modal, anything
// that modulates through the chorus, anything where sources disagree, is out.
// A wrong entry here would make a worse detector look better, so when in doubt
// it is left out.
//
// `key` is the full "Root Scale" string the analyzer emits (sharps, not flats —
// the worker maps flats to sharps via FLAT_TO_SHARP).

/** @type {{ q: string, title: string, key: string, genre: "electronic"|"pop"|"rock"|"hiphop"|"other" }[]} */
export const KEY_TRUTH = [
  // --- unambiguous minors ---
  { q: "Billie Jean Michael Jackson", title: "Billie Jean", key: "F# Minor", genre: "pop" },
  { q: "Smells Like Teen Spirit Nirvana", title: "Smells Like Teen Spirit", key: "F Minor", genre: "rock" },
  { q: "Seven Nation Army White Stripes", title: "Seven Nation Army", key: "E Minor", genre: "rock" },
  { q: "Rolling in the Deep Adele", title: "Rolling in the Deep", key: "C Minor", genre: "pop" },
  { q: "Shape of You Ed Sheeran", title: "Shape of You", key: "C# Minor", genre: "pop" },
  { q: "Blinding Lights The Weeknd", title: "Blinding Lights", key: "F Minor", genre: "pop" },
  { q: "Get Lucky Daft Punk", title: "Get Lucky", key: "B Minor", genre: "electronic" },
  { q: "Levitating Dua Lipa", title: "Levitating", key: "B Minor", genre: "pop" },
  { q: "Don't Start Now Dua Lipa", title: "Don't Start Now", key: "B Minor", genre: "pop" },
  { q: "Hotel California Eagles", title: "Hotel California", key: "B Minor", genre: "rock" },
  { q: "Stairway to Heaven Led Zeppelin", title: "Stairway to Heaven", key: "A Minor", genre: "rock" },
  { q: "Wonderwall Oasis", title: "Wonderwall", key: "F# Minor", genre: "rock" },
  { q: "Uptown Funk Mark Ronson", title: "Uptown Funk", key: "D Minor", genre: "pop" },
  { q: "bad guy Billie Eilish", title: "bad guy", key: "G Minor", genre: "pop" },
  { q: "Losing My Religion R.E.M.", title: "Losing My Religion", key: "A Minor", genre: "rock" },
  { q: "Zombie Cranberries", title: "Zombie", key: "E Minor", genre: "rock" },
  { q: "Titanium David Guetta Sia", title: "Titanium", key: "E Minor", genre: "electronic" },
  { q: "Wake Me Up Avicii", title: "Wake Me Up", key: "B Minor", genre: "electronic" },
  { q: "Animals Martin Garrix", title: "Animals", key: "F Minor", genre: "electronic" },
  { q: "Strobe deadmau5", title: "Strobe", key: "B Minor", genre: "electronic" },
  { q: "Insomnia Faithless", title: "Insomnia", key: "F# Minor", genre: "electronic" },
  { q: "Sandstorm Darude", title: "Sandstorm", key: "B Minor", genre: "electronic" },
  { q: "Clocks Coldplay", title: "Clocks", key: "D Minor", genre: "rock" },
  { q: "Boulevard of Broken Dreams Green Day", title: "Boulevard of Broken Dreams", key: "F Minor", genre: "rock" },
  { q: "In the End Linkin Park", title: "In the End", key: "E Minor", genre: "rock" },
  { q: "Numb Linkin Park", title: "Numb", key: "F# Minor", genre: "rock" },
  { q: "Nothing Else Matters Metallica", title: "Nothing Else Matters", key: "E Minor", genre: "rock" },
  { q: "Enter Sandman Metallica", title: "Enter Sandman", key: "E Minor", genre: "rock" },
  { q: "Roxanne The Police", title: "Roxanne", key: "G Minor", genre: "rock" },

  // --- unambiguous majors ---
  { q: "Let It Be Beatles", title: "Let It Be", key: "C Major", genre: "rock" },
  { q: "Imagine John Lennon", title: "Imagine", key: "C Major", genre: "rock" },
  { q: "Sweet Child O Mine Guns N Roses", title: "Sweet Child O' Mine", key: "D Major", genre: "rock" },
  { q: "Back In Black AC/DC", title: "Back In Black", key: "E Major", genre: "rock" },
  { q: "Take On Me a-ha", title: "Take On Me", key: "A Major", genre: "pop" },
  { q: "Someone Like You Adele", title: "Someone Like You", key: "A Major", genre: "pop" },
  { q: "Don't Stop Believin Journey", title: "Don't Stop Believin'", key: "E Major", genre: "rock" },
  { q: "Every Breath You Take The Police", title: "Every Breath You Take", key: "G# Major", genre: "rock" },
  { q: "Perfect Ed Sheeran", title: "Perfect", key: "A# Major", genre: "pop" },
  { q: "Thinking Out Loud Ed Sheeran", title: "Thinking Out Loud", key: "D Major", genre: "pop" },
  { q: "Uptown Girl Billy Joel", title: "Uptown Girl", key: "F Major", genre: "pop" },
  { q: "Africa Toto", title: "Africa", key: "F# Minor", genre: "pop" },
  { q: "One More Time Daft Punk", title: "One More Time", key: "D Minor", genre: "electronic" },
  { q: "Around The World Daft Punk", title: "Around the World", key: "F# Minor", genre: "electronic" },
  { q: "Sunflower Post Malone", title: "Sunflower", key: "D Major", genre: "pop" },
  { q: "Circles Post Malone", title: "Circles", key: "C Major", genre: "pop" },
  { q: "Viva La Vida Coldplay", title: "Viva La Vida", key: "A# Major", genre: "rock" },
  { q: "Yellow Coldplay", title: "Yellow", key: "B Major", genre: "rock" },
  { q: "Wake Me Up When September Ends Green Day", title: "Wake Me Up When September Ends", key: "G Major", genre: "rock" },
  { q: "Hey Jude Beatles", title: "Hey Jude", key: "F Major", genre: "rock" },
];

/** Relative major/minor of a "Root Scale" string — the classic near-miss. */
const ORDER = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export function relativeOf(key) {
  const [root, scale] = key.split(" ");
  const i = ORDER.indexOf(root);
  if (i < 0) return null;
  return scale === "Major" ? `${ORDER[(i + 9) % 12]} Minor` : `${ORDER[(i + 3) % 12]} Major`;
}
