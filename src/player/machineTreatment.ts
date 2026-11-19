import type { Material, Mesh, MeshBasicMaterial, Object3D } from "three";

/**
 * Machine interactive tonal treatment.
 *
 * Bounded per-bucket material tone (colour multiplier + opacity) on the
 * authored neural line meshes, selected by exact GLB node names, plus a
 * reversible focus weighting that is a pure function of authored clip time.
 * No geometry, transforms, textures, vertex colours, depth or blend state are
 * changed, no draw calls are added, nothing animates on its own, and shared
 * source materials are never mutated: each bucket gets its own clone which is
 * swapped back out on dispose.
 */

/** [r, g, b, opacity] multipliers applied over the source material values. */
type Tone = readonly [number, number, number, number];

interface Profile {
  /** Resting tone. */
  base: Tone;
  /** Tone at full focus of an attached screen (scaled by attachment gain). */
  lift: Tone;
  /** Fraction of opacity removed while an unrelated screen is held (rgb gets half). */
  recede: number;
}

const NEUTRAL: Tone = [1, 1, 1, 1];

// Authored decisions. Linear working-space multipliers; cool (blue-leaning)
// multipliers read as atmospheric depth against the #020306 background.
const PROFILES = {
  /** The eight screen-attached route webs: slight rest, full read in focus. */
  route: { base: [0.93, 0.95, 0.99, 0.86], lift: NEUTRAL, recede: 0.2 },
  /** Links touching a screen: quieter at rest so near wires don't dominate. */
  routeLink: { base: [0.88, 0.92, 1, 0.64], lift: [0.98, 0.99, 1, 0.94], recede: 0.22 },
  /** Opening/corridor clusters between screens. */
  corridor: { base: [0.91, 0.93, 0.99, 0.8], lift: NEUTRAL, recede: 0.18 },
  /** Mid-distance relay clusters. */
  relay: { base: [0.89, 0.92, 0.99, 0.78], lift: NEUTRAL, recede: 0.18 },
  /** Links between non-screen near/relay clusters. */
  relayLink: { base: [0.86, 0.9, 1, 0.58], lift: NEUTRAL, recede: 0.2 },
  /** Far lower formation hubs and their interlinks. */
  far: { base: [0.85, 0.89, 0.98, 0.72], lift: NEUTRAL, recede: 0.12 },
  farLink: { base: [0.84, 0.88, 0.98, 0.6], lift: NEUTRAL, recede: 0.12 },
  // Macro crown: core and trunk are left on their source material (silhouette
  // anchor). Secondary lobes step down by rank; satellites stay subordinate.
  lobeA: { base: [0.96, 0.97, 1, 0.92], lift: NEUTRAL, recede: 0.08 },
  lobeB: { base: [0.91, 0.94, 1, 0.8], lift: NEUTRAL, recede: 0.08 },
  lobeC: { base: [0.87, 0.91, 1, 0.68], lift: NEUTRAL, recede: 0.08 },
  trailing: { base: [0.9, 0.93, 1, 0.78], lift: NEUTRAL, recede: 0.08 },
  macroLinks: { base: [0.88, 0.92, 1, 0.7], lift: NEUTRAL, recede: 0.1 },
  satNear: { base: [0.86, 0.9, 1, 0.6], lift: NEUTRAL, recede: 0.1 },
  satMid: { base: [0.86, 0.9, 1, 0.66], lift: NEUTRAL, recede: 0.1 },
  satDeep: { base: [0.86, 0.9, 1, 0.72], lift: NEUTRAL, recede: 0.1 },
} satisfies Record<string, Profile>;

const MACRO_PROFILES: Record<string, Profile> = {
  macro_crown_lobe_A_major_web: PROFILES.lobeA,
  macro_crown_lobe_B_mid_web: PROFILES.lobeB,
  macro_crown_lobe_C_minor_web: PROFILES.lobeC,
  macro_crown_trailing_web: PROFILES.trailing,
  macro_links_web: PROFILES.macroLinks,
  sat_1_upper_left_z280_web: PROFILES.satNear,
  sat_2_upper_right_z400_web: PROFILES.satNear,
  sat_3_left_z600_web: PROFILES.satMid,
  sat_4_lower_right_z660_web: PROFILES.satMid,
  sat_5_upper_deep_z930_web: PROFILES.satDeep,
};

