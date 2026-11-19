import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Group,
  InterleavedBuffer,
  InterleavedBufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Vector3,
  type Object3D,
} from "three";

type Knot = readonly [x: number, y: number, z: number, spread: number];

// Machine world coordinates. The cell leans left into an open dendritic fan,
// with a single long axon curling away from its lower right. Each fork starts
// at a control point on its parent path.
const BODY = new Vector3(44, -110, -785);
const UPPER_LEFT = [
  [-56, -67, -793, 34], [-104, -20, -817, 28], [-168, 34, -831, 19],
  [-251, 61, -810, 11], [-329, 110, -778, 4], [-419, 115, -746, 1],
] as const satisfies readonly Knot[];
const WEST = [
  [-77, -121, -793, 28], [-158, -133, -786, 24], [-233, -103, -758, 16],
  [-324, -101, -733, 11], [-412, -147, -734, 3], [-465, -131, -751, 1],
] as const satisfies readonly Knot[];
const APICAL = [
  [34, -52, -805, 25], [59, -9, -814, 22], [124, 22, -847, 18],
  [165, 78, -886, 12], [140, 147, -910, 5], [106, 179, -924, 1],
] as const satisfies readonly Knot[];
const BASAL = [
  [-5, -161, -774, 30], [-41, -193, -744, 23], [-114, -232, -722, 15],
  [-167, -237, -682, 9], [-241, -291, -650, 4], [-306, -318, -633, 1],
] as const satisfies readonly Knot[];
const AXON = [
  [116, -142, -791, 33], [175, -172, -783, 23], [223, -203, -801, 15],
  [293, -216, -821, 10], [358, -187, -855, 8], [407, -134, -888, 7],
  [460, -146, -918, 4], [510, -109, -947, 2], [545, -66, -955, 1],
] as const satisfies readonly Knot[];
const EAST = [
  [119, -74, -787, 23], [186, -51, -762, 17], [246, -29, -733, 12],
  [288, 22, -706, 8], [315, 77, -710, 4], [403, 106, -773, 1],
] as const satisfies readonly Knot[];

const DENDRITES = [
  UPPER_LEFT,
  [UPPER_LEFT[2], [-195, 95, -852, 10], [-253, 142, -887, 5], [-276, 188, -899, 1]],
  [UPPER_LEFT[3], [-285, 34, -776, 8], [-350, 21, -753, 3], [-393, 35, -731, 1]],
  [UPPER_LEFT[4], [-366, 142, -766, 4], [-384, 182, -768, 1]],
  WEST,
  [WEST[2], [-263, -64, -724, 9], [-285, -46, -679, 5], [-325, -51, -643, 1]],
  [WEST[3], [-368, -68, -750, 5], [-425, -51, -771, 2], [-467, -14, -797, 1]],
  [WEST[4], [-435, -184, -718, 4], [-475, -202, -705, 1]],
  APICAL,
  [APICAL[2], [183, 41, -858, 9], [216, 83, -874, 5], [246, 119, -880, 1]],
  [APICAL[3], [202, 114, -908, 5], [230, 162, -924, 2], [253, 178, -930, 1]],
  BASAL,
  [BASAL[2], [-137, -269, -736, 9], [-152, -307, -734, 5], [-193, -352, -728, 1]],
  [BASAL[3], [-214, -232, -676, 6], [-278, -250, -667, 3], [-303, -231, -654, 1]],
  EAST,
  [EAST[2], [295, -23, -767, 8], [349, 2, -818, 4], [395, -9, -860, 1]],
  [EAST[4], [328, 113, -718, 3], [354, 146, -735, 1]],
  AXON,
  [AXON[3], [334, -249, -779, 6], [354, -283, -743, 3], [406, -300, -744, 1]],
  [AXON[5], [444, -105, -905, 4], [459, -61, -940, 2], [493, -43, -970, 1]],
  [AXON[7], [547, -123, -950, 3], [564, -165, -967, 1]],
] as const satisfies readonly (readonly Knot[])[];

