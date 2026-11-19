/**
 * Recorded-feed catalog: which manifest anchor shows which recorded excerpt.
 * Hold windows are never stored here; they come from the public manifest anchors.
 * Anchor index 1 (screen_02_roadside_car) has no recorded media yet and keeps its
 * original still, so it is intentionally absent.
 */
export interface AnchorLike { screen: string; holdStart: number; holdEnd: number }

export interface RecordedCatalogEntry {
  id: string;
  /** Index into manifest.anchors in the original eight-screen order. */
  anchorIndex: number;
  /** Anchor screen name; must match the manifest or the entry is skipped. */
  screen: string;
  /** Image mesh under the screen group. The last screen's mesh is the focal screen. */
  mesh: string;
}

export const RECORDED_CATALOG: readonly RecordedCatalogEntry[] = [
  { id: "m05", anchorIndex: 0, screen: "screen_01_hallway", mesh: "screen_01_hallway_image" },
  { id: "m06", anchorIndex: 2, screen: "screen_03_lockers", mesh: "screen_03_lockers_image" },
  { id: "m04", anchorIndex: 3, screen: "screen_04_armed_corridor", mesh: "screen_04_armed_corridor_image" },
  { id: "m07", anchorIndex: 4, screen: "screen_05_stairwell_person", mesh: "screen_05_stairwell_person_image" },
  { id: "m01", anchorIndex: 5, screen: "screen_06_clock_hallway", mesh: "screen_06_clock_hallway_image" },
  { id: "m02", anchorIndex: 6, screen: "screen_07_workroom", mesh: "screen_07_workroom_image" },
  { id: "m03", anchorIndex: 7, screen: "screen_08_cafeteria", mesh: "focal_screen" },
];

export interface ResolvedRecordedEntry extends RecordedCatalogEntry {
  holdStart: number;
  holdEnd: number;
  video: string;
  poster: string;
  tracking: string;
}

/** Route seconds before the hold at which the decoder is created and preloads. */
export const PREPARE_LEAD_SECONDS = 12;
/** Route seconds before the hold at which playback starts. */
export const PLAY_LEAD_SECONDS = 5;
/** Route seconds after the hold during which playback continues. */
export const TRAIL_SECONDS = 3;
/** Hard bound on simultaneously prepared decoders: current plus nearest upcoming. */
export const MAX_DECODERS = 2;

/** Entries whose anchor exists and matches, in route order. Missing or mismatched anchors are skipped. */
export function resolveCatalog(anchors: readonly AnchorLike[] | undefined): ResolvedRecordedEntry[] {
  const out: ResolvedRecordedEntry[] = [];
  for (const entry of RECORDED_CATALOG) {
    const anchor = anchors?.[entry.anchorIndex];
    if (!anchor || anchor.screen !== entry.screen || !Number.isFinite(anchor.holdStart) || !Number.isFinite(anchor.holdEnd)) continue;
    const base = `/assets/recorded-feeds/${entry.id}`;
    out.push({ ...entry, holdStart: anchor.holdStart, holdEnd: anchor.holdEnd, video: `${base}/loop.mp4`, poster: `${base}/poster.jpg`, tracking: `${base}/tracking.json` });
  }
  return out.sort((a, b) => a.holdStart - b.holdStart);
}

export function inWindow(entry: ResolvedRecordedEntry, time: number, lead: number): boolean {
  return time >= entry.holdStart - lead && time <= entry.holdEnd + TRAIL_SECONDS;
}

/** At most MAX_DECODERS entries inside the prepare window, nearest to their hold first. */
export function selectPrepared(entries: readonly ResolvedRecordedEntry[], time: number, max = MAX_DECODERS): ResolvedRecordedEntry[] {
  const distance = (e: ResolvedRecordedEntry) => Math.max(e.holdStart - time, time - e.holdEnd, 0);
  return entries
    .filter((e) => inWindow(e, time, PREPARE_LEAD_SECONDS))
    .sort((a, b) => distance(a) - distance(b) || a.holdStart - b.holdStart)
    .slice(0, max);
}
