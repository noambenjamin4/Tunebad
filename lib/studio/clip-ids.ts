// Clip id minting, and the reason it cannot be a bare counter.
//
// Ids are `clip-N` from a module counter. That is fine for one session and
// silently wrong across two: the counter restarts at 1 on every page load,
// while a RESTORED arrangement arrives already holding clip-1 and clip-2. Add
// a file after a restore and the new clip is handed an id that already exists.
//
// Nothing crashes — which is what makes it nasty. Every id-keyed operation
// (select, edit, delete, split, per-clip gain, the engine's gain map) matches
// BOTH clips, so dragging one drags its twin somewhere off screen.
//
// So restoring reserves what it restored, and the counter resumes above it.

let next = 1;

export function makeClipId(): string {
  return `clip-${next++}`;
}

/**
 * Move the counter past every id in `clips`, so nothing minted later can
 * collide with them. Call before putting restored clips into state.
 *
 * Ids that don't match the `clip-N` shape are ignored rather than rejected:
 * they cannot collide with a generated one anyway.
 */
export function reserveClipIds(clips: { id: string }[]): void {
  for (const clip of clips) {
    const match = /^clip-(\d+)$/.exec(clip.id);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n >= next) next = n + 1;
  }
}

/** Test seam: forget every reservation. Not used by the app. */
export function resetClipIds(): void {
  next = 1;
}
