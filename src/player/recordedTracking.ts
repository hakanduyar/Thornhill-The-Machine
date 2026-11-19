/** Authored head tracks for a recorded feed. Bounds are normalized, top-left origin. */
export interface TrackKeyframe { t: number; x: number; y: number; w: number; h: number; visible: boolean }
export interface TrackingTrack { id: string; role?: string; keyframes: TrackKeyframe[] }
export interface RecordedTracking { duration: number; tracks: TrackingTrack[] }
export interface Head { x: number; y: number; w: number; h: number }

const BOUNDS_EPSILON = 1e-5;

export function parseRecordedTracking(value: unknown): RecordedTracking {
  const data = value as RecordedTracking | null;
  if (!data || !Number.isFinite(data.duration) || data.duration <= 0 || !Array.isArray(data.tracks)) {
    throw new Error("Invalid recorded tracking");
  }
  const ids = new Set<string>();
  for (const track of data.tracks) {
    if (!track || typeof track.id !== "string" || ids.has(track.id) || !Array.isArray(track.keyframes) || track.keyframes.length === 0) {
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
  for (const { keyframes } of data.tracks) {
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
    if (b.t === a.t) { heads.push({ x: a.x, y: a.y, w: a.w, h: a.h }); continue; }
    if (!b.visible) continue;
    const mix = (time - a.t) / (b.t - a.t);
    heads.push({
      x: a.x + (b.x - a.x) * mix,
      y: a.y + (b.y - a.y) * mix,
      w: a.w + (b.w - a.w) * mix,
      h: a.h + (b.h - a.h) * mix,
    });
  }
  return heads;
}

const RETICLE_COLOR = "#d9dcd3";
const RETICLE_SCALE = 1.36;

/** Neutral square head marker: dashed square, corner ticks and edge ticks. */
export function drawNeutralReticle(ctx: CanvasRenderingContext2D, width: number, height: number, head: Head): void {
  const cx = (head.x + head.w / 2) * width;
  const cy = (head.y + head.h / 2) * height;
  const side = Math.max(head.w * width, head.h * height) * RETICLE_SCALE;
  const half = side * 0.47;
  const corner = side * 0.12;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = RETICLE_COLOR;
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 1;
  ctx.shadowOffsetY = 1;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([side * 0.04, side * 0.04]);
  ctx.strokeRect(-half, -half, half * 2, half * 2);
  ctx.setLineDash([]);
  ctx.lineWidth = 2.2;
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
