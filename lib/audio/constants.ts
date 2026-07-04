export const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Krumhansl-Schmuckler key profiles
export const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
export const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export const camelot: Record<string, string> = {
  "C Major": "8B", "G Major": "9B", "D Major": "10B", "A Major": "11B", "E Major": "12B", "B Major": "1B",
  "F# Major": "2B", "C# Major": "3B", "G# Major": "4B", "D# Major": "5B", "A# Major": "6B", "F Major": "7B",
  "A Minor": "8A", "E Minor": "9A", "B Minor": "10A", "F# Minor": "11A", "C# Minor": "12A", "G# Minor": "1A",
  "D# Minor": "2A", "A# Minor": "3A", "F Minor": "4A", "C Minor": "5A", "G Minor": "6A", "D Minor": "7A",
};

export function camelotLabel(key: string): string {
  return camelot[key] ? `Camelot ${camelot[key]}` : "Camelot N/A";
}
