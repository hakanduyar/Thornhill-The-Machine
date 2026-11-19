/** Authored head tracks for a recorded feed. Bounds are normalized, top-left origin. */
export interface TrackKeyframe { t: number; x: number; y: number; w: number; h: number; visible: boolean }
/** Authored subject class; it only selects a neutral marker shape, never an inference. */
export type EntityKind = "person" | "vehicle" | "watercraft" | "aircraft";
const ENTITY_KINDS: readonly string[] = ["person", "vehicle", "watercraft", "aircraft"];
export interface TrackingTrack { id: string; role?: string; entityKind?: EntityKind; keyframes: TrackKeyframe[] }
export interface RecordedTracking { duration: number; tracks: TrackingTrack[] }
/** Display-only person square palette; never a classification of the subject. */
export type PersonTone = "yellow" | "red" | "redwhite";
export interface Head { x: number; y: number; w: number; h: number; entityKind?: EntityKind; tone?: PersonTone }

/** Literal authored display map by track id (about 15% of person tracks); every other person square is white. */
const PERSON_TONES: Readonly<Record<string, PersonTone>> = {
  "blue-jacket": "yellow",
  "central-light": "yellow",
  "backpack-walker": "yellow",
  "burgundy": "yellow",
  "far-red": "red",
  "foreground-walker": "redwhite",
};

const BOUNDS_EPSILON = 1e-5;

export function parseRecordedTracking(value: unknown): RecordedTracking {
  const data = value as RecordedTracking | null;
  if (!data || !Number.isFinite(data.duration) || data.duration <= 0 || !Array.isArray(data.tracks)) {
    throw new Error("Invalid recorded tracking");
  }
  const ids = new Set<string>();
  for (const track of data.tracks) {
    if (!track || typeof track.id !== "string" || ids.has(track.id) || !Array.isArray(track.keyframes) || track.keyframes.length === 0
      || (track.entityKind !== undefined && !ENTITY_KINDS.includes(track.entityKind))) {
      throw new Error("Invalid recorded track");
    }
    ids.add(track.id);
    let previous = -1;
    for (const f of track.keyframes) {
      const finite = f && [f.t, f.x, f.y, f.w, f.h].every(Number.isFinite);
      if (
        !finite || typeof f.visible !== "boolean" || f.t < 0 || f.t > data.duration || f.t <= previous
        || f.x < 0 || f.y < 0 || f.w < 0 || f.h < 0
        || (f.visible && (f.w === 0 || f.h === 0))
        || f.x + f.w > 1 + BOUNDS_EPSILON || f.y + f.h > 1 + BOUNDS_EPSILON
      ) throw new Error("Invalid recorded keyframe");
      previous = f.t;
    }
  }
  return data;
}

/**
 * Linear interpolation between neighbouring visible keyframes. Outside a
 * track's span, or across a gap that ends in an invisible keyframe, nothing is
 * drawn: a subject position is never extrapolated.
 */
export function sampleHeads(data: RecordedTracking, time: number): Head[] {
  if (!Number.isFinite(time) || time < 0 || time > data.duration) return [];
  const heads: Head[] = [];
  for (const { id, keyframes, entityKind } of data.tracks) {
    const tone = entityKind === "person" ? PERSON_TONES[id] : undefined;
    const kind = { ...(entityKind ? { entityKind } : {}), ...(tone ? { tone } : {}) };
    const first = keyframes[0]!;
    const last = keyframes[keyframes.length - 1]!;
    if (time < first.t || time > last.t) continue;
    let a = first;
    let b = first;
    for (const frame of keyframes) {
      if (frame.t <= time) a = frame;
      if (frame.t >= time) { b = frame; break; }
    }
    if (!a.visible) continue;
    if (b.t === a.t) { heads.push({ x: a.x, y: a.y, w: a.w, h: a.h, ...kind }); continue; }
    if (!b.visible) continue;
    const mix = (time - a.t) / (b.t - a.t);
    heads.push({
      x: a.x + (b.x - a.x) * mix,
      y: a.y + (b.y - a.y) * mix,
      w: a.w + (b.w - a.w) * mix,
      h: a.h + (b.h - a.h) * mix,
      ...kind,
    });
  }
  return heads;
}

