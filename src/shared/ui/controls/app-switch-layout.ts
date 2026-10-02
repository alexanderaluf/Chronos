export const SWITCH_TRACK_WIDTH = 52;
export const SWITCH_TRACK_HEIGHT = 32;
export const SWITCH_THUMB_SIZE = 24;
export const SWITCH_INSET = 4;
export const SWITCH_TRAVEL = SWITCH_TRACK_WIDTH - SWITCH_THUMB_SIZE - 2 * SWITCH_INSET;

/** Offset from the track's physical left inset, independent of the surrounding layout. */
export function switchThumbOffset(progress: number, isRTL: boolean): number {
  "worklet";
  const bounded = Math.max(0, Math.min(1, progress));
  return (isRTL ? 1 - bounded : bounded) * SWITCH_TRAVEL;
}