const DISTAL_PATHS = [
  [UPPER_LEFT[4], [-378, 144, -802, 7], [-435, 185, -824, 6], [-503, 210, -850, 3], [-606, 253, -892, 1]],
  [UPPER_LEFT[5], [-463, 97, -750, 5], [-526, 94, -755, 4], [-575, 128, -779, 1]],
  [WEST[4], [-480, -124, -708, 8], [-552, -148, -683, 4], [-618, -113, -677, 1]],
  [BASAL[4], [-287, -272, -645, 6], [-357, -312, -654, 4], [-435, -363, -670, 1]],
  [APICAL[4], [112, 188, -914, 8], [64, 218, -875, 6], [-7, 237, -826, 4], [-86, 280, -788, 1]],
  [APICAL[4], [183, 189, -923, 7], [232, 236, -964, 4], [273, 289, -981, 1]],
  [EAST[4], [369, 95, -728, 8], [445, 136, -775, 7], [529, 183, -820, 3], [619, 192, -859, 1]],
  [AXON[6], [501, -207, -912, 7], [557, -244, -899, 3], [623, -263, -878, 1]],
  [AXON[8], [596, -42, -973, 6], [659, 3, -1002, 3], [716, 17, -1021, 1]],
] as const satisfies readonly (readonly Knot[])[];

interface PeripheralPath {
  from: string;
  to: string | Knot;
  stations: readonly Knot[];
  bend: number;
}

// These webs sit off the camera corridor and step outward from existing
// route relays to the old far hubs, the satellites and the new cell.
const PERIPHERAL_PATHS: readonly PeripheralPath[] = [
  {
    from: "cluster_m2_left", to: "sat_1_upper_left_z280", bend: -9,
    stations: [[-34, 15, -65, 8], [-50, 27, -105, 12], [-75, 40, -173, 17], [-111, 66, -235, 20]],
  },
  {
    from: "cluster_m1_upper_right", to: "sat_2_upper_right_z400", bend: 11,
    stations: [[38, 23, -75, 9], [59, 42, -125, 13], [94, 55, -188, 17], [138, 86, -279, 23]],
  },
  {
    from: "cluster_m3_upper_left", to: UPPER_LEFT[2], bend: 14,
    stations: [[-42, 33, -120, 10], [-62, 58, -182, 16], [-87, 84, -272, 22], [-106, 110, -407, 28], [-118, 120, -557, 31]],
  },
  {
    from: "cluster_m4_right", to: "sat_4_lower_right_z660", bend: -13,
    stations: [[52, -21, -132, 11], [80, -46, -193, 15], [115, -73, -265, 19], [153, -115, -362, 25], [226, -169, -506, 29]],
  },
  {
    from: "cluster_m5_upper_deep", to: APICAL[4], bend: 14,
    stations: [[24, 45, -205, 12], [12, 67, -282, 18], [-14, 104, -409, 26], [13, 149, -554, 32], [74, 179, -744, 24]],
  },
  {
    from: "cluster_m6_left_deep", to: WEST[2], bend: 9,
    stations: [[-54, -32, -186, 12], [-80, -46, -241, 16], [-117, -79, -304, 22], [-172, -98, -426, 27], [-207, -83, -578, 26]],
  },
  {
    from: "cluster_m7_right_deep", to: "far_hub_K12", bend: -8,
    stations: [[58, 13, -210, 13], [82, 29, -261, 16], [111, 3, -323, 20]],
  },
  {
    from: "far_hub_K11", to: BASAL[2], bend: -14,
    stations: [[-23, -126, -469, 21], [-44, -155, -557, 26], [-87, -180, -646, 29]],
  },
];