/**
 * One exact web (source opacity ~0.8637) is a bright angular connector that
 * reads as a stray object. Local cap only: opacity multiplier gives ~0.18
 * actual, lift equals base so focus never raises it, no recede change needed.
 */
const ARMED_CORRIDOR_WEB = "cluster_04_armed_corridor_web";
const ARMED_CORRIDOR_WEB_PROFILE: Profile = {
  base: [0.8, 0.85, 0.95, 0.18 / 0.863723],
  lift: [0.8, 0.85, 0.95, 0.18 / 0.863723],
  recede: 0,
};

/** Clusters one link away from a held screen get this share of its lift. */
const NEIGHBOR_GAIN = 0.6;
/** The next relay/hub is quieter, keeping the path subordinate to its screen. */
const OUTER_GAIN = 0.28;
/** Intermediate links follow the stronger of their connected relay endpoints. */
const PATH_GAIN = 0.7;
/** Authored-time shoulders around each hold (seconds). Holds are ~6.7 s apart. */
const SHOULDER_IN = 2.4;
const SHOULDER_OUT = 2.0;

export interface FocusHold {
  screen: string;
  anchorNode: string;
  holdStart: number;
  holdEnd: number;
}

export interface MachineTreatment {
  /** Applies tone for authored clip time. Allocation-free; call before render. */
  update(time: number): void;
  /** Restores every mesh's source material and disposes the owned clones. */
  dispose(): void;
}

interface Unit {
  material: MeshBasicMaterial;
  r: number; g: number; b: number; o: number;
  profile: Profile;
  /** Screen index -> gain (0 = unattached). */
  gains: Float32Array;
  lastOwn: number;
  lastCtx: number;
}

function isBasic(material: Material | Material[]): material is MeshBasicMaterial {
  return !Array.isArray(material) && (material as MeshBasicMaterial).isMeshBasicMaterial === true;
}

function smooth(x: number): number {
  return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
}

export function holdWeight(time: number, start: number, end: number): number {
  if (time >= start && time <= end) return 1;
  return time < start ? smooth(1 - (start - time) / SHOULDER_IN) : smooth(1 - (time - end) / SHOULDER_OUT);
}

