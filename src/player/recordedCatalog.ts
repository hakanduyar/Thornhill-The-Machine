/**
 * Recorded-feed catalog: which manifest anchor shows which recorded excerpt.
 * Hold windows are never stored here; they come from the public manifest anchors.
 * Anchor index 1 (screen_02_roadside_car) shows the covered-road excerpt.
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
  { id: "parking-walk", anchorIndex: 0, screen: "screen_01_hallway", mesh: "screen_01_hallway_image" },
  { id: "covered-road", anchorIndex: 1, screen: "screen_02_roadside_car", mesh: "screen_02_roadside_car_image" },
  { id: "m06", anchorIndex: 2, screen: "screen_03_lockers", mesh: "screen_03_lockers_image" },
  { id: "m04", anchorIndex: 3, screen: "screen_04_armed_corridor", mesh: "screen_04_armed_corridor_image" },
  { id: "m07", anchorIndex: 4, screen: "screen_05_stairwell_person", mesh: "screen_05_stairwell_person_image" },
  { id: "m01", anchorIndex: 5, screen: "screen_06_clock_hallway", mesh: "screen_06_clock_hallway_image" },
  { id: "m02", anchorIndex: 6, screen: "screen_07_workroom", mesh: "screen_07_workroom_image" },
  { id: "m03", anchorIndex: 7, screen: "screen_08_cafeteria", mesh: "focal_screen" },
];

/**
 * Two extra panes that exist only in the opt-in extended itinerary. Their stable
 * ids are 8 (ship) and 9 (apron); the original eight screens keep 0-7. Hold times
 * are supplied by the itinerary on its virtual clock and never stored here.
 */
export const RECORDED_ITINERARY_EXTRAS: readonly RecordedCatalogEntry[] = [
  { id: "ship", anchorIndex: 8, screen: "itinerary_ship", mesh: "itinerary_ship_image" },
  { id: "apron", anchorIndex: 9, screen: "itinerary_apron", mesh: "itinerary_apron_image" },
];

export interface RecordedExtraHold { id: string; holdStart: number; holdEnd: number }

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

const resolved = (entry: RecordedCatalogEntry, holdStart: number, holdEnd: number): ResolvedRecordedEntry => {
  const base = `/assets/recorded-feeds/${entry.id}`;
  return { ...entry, holdStart, holdEnd, video: `${base}/loop.mp4`, poster: `${base}/poster.jpg`, tracking: `${base}/tracking.json` };
};

/**
 * Entries whose anchor exists and matches, in route order. Missing or mismatched anchors are skipped.
 * `extras` (extended itinerary only) adds the ship and apron panes on the same clock as `anchors`.
 */
export function resolveCatalog(anchors: readonly AnchorLike[] | undefined, extras?: readonly RecordedExtraHold[]): ResolvedRecordedEntry[] {
  const out: ResolvedRecordedEntry[] = [];
  for (const entry of RECORDED_CATALOG) {
    const anchor = anchors?.[entry.anchorIndex];
    if (!anchor || anchor.screen !== entry.screen || !Number.isFinite(anchor.holdStart) || !Number.isFinite(anchor.holdEnd)) continue;
    out.push(resolved(entry, anchor.holdStart, anchor.holdEnd));
  }
  for (const entry of extras ? RECORDED_ITINERARY_EXTRAS : []) {
    const hold = extras?.find((e) => e.id === entry.id);
    if (!hold || !Number.isFinite(hold.holdStart) || !Number.isFinite(hold.holdEnd) || hold.holdEnd <= hold.holdStart) continue;
    out.push(resolved(entry, hold.holdStart, hold.holdEnd));
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