// All outward paths begin on existing branches. Unequal reach and depth keep
// the horizon open, with overlapping tiers instead of a common outer rim.
const HORIZON_PATHS = [
  [[-150, 70, -280, 1], [-194, 118, -407, 18], [-276, 171, -581, 14], [-421, 231, -784, 9], [-674, 319, -1005, 5], [-1117, 483, -1244, 1]],
  [[190, 95, -400, 1], [262, 128, -501, 18], [349, 170, -636, 14], [511, 216, -823, 9], [781, 348, -1028, 5], [1249, 421, -1268, 1]],
  [[-330, -60, -600, 1], [-376, 8, -666, 17], [-471, 65, -766, 13], [-605, 142, -926, 9], [-849, 164, -1091, 5], [-1263, 272, -1261, 1]],
  [[300, -255, -660, 1], [354, -284, -735, 18], [428, -319, -832, 13], [589, -367, -968, 9], [873, -443, -1103, 4], [1281, -507, -1258, 1]],
  [[-606, 253, -892, 1], [-715, 312, -942, 15], [-902, 365, -1008, 12], [-1123, 473, -1088, 9], [-1447, 551, -1164, 5], [-1886, 731, -1272, 1]],
  [[-618, -113, -677, 1], [-742, -158, -748, 17], [-946, -171, -836, 13], [-1243, -267, -964, 8], [-1588, -298, -1109, 4], [-2009, -406, -1241, 1]],
  [[-435, -363, -670, 1], [-507, -414, -736, 15], [-698, -466, -829, 12], [-899, -602, -945, 8], [-1112, -671, -1088, 4], [-1464, -841, -1226, 1]],
  [[-86, 280, -788, 1], [-140, 361, -845, 16], [-246, 412, -908, 12], [-315, 572, -1024, 7], [-466, 718, -1132, 4], [-513, 953, -1261, 1]],
  [[273, 289, -981, 1], [322, 358, -1004, 16], [436, 409, -1052, 12], [514, 567, -1117, 8], [694, 724, -1181, 4], [819, 907, -1266, 1]],
  [[619, 192, -859, 1], [746, 225, -903, 17], [971, 327, -985, 12], [1211, 373, -1062, 8], [1541, 533, -1166, 4], [1957, 617, -1270, 1]],
  [[623, -263, -878, 1], [763, -321, -932, 16], [923, -417, -1005, 12], [1181, -476, -1089, 8], [1456, -623, -1167, 4], [1848, -757, -1277, 1]],
  [[716, 17, -1021, 1], [836, -12, -1028, 14], [1068, 69, -1071, 11], [1362, 47, -1122, 7], [1677, 131, -1190, 4], [2136, 153, -1278, 1]],
] as const satisfies readonly (readonly Knot[])[];

const MAJOR_PATHS = new Set<readonly Knot[]>([UPPER_LEFT, WEST, APICAL, BASAL, EAST, AXON]);
const SILVER_BLUE = new Color("#acbdd8");
const DIM_BLUE = new Color("#788faf");
const DEPTH_AXIS = new Vector3(0, 0, 1);
const VERTEX_STRIDE = 7;