export function createMachineTreatment(root: Object3D, holds: readonly FocusHold[]): MachineTreatment {
  const count = holds.length;
  // Endpoint key ("01_hallway", "c1_corridor", "m2_left", "far_hub_K11") -> screen index.
  const screenOf = new Map<string, number>();
  holds.forEach((hold, index) => {
    const cluster = root.getObjectByName(hold.anchorNode)?.parent;
    if (cluster?.name.startsWith("cluster_")) screenOf.set(cluster.name.slice("cluster_".length), index);
  });

  const clusterKey = (cluster: Object3D) =>
    cluster.name.startsWith("cluster_") ? cluster.name.slice("cluster_".length) : cluster.name;
  const linkEnds = (link: Object3D) => link.name.slice("link_".length).split("__");

  // Follow two links from each screen through actual relay endpoints. Other
  // screens terminate the walk so the route chain cannot light the whole world.
  const neighborGains = new Map<string, Float32Array>();
  const network = root.getObjectByName("network");
  const links = network?.getObjectByName("links")?.children ?? [];
  const neighbors = new Map<string, Set<string>>();
  for (const link of links) {
    const ends = linkEnds(link);
    for (const end of ends) {
      const adjacent = neighbors.get(end) ?? new Set<string>();
      for (const other of ends) {
        if (other !== end) adjacent.add(other);
      }
      neighbors.set(end, adjacent);
    }
  }
  for (const [key, screen] of screenOf) {
    const reached = new Set([key]);
    let frontier = [key];
    for (const gain of [NEIGHBOR_GAIN, OUTER_GAIN]) {
      const next: string[] = [];
      for (const endpoint of frontier) {
        for (const other of neighbors.get(endpoint) ?? []) {
          if (screenOf.has(other) || reached.has(other)) continue;
          reached.add(other);
          const gains = neighborGains.get(other) ?? new Float32Array(count);
          gains[screen] = gain;
          neighborGains.set(other, gains);
          next.push(other);
        }
      }
      frontier = next;
    }
  }

  const units: Unit[] = [];
  const swaps: Array<[Mesh, Material]> = [];
  const owned = new Map<string, Unit>();

  const assign = (mesh: Mesh, unitKey: string, profile: Profile, gains: Float32Array) => {
    const source = mesh.material;
    if (!isBasic(source)) return;
    const key = `${unitKey}|${source.uuid}`;
    let unit = owned.get(key);
    if (!unit) {
      unit = {
        material: source.clone(),
        r: source.color.r, g: source.color.g, b: source.color.b, o: source.opacity,
        profile, gains, lastOwn: -1, lastCtx: -1,
      };
      unit.material.name = `${source.name}~${unitKey}`;
      owned.set(key, unit);
      units.push(unit);
    }
    swaps.push([mesh, source]);
    mesh.material = unit.material;
  };

  const webOf = (group: Object3D) =>
    group.children.find((child) => child.name === `${group.name}_web` && (child as Mesh).isMesh) as Mesh | undefined;
  const none = new Float32Array(count);
  const own = (index: number) => { const g = new Float32Array(count); g[index] = 1; return g; };

  for (const [groupName, rest] of [["route_clusters", PROFILES.corridor], ["relay_clusters", PROFILES.relay], ["formation_far_lower", PROFILES.far]] as const) {
    network?.getObjectByName(groupName)?.children.forEach((cluster) => {
      const web = webOf(cluster);
      if (!web) return;
      const key = clusterKey(cluster);
      const screen = screenOf.get(key);
      if (screen !== undefined) {
        const profile = web.name === ARMED_CORRIDOR_WEB ? ARMED_CORRIDOR_WEB_PROFILE : PROFILES.route;
        assign(web, `route:${key}`, profile, own(screen));
      }
      else assign(web, `${groupName}:${key}`, rest, neighborGains.get(key) ?? none);
    });
  }

  links.forEach((link) => {
    const web = webOf(link);
    if (!web) return;
    const ends = linkEnds(link);
    const gains = new Float32Array(count);
    let attached = false;
    for (const end of ends) {
      const screen = screenOf.get(end);
      if (screen !== undefined) { gains[screen] = 1; attached = true; }
    }
    if (!attached) {
      for (let screen = 0; screen < count; screen++) {
        let strongest = 0;
        let connected = true;
        for (const end of ends) {
          const gain = neighborGains.get(end)?.[screen] ?? 0;
          if (gain === 0) connected = false;
          strongest = Math.max(strongest, gain);
        }
        if (connected) gains[screen] = strongest * PATH_GAIN;
      }
    }
    const profile = attached ? PROFILES.routeLink
      : ends.some((end) => end.startsWith("far_hub")) ? PROFILES.farLink : PROFILES.relayLink;
    assign(web, link.name, profile, gains);
  });

  root.getObjectByName("MachineMacroEXP01")?.traverse((object) => {
    const profile = MACRO_PROFILES[object.name];
    if (profile && (object as Mesh).isMesh) assign(object as Mesh, object.name, profile, none);
  });

  const weights = new Float32Array(count);
  let disposed = false;

  return {
    update(time) {
      if (disposed || !Number.isFinite(time)) return;
      let focus = 0;
      for (let i = 0; i < count; i++) {
        const hold = holds[i]!;
        weights[i] = holdWeight(time, hold.holdStart, hold.holdEnd);
        if (weights[i]! > focus) focus = weights[i]!;
      }
      for (const unit of units) {
        let lift = 0;
        let attached = 0;
        for (let i = 0; i < count; i++) {
          const gain = unit.gains[i]!;
          if (gain === 0) continue;
          const w = weights[i]!;
          if (gain * w > lift) lift = gain * w;
          if (w > attached) attached = w;
        }
        const ctx = focus > attached ? focus - attached : 0;
        if (lift === unit.lastOwn && ctx === unit.lastCtx) continue;
        unit.lastOwn = lift;
        unit.lastCtx = ctx;
        const { base, lift: up, recede } = unit.profile;
        const fade = recede * ctx;
        const rgb = 1 - 0.5 * fade;
        unit.material.color.setRGB(
          unit.r * (base[0] + (up[0] - base[0]) * lift) * rgb,
          unit.g * (base[1] + (up[1] - base[1]) * lift) * rgb,
          unit.b * (base[2] + (up[2] - base[2]) * lift) * rgb,
        );
        unit.material.opacity = Math.min(1, unit.o * (base[3] + (up[3] - base[3]) * lift) * (1 - fade));
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [mesh, source] of swaps) mesh.material = source;
      for (const unit of units) unit.material.dispose();
      swaps.length = 0;
      units.length = 0;
      owned.clear();
    },
  };
}
