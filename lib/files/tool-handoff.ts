// Cross-page file handoff for the DAW. The joiner / cutter / slowed-reverb
// pages stash their loaded File(s) here and router.push("/daw"); the studio
// takes them on mount. Module state survives App Router CLIENT navigation
// only — a hard load lands on an empty studio, which is the graceful case.

let pending: File[] | null = null;

export function stashFilesForStudio(files: File[]): void {
  pending = files.length > 0 ? [...files] : null;
}

export function takeStudioFiles(): File[] | null {
  const files = pending;
  pending = null;
  return files;
}