function seededRandom() {
  let state = 0x5631deac;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function point(knot: Knot) {
  return new Vector3(knot[0], knot[1], knot[2]);
}

class Filaments {
  private attributes: Float32Array;
  private used = 0;
  readonly next = seededRandom();

  constructor(estimatedVertices: number) {
    this.attributes = new Float32Array(estimatedVertices * VERTEX_STRIDE);
  }

  edge(a: Vector3, b: Vector3, alpha: number, targetAlpha = alpha, color = SILVER_BLUE) {
    if (this.used + 2 * VERTEX_STRIDE > this.attributes.length) {
      const larger = new Float32Array(this.attributes.length * 2);
      larger.set(this.attributes);
      this.attributes = larger;
    }
    this.vertex(a, color, alpha);
    this.vertex(b, color, targetAlpha);
  }

  private vertex(point: Vector3, color: Color, alpha: number) {
    this.attributes[this.used++] = point.x;
    this.attributes[this.used++] = point.y;
    this.attributes[this.used++] = point.z;
    this.attributes[this.used++] = color.r;
    this.attributes[this.used++] = color.g;
    this.attributes[this.used++] = color.b;
    this.attributes[this.used++] = alpha;
  }

  // Each junction has its own bent, uneven little network. The brighter
  // intermediate node and two different branch lengths give the mesh grain.
  micrograph(hub: Vector3, tangent: Vector3, normal: Vector3, size: number, alpha: number) {
    const bend = (this.next() - 0.5) * size;
    const hand = Math.sign(bend);
    const fork = hub.clone().addScaledVector(tangent, size * 0.6).addScaledVector(normal, bend);
    fork.z += (this.next() - 0.5) * size;
    const stem = fork.clone().addScaledVector(tangent, size * (0.55 + this.next() * 0.42));
    const free = fork.clone().addScaledVector(normal, hand * size * (0.45 + this.next() * 0.5));
    free.z += (this.next() - 0.5) * size;
    const split = free.clone().addScaledVector(tangent, -size * (0.3 + this.next() * 0.45));
    const twig = stem.clone().addScaledVector(normal, -hand * size * (0.25 + this.next() * 0.4));
    this.edge(hub, fork, alpha, alpha * 1.22);
    this.edge(fork, stem, alpha * 1.22, alpha * 0.73);
    this.edge(fork, free, alpha * 1.22, alpha * 0.74);
    this.edge(free, split, alpha * 0.74, alpha * 0.42, DIM_BLUE);
    this.edge(stem, twig, alpha * 0.73, alpha * 0.46, DIM_BLUE);
  }

  build(name: string) {
    const buffer = new InterleavedBuffer(this.attributes.subarray(0, this.used), VERTEX_STRIDE);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new InterleavedBufferAttribute(buffer, 3, 0));
    geometry.setAttribute("color", new InterleavedBufferAttribute(buffer, 4, 3));
    geometry.computeBoundingSphere();
    const material = new LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false });
    const mesh = new LineSegments(geometry, material);
    mesh.name = name;
    return mesh;
  }
}

function closest(cells: readonly Vector3[], at: Vector3): Vector3 {
  let result = cells[0]!;
  let distance = Infinity;
  for (const cell of cells) {
    const next = cell.distanceToSquared(at);
    if (next < distance) {
      distance = next;
      result = cell;
    }
  }
  return result;
}

function addSoma(lines: Filaments): Vector3[] {
  const rows = 22;
  const layers = 14;
  const stride = rows * layers;
  const cells: Vector3[] = [];
  const lattice: Array<Vector3 | undefined> = [];
  const tangent = new Vector3(1, -0.3, 0);
  const normal = new Vector3(0.3, 1, 0);

  for (let i = 0; i < 33; i++) {
    for (let j = 0; j < rows; j++) {
      for (let k = 0; k < layers; k++) {
        const x = (i - 16) * 10 + (lines.next() - 0.5) * 11;
        const y = (j - 10.5) * 10 + (lines.next() - 0.5) * 11;
        const z = (k - 6.5) * 12 + (lines.next() - 0.5) * 12;
        const theta = Math.atan2(y, x);
        const contour = 0.96 + 0.1 * Math.sin(theta * 3 + 0.7) + 0.07 * Math.cos(theta * 5 - 0.3);
        const warpedY = y - x * 0.22 + 8 * Math.sin(x * 0.035);
        const radius = (x / 148) ** 2 + (warpedY / 93) ** 2 + (z / 75) ** 2;
        // Irregular gaps let the background show through the soma.
        const innerGap = ((x + 26) / 35) ** 2 + ((warpedY - 10 + x * 0.28) / 21) ** 2;
        const upperGap = ((x - 36) / 22) ** 2 + ((warpedY - 39 - x * 0.25) / 28) ** 2;
        if (radius > contour || innerGap < 1 || upperGap < 1 || lines.next() < 0.14) continue;

        const hub = new Vector3(
          BODY.x + x + z * 0.19,
          BODY.y + warpedY + 0.08 * z,
          BODY.z + z + 0.14 * x + 0.11 * y,
        );
        const location = i * stride + j * layers + k;
        const neighbors = [
          k > 0 ? lattice[location - 1] : undefined,
          j > 0 ? lattice[location - layers] : undefined,
          i > 0 ? lattice[location - stride] : undefined,
        ];
        const alpha = 0.1 + lines.next() * 0.22;
        let joined = false;
        for (const adjacent of neighbors) {
          if (adjacent) {
            lines.edge(adjacent, hub, alpha * 0.58, alpha * 0.79, DIM_BLUE);
            joined = true;
          }
        }
        if (!joined && cells.length) lines.edge(closest(cells, hub), hub, alpha * 0.52, alpha * 0.68, DIM_BLUE);
        tangent.set(1, -0.19 + 0.4 * Math.sin(theta + z / 26), 0.22).normalize();
        normal.crossVectors(DEPTH_AXIS, tangent).normalize();
        lines.micrograph(hub, tangent, normal, 4.2 + lines.next() * 3.1, alpha);
        lattice[location] = hub;
        cells.push(hub);
      }
    }
  }
  return cells;
}

