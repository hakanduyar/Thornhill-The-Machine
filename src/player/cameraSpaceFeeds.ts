import type { AnchorLike, RecordedExtraHold } from "./recordedCatalog";

/**
 * Ten visual stops for the CameraSpace route. Names match the public recorded
 * catalog so the existing feed controller finds each pane by screen/mesh lookup.
 * Slots 0,1,3,4,5,7,8,9 are the original eight screens in their base order;
 * slots 2 and 6 are the two extra panes. The roadside slot is a still with no recording.
 */
export interface CameraSpaceStop {
  slot: number;
  /** Recorded-feed id, or "roadside" for the still. */
  id: string;
  screen: string;
  mesh: string;
  position: readonly [number, number, number];
  poster: string;
  recorded: boolean;
}

const posterOf = (id: string) => `/assets/recorded-feeds/${id}/poster.jpg`;
export const ROADSIDE_STILL = "/assets/camera-space/roadside-still.webp";

/** Uneven, asymmetric positions over roughly 1200 units of depth. */
const LAYOUT: ReadonlyArray<Omit<CameraSpaceStop, "slot" | "poster" | "recorded"> & { poster?: string }> = [
  { id: "m05", screen: "screen_01_hallway", mesh: "screen_01_hallway_image", position: [-26, 10, -70] },
  { id: "roadside", screen: "screen_02_roadside_car", mesh: "screen_02_roadside_car_image", position: [34, -12, -190], poster: ROADSIDE_STILL },
  { id: "ship", screen: "itinerary_ship", mesh: "itinerary_ship_image", position: [-8, 26, -310] },
  { id: "m06", screen: "screen_03_lockers", mesh: "screen_03_lockers_image", position: [-50, -22, -440] },
  { id: "m04", screen: "screen_04_armed_corridor", mesh: "screen_04_armed_corridor_image", position: [18, 30, -570] },
  { id: "m07", screen: "screen_05_stairwell_person", mesh: "screen_05_stairwell_person_image", position: [66, 8, -700] },
  { id: "apron", screen: "itinerary_apron", mesh: "itinerary_apron_image", position: [28, -30, -835] },
  { id: "m01", screen: "screen_06_clock_hallway", mesh: "screen_06_clock_hallway_image", position: [-14, -34, -975] },
  { id: "m02", screen: "screen_07_workroom", mesh: "screen_07_workroom_image", position: [-60, 22, -1110] },
  { id: "m03", screen: "screen_08_cafeteria", mesh: "focal_screen", position: [24, 2, -1250] },
];

export const CAMERA_SPACE_STOPS: readonly CameraSpaceStop[] = LAYOUT.map((stop, slot) => ({
  ...stop,
  slot,
  poster: stop.poster ?? posterOf(stop.id),
  recorded: stop.id !== "roadside",
}));

/** Route seconds of the first hold, and the spacing between stops. */
export const FIRST_HOLD_SECONDS = 7.5;
export const SLOT_SECONDS = 9.5;
/** Each hold lasts this many route seconds, counted from the stop's clock time. */
export const HOLD_SECONDS = 3;

/** Route-clock time at which the camera is at a slot. Always seconds, never an ordinal. */
export const slotSeconds = (slot: number) => FIRST_HOLD_SECONDS + slot * SLOT_SECONDS;

/**
 * Route-clock time for a point between two stops: `segment` is the lower stop,
 * `fraction` (0..1) the eased progress toward the next one.
 */
export function routeSeconds(segment: number, fraction: number): number {
  const a = slotSeconds(segment);
  return a + (slotSeconds(segment + 1) - a) * fraction;
}

/** Original eight anchors, in base order, bound to visual slots 0,1,3,4,5,7,8,9. */
export const BASE_SLOTS: readonly number[] = [0, 1, 3, 4, 5, 7, 8, 9];
export const EXTRA_SLOTS: Readonly<Record<string, number>> = { ship: 2, apron: 6 };

const hold = (slot: number) => ({ holdStart: slotSeconds(slot), holdEnd: slotSeconds(slot) + HOLD_SECONDS });

export const CAMERA_SPACE_ANCHORS: readonly AnchorLike[] = BASE_SLOTS.map((slot) => ({
  screen: CAMERA_SPACE_STOPS[slot]!.screen,
  ...hold(slot),
}));

export const CAMERA_SPACE_EXTRAS: readonly RecordedExtraHold[] = Object.entries(EXTRA_SLOTS).map(([id, slot]) => ({ id, ...hold(slot) }));