const RETICLE_COLOR = "#f1f0ea"; // person square default: off-white
const TONE_COLORS = { yellow: "#c6bd76", red: "#b8504a" } as const;
const RETICLE_SCALE = 1.36;

const VEHICLE_COLOR = "#e4e6e0";
const WATERCRAFT_COLOR ="#f0f1ec";
const AIRCRAFT_COLOR = "#69bb77";

function strokePath(ctx: CanvasRenderingContext2D, points: number[]): void {
  ctx.beginPath();
  ctx.moveTo(points[0]!, points[1]!);
  for (let i = 2; i < points.length; i += 2) ctx.lineTo(points[i]!, points[i + 1]!);
  ctx.stroke();
}

/** Neutral object markers: a white diamond (watercraft) or a modest green triangle (aircraft). */
function drawObjectMarker(ctx: CanvasRenderingContext2D, width: number, height: number, head: Head): void {
  const w = head.w * width;
  const h = head.h * height;
  const cx = (head.x + head.w / 2) * width;
  const cy = (head.y + head.h / 2) * height;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineWidth = 1.6;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 1;
  if (head.entityKind === "watercraft") {
    ctx.strokeStyle = WATERCRAFT_COLOR;
    // Bounded: the diamond never leaves the picture, whatever the box size.
    const half = Math.min((Math.max(w, h) * RETICLE_SCALE) / 2, cx, width - cx, cy, height - cy);
    strokePath(ctx, [0, -half, half, 0, 0, half, -half, 0, 0, -half]);
  } else {
    ctx.strokeStyle = AIRCRAFT_COLOR;
    // Sized from the box, never its long edge, so a wide aircraft box stays a small triangle inside its bounds.
    const th = Math.min(h * 0.7, w * 0.5);
    const tw = Math.min(th * 1.15, w * 0.6);
    strokePath(ctx, [0, -th / 2, tw / 2, th / 2, -tw / 2, th / 2, 0, -th / 2]);
  }
  ctx.restore();
}

/** Neutral vehicle marker: a plain white-gray rectangle fitted to the authored bounds (no square scaling). */
function drawVehicleBox(ctx: CanvasRenderingContext2D, width: number, height: number, head: Head): void {
  ctx.save();
  ctx.strokeStyle = VEHICLE_COLOR;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 1;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(head.x * width, head.y * height, head.w * width, head.h * height);
  ctx.restore();
}

/**
 * Neutral subject marker. Person: off-white (rarely muted yellow/red/red-white by authored id) dashed square with corner ticks.
 * Vehicle: plain rectangle on the authored bounds. Watercraft and aircraft use their own shapes.
 */
export function drawNeutralReticle(ctx: CanvasRenderingContext2D, width: number, height: number, head: Head): void {
  if (head.entityKind === "vehicle") { drawVehicleBox(ctx, width, height, head); return; }
  if (head.entityKind === "watercraft" || head.entityKind === "aircraft") { drawObjectMarker(ctx, width, height, head); return; }
  const cx = (head.x + head.w / 2) * width;
  const cy = (head.y + head.h / 2) * height;
  const side = Math.max(head.w * width, head.h * height) * RETICLE_SCALE;
  const half = side * 0.47;
  const corner = side * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  const tone = head.tone;
  ctx.strokeStyle = tone === "yellow" ? TONE_COLORS.yellow : tone === "red" || tone === "redwhite" ? TONE_COLORS.red : RETICLE_COLOR;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 1;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([side * 0.04, side * 0.04]);
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.setLineDash([]);
  ctx.lineWidth = 2.2;
  if (tone === "redwhite") ctx.strokeStyle = RETICLE_COLOR;
  ctx.beginPath();
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      ctx.moveTo(sx * (half - corner), sy * half);
      ctx.lineTo(sx * half, sy * half);
      ctx.lineTo(sx * half, sy * (half - corner));
    }
  }
  ctx.stroke();
  ctx.restore();
}