function addDendrite(lines: Filaments, knots: readonly Knot[], major: boolean) {
  const path = new CatmullRomCurve3(knots.map(point));
  const intervals = knots.length - 1;
  const subdivisions = Math.max(3, Math.ceil(path.getLength() / intervals / 4.1));
  const steps = intervals * subdivisions;
  const count = major ? 12 : 5;
  const phase = lines.next() * Math.PI * 2;
  const previous: Vector3[] = [];
  const normal = new Vector3();
  const binormal = new Vector3();
  let parent = path.getPoint(0);

  for (let step = 0; step <= steps; step++) {
    const t = step / steps;
    const center = path.getPoint(t);
    const tangent = path.getTangent(t);
    normal.crossVectors(DEPTH_AXIS, tangent).normalize();
    binormal.crossVectors(tangent, normal);
    const segment = Math.min(intervals - 1, Math.floor(step / subdivisions));
    const ratio = step / subdivisions - segment;
    const width = knots[segment]![3] * (1 - ratio) + knots[segment + 1]![3] * ratio;
    // Branch bundles begin broad and divide into increasingly sparse fibres.
    const alpha = (major ? 0.19 : 0.14) + Math.min(width / 120, 0.14);
    if (step > 0) lines.edge(parent, center, alpha * 1.19);
    for (let strand = 0; strand < count; strand++) {
      const angle = phase + strand * 2.39996 + Math.sin(t * 16 + strand) * 0.56;
      const radial = Math.sqrt((strand + 0.6) / count);
      const wave = 0.81 + 0.19 * Math.sin(t * 26 + strand * 1.81);
      const fan = Math.min(step / 8, 1);
      const here = center.clone()
        .addScaledVector(tangent, (lines.next() - 0.5) * 4 * fan)
        .addScaledVector(normal, Math.cos(angle) * radial * width * wave * fan)
        .addScaledVector(binormal, Math.sin(angle) * radial * width * 0.72 * fan);
      const before = previous[strand];
      if (before) {
        const power = alpha * (0.37 + lines.next() * 0.48) * Math.min(width / 2.5, 1);
        lines.edge(before, here, power, power * 0.92, strand % 3 === 0 ? SILVER_BLUE : DIM_BLUE);
        if ((step + strand * 3) % 11 === 0) lines.edge(parent, here, power * 0.51, power * 0.87);
        if (width > 2.8 && lines.next() < (major ? 0.65 : 0.52)) {
          lines.micrograph(here, tangent, normal, Math.min(width * 0.9, 3.5 + lines.next() * 6.7), power * 1.1);
        }
      }
      previous[strand] = here;
    }
    parent = center;
  }
}

function relay(lines: Filaments, start: Vector3, end: Vector3, bend: number, strength = 1) {
  const drag = end.clone().sub(start);
  const normal = new Vector3().crossVectors(DEPTH_AXIS, drag).normalize();
  const first = start.clone().lerp(end, 0.33).addScaledVector(normal, bend);
  const second = start.clone().lerp(end, 0.68).addScaledVector(normal, -bend * 0.46);
  const path = new CatmullRomCurve3([start, first, second, end]);
  const length = path.getLength();
  const count = Math.ceil(length / 9);
  let previous = start;
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const hub = path.getPoint(t);
    const alpha = (0.13 + lines.next() * 0.078) * strength;
    lines.edge(previous, hub, alpha, alpha * 0.9);
    if (i % 3 === 0 && i < count) {
      lines.micrograph(hub, path.getTangent(t), normal, 4 + lines.next() * 5, alpha * 0.76);
    }
    previous = hub;
  }
}

function addPeripheralWeb(lines: Filaments, center: Vector3, spread: number, strength = 1, density = 1, flow?: Vector3) {
  const arms = Math.max(3, Math.floor((6 + Math.floor(lines.next() * 3)) * density));
  const phase = lines.next() * Math.PI * 2;
  const nodes: Vector3[] = [];
  const side = new Vector3();
  for (let arm = 0; arm < arms; arm++) {
    const angle = phase + (arm + (lines.next() - 0.5) * 0.56) * 2 * Math.PI / arms;
    const tangent = new Vector3(Math.cos(angle), Math.sin(angle) * 0.74, (lines.next() - 0.5) * 1.18).normalize();
    if (flow) tangent.multiplyScalar(0.28).addScaledVector(flow, arm % 2 === 0 ? 0.9 : -0.9).normalize();
    side.crossVectors(DEPTH_AXIS, tangent).normalize();
    const reach = spread * (0.57 + lines.next() * 0.49);
    const elbow = (lines.next() - 0.5) * reach * 0.48;
    let previous = center;
    for (let step = 1; step <= 5; step++) {
      const t = step / 5;
      const here = center.clone()
        .addScaledVector(tangent, (t + (lines.next() - 0.5) * 0.14) * reach)
        .addScaledVector(side, (Math.sin(t * Math.PI) + (lines.next() - 0.5) * 0.68) * elbow);
      const alpha = (0.17 + lines.next() * 0.086) * (1 - t * 0.45) * strength;
      lines.edge(previous, here, alpha, alpha * 1.28);
      lines.micrograph(here, tangent, side, spread * (0.08 + lines.next() * 0.09), alpha);
      if (step === 2 || step === 3) {
        if (arm > 0 && (arm + step) % 3 !== 0) {
          lines.edge(nodes[nodes.length - 2]!, here, alpha * 0.65, alpha * 0.55, DIM_BLUE);
        }
        nodes.push(here);
      }
      previous = here;
    }
  }
}

function addHorizon(lines: Filaments) {
  for (const [index, knots] of HORIZON_PATHS.entries()) {
    const origin = point(knots[0]!);
    const vertical = index % 3 !== 2;
    const side = origin.y < 0 ? -1 : 1;
    const path = new CatmullRomCurve3(knots.map((knot, index) => {
      const extended = point(knot);
      const reach = 1 + 1.5 * index / (knots.length - 1);
      const outward = extended.x - origin.x;
      extended.x = origin.x + outward * reach * (vertical ? 0.16 : 1);
      extended.y = origin.y + (extended.y - origin.y + (vertical ? side * Math.abs(outward) * 0.78 : 0)) * reach;
      return extended;
    }));
    const length = path.getLength();
    // The spacing grows continuously with distance, while the fibres, webs
    // and relay opacity fade before the final low-contrast tips.
    let t = 0;
    let previous = path.getPoint(0);
    while (t < 1) {
      const next = Math.min(1, t + (26 + t * 136) / length);
      const progress = (t + next) / 2;
      const strength = (1 - progress) ** 1.1 * 0.94 + 0.012;
      const center = path.getPoint(next);
      const tangent = path.getTangent(next);
      const normal = new Vector3().crossVectors(DEPTH_AXIS, tangent).normalize();
      const spread = 24 * (1 - progress) + 3;
      // A shared tapered bundle carries the fine weave between stations.
      // Distal webs elongate along it instead of forming radial islands.
      const branch = center.clone().addScaledVector(normal, (lines.next() - 0.5) * spread * 0.8);
      for (const bend of [-0.16, 0.37, 0.83]) {
        relay(lines, previous, center, spread * bend, strength * (bend === 0.37 ? 0.82 : 0.4));
      }
      relay(lines, center, branch, spread * -0.18, strength * 0.7);
      addPeripheralWeb(lines, branch, spread, strength, 1 - progress * 0.62, tangent);
      const offshoot = branch.clone().addScaledVector(tangent, spread * (2 + lines.next() * 1.8))
        .addScaledVector(normal, spread * 0.6);
      relay(lines, branch, offshoot, spread * 0.28, strength * 0.48);
      addPeripheralWeb(lines, offshoot, spread * 0.62, strength * 0.62, 0.65, tangent);
      const nextStation = Math.min(1, next + (26 + next * 136) / length);
      relay(lines, offshoot, path.getPoint(nextStation), spread * -0.22, strength * 0.36);
      previous = center;
      t = next;
    }
  }
}

// Place the added density in upper/lower lobes. Depth-scaled height keeps
// the future photo webs out of the main cell's silhouette at the opening.
function addPhotoNeighborhood(lines: Filaments, focus: Vector3) {
  const sectors = [
    [-1.04, -1.1], [-0.47, 1.14], [0.39, 0.89], [1.08, 1.28],
    [0.79, -0.84], [-0.23, -1.22], [-1.11, 0.77],
  ] as const;
  const side = focus.x < 0 ? -1 : 1;
  const trunk = focus.clone().add(new Vector3(side * 14, 0, -9));
  relay(lines, focus, trunk, side * 4, 0.91);
  const lobes: [Vector3[], Vector3[]] = [[trunk], [trunk]];
  for (const depth of [11, 27, 53]) {
    const lateral = 3.4 + depth * 0.31;
    const vertical = 8 + depth * 0.9 + Math.abs(focus.z) * 0.82;
    const spread = 1.1 + depth * 0.095;
    const density = depth < 20 ? 1.65 : 1.4;
    for (const [u, v] of sectors) {
      const center = focus.clone().add(new Vector3(
        lateral * (u + (lines.next() - 0.5) * 0.15),
        vertical * (v + (lines.next() - 0.5) * 0.18),
        -depth - lines.next() * 2,
      ));
      const lobe = lobes[v < 0 ? 0 : 1];
      const parent = closest(lobe, center);
      const bend = Math.max(spread * 0.92, parent.distanceTo(center) * 0.24);
      relay(lines, parent, center, side * bend, 0.91);
      addPeripheralWeb(lines, center, spread, 1.08, density);
      const companion = center.clone().add(new Vector3(
        spread * (lines.next() - 0.5) * 1.8,
        spread * (lines.next() - 0.5) * 1.4,
        -spread * 1.4,
      ));
      relay(lines, center, companion, spread * -0.44, 0.81);
      addPeripheralWeb(lines, companion, spread * 0.6, 0.81, 0.7);
      lobe.push(center);
    }
  }
}

export interface MachineSynapse {
  dispose(): void;
}

export function createMachineSynapse(root: Object3D): MachineSynapse | null {
  const macro = root.getObjectByName("MachineMacroEXP01");
  const far = macro?.children.find(({ name }) => name === "macro_far");
  const links = macro?.children.find(({ name }) => name === "macro_links_group");
  if (!macro || !far || !links) return null;

  const positionOf = (name: string) => {
    const object = root.getObjectByName(name);
    return object ? macro.worldToLocal(object.getWorldPosition(new Vector3())) : undefined;
  };
  const core = new Filaments(134_000);
  const somaticHubs = addSoma(core);
  for (const branch of DENDRITES) {
    const major = MAJOR_PATHS.has(branch);
    addDendrite(core, branch, major);
    if (major) {
      const join = point(branch[0]);
      core.edge(closest(somaticHubs, join), join, 0.27);
    }
  }
  for (const branch of DISTAL_PATHS) addDendrite(core, branch, false);

  const relays = new Filaments(550_000);
  const satellites = [
    ["sat_1_upper_left_z280", UPPER_LEFT[2], "far_hub_K08", -31],
    ["sat_2_upper_right_z400", EAST[4], "far_hub_K12", 28],
    ["sat_3_left_z600", WEST[3], "far_hub_K08", 21],
    ["sat_4_lower_right_z660", AXON[3], undefined, -19],
    ["sat_5_upper_deep_z930", APICAL[5], undefined, 12],
  ] as const;
  for (const [name, origin, oldHub, bend] of satellites) {
    const satellite = positionOf(name);
    if (!satellite) continue;
    relay(relays, point(origin), satellite, bend);
    const target = oldHub && positionOf(oldHub);
    if (target) relay(relays, satellite, target, bend * 0.66);
  }
  const hubs = [
    ["far_hub_K08", WEST[1], 21],
    ["far_hub_K11", BASAL[1], -24],
    ["far_hub_K12", EAST[1], 31],
  ] as const;
  for (const [name, origin, bend] of hubs) {
    const target = positionOf(name);
    if (target) relay(relays, point(origin), target, bend);
  }
  for (const path of PERIPHERAL_PATHS) {
    const start = positionOf(path.from);
    const end = typeof path.to === "string" ? positionOf(path.to) : point(path.to);
    if (!start || !end) continue;
    let previous = start;
    path.stations.forEach((station, i) => {
      const center = point(station);
      relay(relays, previous, center, i % 2 === 0 ? path.bend : -path.bend * 0.6);
      addPeripheralWeb(relays, center, station[3]);
      previous = center;
    });
    relay(relays, previous, end, path.bend);
  }
  // Additional junctions use the same side corridors as the existing webs,
  // with overlapping loops between them to populate the visited near/mid field.
  for (const path of PERIPHERAL_PATHS) {
    let previous = positionOf(path.from);
    if (!previous) continue;
    for (const station of path.stations) {
      const center = point(station);
      const direction = center.clone().sub(previous).normalize();
      const normal = new Vector3().crossVectors(DEPTH_AXIS, direction).normalize();
      for (const fraction of [0.29, 0.61]) {
        const spread = station[3] * (0.64 + relays.next() * 0.2);
        const hub = previous.clone().lerp(center, fraction)
          .addScaledVector(normal, spread * (fraction < 0.5 ? 0.55 : -0.55));
        relay(relays, previous, hub, spread * 0.3, 0.78);
        relay(relays, hub, center, spread * -0.3, 0.78);
        addPeripheralWeb(relays, hub, spread, 0.84);
      }
      previous = center;
    }
  }
  addHorizon(relays);
  const routeClusters = root.getObjectByName("route_clusters");
  for (const cluster of routeClusters?.children ?? []) {
    if (!/^cluster_0[1-8]_/.test(cluster.name)) continue;
    const focus = positionOf(cluster.children.find(({ name }) => name.startsWith("anchor_screen_"))?.name ?? "");
    if (focus) addPhotoNeighborhood(relays, focus);
  }

  const body = core.build("machine_synapse_filaments");
  const bridges = relays.build("machine_synapse_relays");
  const group = new Group();
  group.name = "machine_synapse";
  group.add(body, bridges);
  const farVisible = far.visible;
  const linksVisible = links.visible;
  macro.add(group);
  far.visible = false;
  links.visible = false;

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      far.visible = farVisible;
      links.visible = linksVisible;
      body.geometry.dispose();
      bridges.geometry.dispose();
      body.material.dispose();
      bridges.material.dispose();
    },
  };
}
